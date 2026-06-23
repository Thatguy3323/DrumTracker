"""
DrumTracker Hit Detection Engine
---------------------------------
Detection pipeline:
  1. HPSS (Harmonic-Percussive Source Separation) via librosa — isolates the
     percussive layer so snares/kicks/hats are not masked by harmonic content.
  2. Essentia HFC (High Frequency Content) onset detection — purpose-built for
     sharp percussive transients, significantly more accurate than plain librosa
     spectral-flux onset detection.
  3. Time-domain RMS threshold filter — compares a 50 ms window at each onset
     against the user-supplied dBFS threshold (correctly in amplitude domain).
  4. Multi-band spectral energy + centroid classification — assigns each onset
     to kick / snare / hihat / tom based on frequency content in the original
     (non-separated) signal for accurate timbre reading.
  5. Tempo: librosa BeatTracker on the full signal — returns BPM as float.
"""

import librosa
import numpy as np
from typing import List, Tuple
import uuid
import time

try:
    import essentia.standard as _es
    _ESSENTIA_OK = True
except Exception:
    _ESSENTIA_OK = False


DRUM_MIDI_NOTES = {
    "kick":  36,
    "snare": 38,
    "hihat": 42,
    "tom":   45,
}

_FRAME_SIZE = 1024
_HOP_SIZE   = 512   # ~11.6 ms @ 44.1 kHz; resampled below if needed


def _hfc_onsets_essentia(y_perc: np.ndarray, sr: int, pre_filter_ms: float) -> np.ndarray:
    """
    Return onset times (seconds) using Essentia HFC+Complex onset detection
    with scipy peak-picking (avoids Essentia's strict frame-rate constraint).
    """
    from scipy.signal import find_peaks

    # Use a fixed hop that Essentia handles reliably; pre_filter_ms controls
    # post-hoc minimum-interval filtering instead.
    hop = _HOP_SIZE   # 512 samples ≈ 11.6 ms @ 44.1 kHz
    y32 = y_perc.astype(np.float32)

    w    = _es.Windowing(type="hann")
    fft  = _es.FFT()
    c2p  = _es.CartesianToPolar()
    hfc  = _es.OnsetDetection(method="hfc",     sampleRate=sr)
    cmpx = _es.OnsetDetection(method="complex",  sampleRate=sr)

    hfc_vals:  List[float] = []
    cmpx_vals: List[float] = []

    for frame in _es.FrameGenerator(y32, frameSize=_FRAME_SIZE, hopSize=hop, startFromZero=True):
        spec = fft(w(frame))
        mag, phase = c2p(spec)
        hfc_vals.append(float(hfc(mag, phase)))
        cmpx_vals.append(float(cmpx(mag, phase)))

    if len(hfc_vals) < 3:
        return np.array([], dtype=np.float64)

    hfc_arr  = np.array(hfc_vals,  dtype=np.float64)
    cmpx_arr = np.array(cmpx_vals, dtype=np.float64)

    # Normalise each ODF to [0, 1] then combine (HFC dominant)
    def _norm(x: np.ndarray) -> np.ndarray:
        rng = x.max() - x.min()
        return (x - x.min()) / rng if rng > 1e-12 else x * 0.0

    odf = 0.65 * _norm(hfc_arr) + 0.35 * _norm(cmpx_arr)

    # Minimum distance between peaks = pre_filter_ms converted to frames
    min_dist = max(1, int(pre_filter_ms / 1000.0 * sr / hop))

    peaks, _ = find_peaks(odf, height=0.15, distance=min_dist, prominence=0.08)

    frame_times = np.arange(len(odf)) * hop / sr
    return frame_times[peaks]


def _librosa_onsets(y_perc: np.ndarray, sr: int, delta: float, hop: int) -> np.ndarray:
    """Fallback: librosa onset detection on the percussive signal."""
    frames = librosa.onset.onset_detect(
        y=y_perc, sr=sr, hop_length=hop,
        delta=delta, units="frames", backtrack=True,
    )
    return librosa.frames_to_time(frames, sr=sr, hop_length=hop)


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

        # ── 1. HPSS: separate percussive component ──────────────────────────
        _, y_perc = librosa.effects.hpss(y)

        # ── 2. Onset detection ───────────────────────────────────────────────
        hop = max(64, int(sr * pre_filter_ms / 1000.0))

        if _ESSENTIA_OK:
            onset_times = _hfc_onsets_essentia(y_perc, sr, pre_filter_ms)
        else:
            # Fallback to librosa
            delta = max(0.1, 2.0 - sensitivity * 1.9)
            onset_times = _librosa_onsets(y_perc, sr, delta, hop)

        # ── 3. Time-domain RMS threshold ────────────────────────────────────
        threshold_linear = 10.0 ** (threshold_db / 20.0)

        # ── 4. Spectral features for classification ──────────────────────────
        # Pre-compute STFT on the ORIGINAL signal (full-timbre read)
        D         = librosa.stft(y, hop_length=hop)
        magnitude = np.abs(D)
        freqs     = librosa.fft_frequencies(sr=sr)

        # Frequency band masks
        low_mask  = freqs < 200
        mid_mask  = (freqs >= 200) & (freqs < 2500)
        high_mask = freqs >= 5000
        tom_mask  = (freqs >= 100) & (freqs < 500)

        # ── 5. For each onset, threshold + classify ──────────────────────────
        #
        # Minimum inter-onset interval from sensitivity (controls de-duplication):
        # sensitivity 0.1→1.0  →  min_gap 0.08→0.015 s
        min_gap = max(0.012, 0.08 - sensitivity * 0.065)
        last_time: float = -999.0

        hits: List[dict] = []

        for onset_time in sorted(onset_times):
            # De-duplicate: respect minimum gap
            if onset_time - last_time < min_gap:
                continue

            # RMS in a 20 ms window after onset (captures attack without
            # diluting with post-transient silence)
            sample_start = int(onset_time * sr)
            sample_end   = min(len(y), sample_start + int(0.020 * sr))
            window_y = y[sample_start:sample_end]
            if len(window_y) == 0:
                continue
            rms_td = float(np.sqrt(np.mean(window_y ** 2)))

            if rms_td < threshold_linear:
                continue

            last_time = onset_time

            # Velocity 20–127 from normalised RMS
            norm     = rms_td / max(threshold_linear, 1e-9)
            velocity = int(np.clip(20 + norm * 55, 20, 127))

            # Spectral classification: 30-frame window in STFT
            frame_idx = min(int(onset_time * sr / hop), magnitude.shape[1] - 1)
            win_start = frame_idx
            win_end   = min(magnitude.shape[1], win_start + 30)
            spec      = magnitude[:, win_start:win_end]

            low_e  = float(np.mean(spec[low_mask, :]))  if low_mask.any()  else 0.0
            mid_e  = float(np.mean(spec[mid_mask, :]))  if mid_mask.any()  else 0.0
            high_e = float(np.mean(spec[high_mask, :])) if high_mask.any() else 0.0
            tom_e  = float(np.mean(spec[tom_mask, :]))  if tom_mask.any()  else 0.0
            total_e = low_e + mid_e + high_e + 1e-12

            centroid = float(
                np.sum(freqs[:, None] * spec) / (np.sum(spec) + 1e-12)
            )

            # Decision tree
            if high_e / total_e > 0.55:
                drum_type  = "hihat"
                confidence = min(0.97, 0.72 + (high_e / total_e) * 0.25)
            elif low_e > mid_e and low_e > high_e and centroid < 450:
                drum_type  = "kick"
                confidence = min(0.97, 0.72 + (low_e / total_e) * 0.25)
            elif mid_e > low_e * 1.3 and centroid > 800:
                drum_type  = "snare"
                confidence = min(0.97, 0.70 + (mid_e / total_e) * 0.27)
            elif tom_e > 0 and centroid < 650 and low_e < mid_e:
                drum_type  = "tom"
                confidence = 0.72
            else:
                drum_type  = "kick" if centroid < 500 else "snare"
                confidence = 0.62

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
        """Estimate BPM using librosa beat tracking."""
        try:
            tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo_arr[0]) if hasattr(tempo_arr, "__len__") else float(tempo_arr)
            return round(max(40.0, min(300.0, bpm)), 1)
        except Exception:
            return 120.0
