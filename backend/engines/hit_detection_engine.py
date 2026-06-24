"""
DrumTracker Hit Detection Engine  v3  (2-stage)
------------------------------------------------
STAGE 1 — Drum stem isolation (Open-Unmix `umxhq`, MIT-licensed):
    A pre-trained Open-Unmix model masks the mix down to the drum stem only,
    removing vocals / bass / other.  This is far cleaner than HPSS alone
    (which merely splits harmonic vs percussive) because bass transients and
    vocal plosives no longer leak into onset detection.  Runs on CPU; the
    pretrained weights are cached after first use.  Falls back transparently
    to plain HPSS on the raw mix when Open-Unmix is unavailable or errors.

STAGE 2 — Proprietary detection, run on the isolated drum stem:

  1. HPSS  — strips any residual tonal bleed from the stem so onset
             detection only sees transients.

  2. Essentia 3-ODF ensemble (HFC + Complex + MelFlux) — three onset
     detection functions computed per frame, normalised to [0,1], then
     weighted and peak-picked with scipy.  MelFlux is specifically tuned
     for percussive content and catches soft hits that HFC misses.

  3. Multi-band onset-strength classification (librosa.onset_strength_multi)
     — the same technique used by ADTLib and Omnizart before their neural
     nets.  Computes onset novelty on 4 perceptually-motivated mel bands
     (sub-bass / kick / snare / hihat) so kick vs snare vs hihat is decided
     by WHICH band changed, not just the average energy ratio.  Much more
     robust than raw STFT energy.

  4. Spectral feature refinement — ZCR (zero-crossing rate) and spectral
     rolloff disambiguate hihat from snare crack; spectral centroid fine-
     tunes the boundary between kick and tom.

  5. 20 ms time-domain RMS threshold — correct dBFS comparison in amplitude
     domain; short window avoids diluting transient energy with silence.

  6. Tempo — librosa.beat.beat_track on the full signal.
"""

import librosa
import numpy as np
from typing import List, Optional, Tuple
import asyncio
import logging
import os
import threading
import uuid
import time

try:
    import essentia.standard as _es
    _ESSENTIA_OK = True
except Exception:
    _ESSENTIA_OK = False

try:
    import torch
    from openunmix import predict as _umx_predict, utils as _umx_utils
    _OPENUNMIX_OK = True
except Exception:
    _OPENUNMIX_OK = False

from scipy.signal import find_peaks

_log = logging.getLogger("drumtracker.hit_detection")

DRUM_MIDI_NOTES = {"kick": 36, "snare": 38, "hihat": 42, "tom": 45}

_FRAME_SIZE = 1024
_HOP_SIZE   = 512     # 11.6 ms @ 44.1 kHz — fixed for Essentia compatibility

# Mel band channel boundaries for onset_strength_multi:
#   [0-10] = sub-bass/kick fundamental  (~0-170 Hz)
#   [10-45] = kick body/tom             (~170-1100 Hz)
#   [45-80] = snare body                (~1100-4000 Hz)
#   [80-128] = hihat/cymbal/crack       (~4000-22050 Hz)
_MEL_CHANNELS = [0, 10, 45, 80, 128]

# Weights for kick / snare / hihat / tom over the 4 bands
# Rows = drum type, Cols = [sub-bass, kick-body, snare-body, hihat-crack]
_BAND_PROTOTYPES = np.array([
    [0.55, 0.35, 0.08, 0.02],   # kick
    [0.08, 0.28, 0.48, 0.16],   # snare
    [0.02, 0.06, 0.18, 0.74],   # hihat
    [0.22, 0.52, 0.22, 0.04],   # tom
], dtype=np.float64)


def _norm(x: np.ndarray) -> np.ndarray:
    rng = float(x.max() - x.min())
    return (x - x.min()) / rng if rng > 1e-12 else np.zeros_like(x)


# ---------------------------------------------------------------------------
# STAGE 1 — Open-Unmix drum stem isolation
# ---------------------------------------------------------------------------
_UMX_RATE = 44100
_umx_separator = None          # lazily-loaded singleton
_umx_lock = threading.Lock()   # guards one-time separator load across threads


def _get_umx_separator():
    """Load the Open-Unmix (umxhq) drums-only separator once and cache it.

    Thread-safe: ``detect_hits`` offloads separation via ``asyncio.to_thread``,
    so concurrent requests can reach this from several worker threads at once.
    Double-checked locking ensures only one thread loads the model (and races
    on the torch-hub weight download); the rest reuse the cached singleton.
    """
    global _umx_separator
    if _umx_separator is None:
        with _umx_lock:
            if _umx_separator is None:
                torch.set_num_threads(max(1, os.cpu_count() or 1))
                sep = _umx_utils.load_separator(
                    model_str_or_path="umxhq",
                    targets=["drums"],
                    niter=0,
                    residual=False,
                    pretrained=True,
                )
                sep.eval()
                _umx_separator = sep
    return _umx_separator


def _isolate_drum_stem(y: np.ndarray, sr: int) -> Optional[np.ndarray]:
    """
    Stage 1: return a mono drum stem isolated by Open-Unmix, resampled back
    to ``sr``.  Returns ``None`` on any failure so the caller can fall back
    to plain HPSS on the original mix.  Synchronous + CPU-bound — call it via
    a worker thread (``asyncio.to_thread``) so it does not block the loop.
    """
    if not _OPENUNMIX_OK:
        return None
    try:
        # Open-Unmix expects (channels, samples); mono -> duplicated stereo.
        y_in = y if y.ndim > 1 else np.stack([y, y])
        sep = _get_umx_separator()
        audio = torch.as_tensor(np.ascontiguousarray(y_in), dtype=torch.float32)
        with torch.no_grad():
            # predict.separate handles resampling to the model rate internally.
            estimates = _umx_predict.separate(audio, rate=sr, separator=sep)
        drums = estimates["drums"]                       # (1, 2, N) @ 44.1 kHz
        stem = drums.squeeze(0).mean(dim=0).detach().cpu().numpy()   # -> mono
        if sr != _UMX_RATE:
            stem = librosa.resample(stem, orig_sr=_UMX_RATE, target_sr=sr)
        if stem.size == 0 or not np.isfinite(stem).all():
            return None
        return stem.astype(np.float32)
    except Exception as exc:                              # pragma: no cover
        _log.warning("Open-Unmix separation failed (%s); using HPSS fallback", exc)
        return None


def _hfc_ensemble_onsets(y_perc: np.ndarray, sr: int, pre_filter_ms: float) -> np.ndarray:
    """
    3-ODF Essentia ensemble: HFC (timing) + Complex (transient shape) +
    MelFlux (soft percussive hits).  scipy peak-picking gives full control
    without Essentia's strict frame-rate constraint.
    """
    y32 = y_perc.astype(np.float32)

    w     = _es.Windowing(type="hann")
    fft   = _es.FFT()
    c2p   = _es.CartesianToPolar()
    hfc   = _es.OnsetDetection(method="hfc",     sampleRate=sr)
    cmpx  = _es.OnsetDetection(method="complex",  sampleRate=sr)
    mflux = _es.OnsetDetection(method="melflux",  sampleRate=sr)

    hfc_v: List[float] = []
    cmp_v: List[float] = []
    mfx_v: List[float] = []

    for frame in _es.FrameGenerator(y32, frameSize=_FRAME_SIZE,
                                     hopSize=_HOP_SIZE, startFromZero=True):
        spec = fft(w(frame))
        mag, phase = c2p(spec)
        hfc_v.append(float(hfc(mag, phase)))
        cmp_v.append(float(cmpx(mag, phase)))
        mfx_v.append(float(mflux(mag, phase)))

    if len(hfc_v) < 3:
        return np.array([], dtype=np.float64)

    # Weighted ensemble: HFC best for timing, MelFlux catches soft hits
    odf = (0.50 * _norm(np.array(hfc_v))
           + 0.20 * _norm(np.array(cmp_v))
           + 0.30 * _norm(np.array(mfx_v)))

    min_dist = max(1, int(pre_filter_ms / 1000.0 * sr / _HOP_SIZE))
    peaks, _ = find_peaks(odf, height=0.12, distance=min_dist, prominence=0.06)

    return np.arange(len(odf))[peaks] * _HOP_SIZE / sr


def _librosa_onsets_fallback(y_perc: np.ndarray, sr: int,
                              sensitivity: float) -> np.ndarray:
    delta = max(0.1, 2.0 - sensitivity * 1.9)
    frames = librosa.onset.onset_detect(
        y=y_perc, sr=sr, hop_length=_HOP_SIZE,
        delta=delta, units="frames", backtrack=True,
    )
    return librosa.frames_to_time(frames, sr=sr, hop_length=_HOP_SIZE)


def _classify_onset(
    onset_time: float,
    y: np.ndarray,
    sr: int,
    odf_bands: np.ndarray,    # (4, n_frames)
    magnitude: np.ndarray,    # (freq_bins, n_frames) — full STFT magnitude
    freqs: np.ndarray,
) -> Tuple[str, float]:
    """
    Multi-band onset-strength classification (ADTLib-style).

    For each detected onset, read the 4-band novelty activations from
    onset_strength_multi and compare them to per-drum prototypes using
    cosine similarity.  Refine with ZCR and spectral rolloff.
    """
    frame = min(int(onset_time * sr / _HOP_SIZE), odf_bands.shape[1] - 1)

    # --- Multi-band activation vector ----------------------------------------
    # Look at a ±2 frame neighbourhood for stability
    f0 = max(0, frame - 1)
    f1 = min(odf_bands.shape[1], frame + 3)
    band_act = odf_bands[:, f0:f1].max(axis=1)          # shape (4,)
    total = band_act.sum() + 1e-12
    band_ratio = band_act / total                        # normalised

    # Cosine similarity to each drum-type prototype
    sims = np.array([
        float(np.dot(band_ratio, proto) /
              (np.linalg.norm(band_ratio) * np.linalg.norm(proto) + 1e-12))
        for proto in _BAND_PROTOTYPES
    ])
    drum_names = ["kick", "snare", "hihat", "tom"]
    best_idx   = int(np.argmax(sims))
    raw_conf   = float(sims[best_idx])

    # --- Spectral refinements -------------------------------------------------
    w0 = frame
    w1 = min(magnitude.shape[1], frame + 20)
    spec = magnitude[:, w0:w1]

    centroid = float(np.sum(freqs[:, None] * spec) / (np.sum(spec) + 1e-12))

    # Rolloff: frequency below which 85 % of energy sits
    cumsum = np.cumsum(spec.sum(axis=1))
    rolloff_idx = np.searchsorted(cumsum, 0.85 * cumsum[-1])
    rolloff_hz  = freqs[min(rolloff_idx, len(freqs) - 1)]

    # ZCR from raw audio in a 30 ms window
    s0 = int(onset_time * sr)
    s1 = min(len(y), s0 + int(0.030 * sr))
    zcr = float(librosa.feature.zero_crossing_rate(y[s0:s1]).mean()) if s1 > s0 else 0.0

    # Override corrections
    drum_type = drum_names[best_idx]

    if zcr > 0.28 and rolloff_hz > 5000:
        drum_type = "hihat"
    elif drum_type == "hihat" and centroid < 2500 and zcr < 0.18:
        drum_type = "snare"
    elif drum_type in ("kick", "tom") and centroid > 900:
        drum_type = "snare" if centroid > 1400 else "tom"
    elif drum_type == "snare" and centroid < 350:
        drum_type = "kick"

    confidence = min(0.97, 0.62 + raw_conf * 0.35)
    return drum_type, confidence


class HitDetectionEngine:
    def __init__(self):
        self.is_ready = False

    async def initialize(self):
        self.is_ready = True

    async def detect_hits(
        self,
        y: np.ndarray,
        sr: int,
        sensitivity: float = 0.72,
        threshold_db: float = -30.0,
        pre_filter_ms: int  = 15,
    ) -> Tuple[List[dict], float]:
        if not self.is_ready:
            await self.initialize()

        t0 = time.perf_counter()

        # ===== STAGE 1: Open-Unmix drum stem isolation (HPSS fallback) =====
        # Offloaded to a worker thread so the long CPU separation does not
        # block the event loop (tempo detection can run concurrently).
        y_drums = await asyncio.to_thread(_isolate_drum_stem, y, sr)
        used_umx = y_drums is not None
        y_det = y_drums if used_umx else y
        _log.info("Stage 1 drum isolation: %s",
                  "Open-Unmix" if used_umx else "HPSS-only (fallback)")

        # Open-Unmix returns a drum stem that is much quieter than the original
        # mix.  The per-onset loudness gate (and velocity scaling) compares the
        # stem's RMS against a threshold derived directly from the user's dB
        # setting, which was tuned for the original mix.  Without re-levelling,
        # nearly every onset falls below the gate and detection returns zero
        # hits.  Peak-match the stem back to the original mix so the threshold
        # semantics stay intact while preserving the stem's relative dynamics.
        if used_umx:
            mix_peak  = float(np.max(np.abs(y)))
            stem_peak = float(np.max(np.abs(y_det)))
            if stem_peak > 1e-9 and mix_peak > 1e-9:
                y_det = (y_det * (mix_peak / stem_peak)).astype(np.float32)

        # ===== STAGE 2: proprietary detection on the isolated stem =====
        # 1. HPSS — strip any residual tonal bleed so timing sees transients
        _, y_perc = librosa.effects.hpss(y_det)

        # 2. Onset timing
        if _ESSENTIA_OK:
            onset_times = _hfc_ensemble_onsets(y_perc, sr, pre_filter_ms)
        else:
            onset_times = _librosa_onsets_fallback(y_perc, sr, sensitivity)

        # 3. Pre-compute features used for threshold + classification
        threshold_linear = 10.0 ** (threshold_db / 20.0)

        magnitude = np.abs(librosa.stft(y_det, hop_length=_HOP_SIZE))
        freqs     = librosa.fft_frequencies(sr=sr)

        # Multi-band onset novelty (ADTLib-style feature extraction)
        odf_bands = librosa.onset.onset_strength_multi(
            y=y_det, sr=sr, hop_length=_HOP_SIZE,
            channels=_MEL_CHANNELS,
        )   # shape (4, n_frames)

        # 4. Per-onset: threshold → classify
        min_gap  = max(0.012, 0.08 - sensitivity * 0.065)
        last_t   = -999.0
        hits: List[dict] = []

        for onset_time in sorted(onset_times):
            if onset_time - last_t < min_gap:
                continue

            # 20 ms RMS — captures attack without silence dilution
            s0 = int(onset_time * sr)
            s1 = min(len(y_det), s0 + int(0.020 * sr))
            window = y_det[s0:s1]
            if len(window) == 0:
                continue
            rms = float(np.sqrt(np.mean(window ** 2)))
            if rms < threshold_linear:
                continue

            last_t = onset_time

            norm_rms = rms / max(threshold_linear, 1e-9)
            velocity = int(np.clip(20 + norm_rms * 55, 20, 127))

            drum_type, confidence = _classify_onset(
                onset_time, y_det, sr, odf_bands, magnitude, freqs
            )

            _f0 = min(int(onset_time * sr / _HOP_SIZE), magnitude.shape[1] - 1)
            _f1 = min(magnitude.shape[1], _f0 + 20)
            _spec_w = magnitude[:, _f0:_f1]
            centroid = float(
                np.sum(freqs[:, None] * _spec_w) / (np.sum(_spec_w) + 1e-12)
            )

            hits.append({
                "id":                 str(uuid.uuid4()),
                "timestamp":          round(float(onset_time), 4),
                "drum_type":          drum_type,
                "velocity":           velocity,
                "confidence":         round(confidence, 3),
                "frequency_centroid": round(centroid, 1),
            })

        elapsed = round(time.perf_counter() - t0, 3)
        return hits, elapsed

    async def detect_tempo(self, y: np.ndarray, sr: int) -> float:
        try:
            tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo_arr[0]) if hasattr(tempo_arr, "__len__") else float(tempo_arr)
            return round(max(40.0, min(300.0, bpm)), 1)
        except Exception:
            return 120.0
