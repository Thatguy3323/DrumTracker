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

_MEL_CHANNELS = [0, 10, 45, 80, 128]

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
    if not _OPENUNMIX_OK:
        return None
    try:
        sep = _get_umx_separator()
        
        # FIXED: Zero-copy stack tensor instantiation to prevent heavy RAM allocations
        if y.ndim == 1:
            mono_tensor = torch.as_tensor(y, dtype=torch.float32)
            audio = torch.stack([mono_tensor, mono_tensor])
        else:
            audio = torch.as_tensor(y, dtype=torch.float32)

        with torch.no_grad():
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
    frame = min(int(onset_time * sr / _HOP_SIZE), odf_bands.shape[1] - 1)

    # --- Multi-band activation vector ----------------------------------------
    f0 = max(0, frame - 1)
    f1 = min(odf_bands.shape[1], frame + 3)
    band_act = odf_bands[:, f0:f1].max(axis=1)          # shape (4,)
    
    # FIXED: Energy threshold check to reject zero/low energy silent frames before similarity calculations
    if np.linalg.norm(band_act) < 1e-5:
        return "unknown", 0.0

    total = band_act.sum() + 1e-12
    band_ratio = band_act / total                        # normalised

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

    cumsum = np.cumsum(spec.sum(axis=1))
    rolloff_idx = np.searchsorted(cumsum, 0.85 * cumsum[-1])
    rolloff_hz  = freqs[min(rolloff_idx, len(freqs) - 1)]

    s0 = int(onset_time * sr)
    s1 = min(len(y), s0 + int(0.030 * sr))
    zcr = float(librosa.feature.zero_crossing_rate(y[s0:s1]).mean()) if s1 > s0 else 0.0

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

        y_drums = await asyncio.to_thread(_isolate_drum_stem, y, sr)
        used_umx = y_drums is not None
        y_det = y_drums if used_umx else y
        _log.info("Stage 1 drum isolation: %s",
                  "Open-Unmix" if used_umx else "HPSS-only (fallback)")

        if used_umx:
            mix_peak  = float(np.max(np.abs(y)))
            stem_peak = float(np.max(np.abs(y_det)))
            if stem_peak > 1e-9 and mix_peak > 1e-9:
                y_det = (y_det * (mix_peak / stem_peak)).astype(np.float32)

        _, y_perc = librosa.effects.hpss(y_det)

        if _ESSENTIA_OK:
            onset_times = _hfc_ensemble_onsets(y_perc, sr, pre_filter_ms)
        else:
            onset_times = _librosa_onsets_fallback(y_perc, sr, sensitivity)

        threshold_linear = 10.0 ** (threshold_db / 20.0)

        magnitude = np.abs(librosa.stft(y_det, hop_length=_HOP_SIZE))
        freqs     = librosa.fft_frequencies(sr=sr)

        odf_bands = librosa.onset.onset_strength_multi(
            y=y_det, sr=sr, hop_length=_HOP_SIZE,
            channels=_MEL_CHANNELS,
        )

        min_gap  = max(0.012, 0.08 - sensitivity * 0.065)
        last_t   = -999.0
        hits: List[dict] = []

        for onset_time in sorted(onset_times):
            if onset_time - last_t < min_gap:
                continue

            window = y_det[int(onset_time * sr):min(len(y_det), int(onset_time * sr) + int(0.020 * sr))]
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

            # FIXED: Safely skip transient artifacts or bleed classified as unknown noise
            if drum_type == "unknown":
                continue

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
