import librosa
import numpy as np
from typing import List, Tuple
import uuid
import time


DRUM_MIDI_NOTES = {
    "kick":  36,
    "snare": 38,
    "hihat": 42,
    "tom":   45,
}


class HitDetectionEngine:
    def __init__(self):
        self.is_ready = False

    async def initialize(self):
        self.is_ready = True

    async def detect_hits(
        self,
        y: np.ndarray,
        sr: int,
        sensitivity: float = 0.7,
        threshold_db: float = -18.0,
        pre_filter_ms: int = 15,
    ) -> Tuple[List[dict], float]:
        if not self.is_ready:
            await self.initialize()

        t0 = time.perf_counter()

        # ── Onset detection ────────────────────────────────────────────────
        # sensitivity 0.1→1.0  maps delta 2.0→0.1  (lower delta = more sensitive)
        delta = max(0.1, 2.0 - sensitivity * 1.9)

        # pre_filter_ms → minimum hop length
        hop_length = max(64, int(sr * pre_filter_ms / 1000.0))

        onset_frames = librosa.onset.onset_detect(
            y=y,
            sr=sr,
            hop_length=hop_length,
            delta=delta,
            units="frames",
            backtrack=True,
        )
        onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)

        # ── Threshold: compare against signal RMS in time domain ───────────
        # threshold_db is in dBFS relative to full-scale (0 dBFS = RMS of 1.0)
        # Typical drum hits in a normalised audio file: -30 to -6 dBFS
        threshold_linear = 10.0 ** (threshold_db / 20.0)

        # ── Pre-compute STFT for spectral classification ───────────────────
        D = librosa.stft(y, hop_length=hop_length)
        magnitude = np.abs(D)
        freqs = librosa.fft_frequencies(sr=sr)

        hits: List[dict] = []

        for frame_idx, onset_time in zip(onset_frames, onset_times):
            # ── Time-domain RMS in a 50 ms window after the onset ──────────
            sample_start = int(onset_time * sr)
            sample_end   = min(len(y), sample_start + int(0.05 * sr))
            window_y = y[sample_start:sample_end]
            if len(window_y) == 0:
                continue
            rms_td = float(np.sqrt(np.mean(window_y ** 2)))

            # Skip hits below threshold
            if rms_td < threshold_linear:
                continue

            # ── Velocity: map RMS to MIDI velocity 20–127 ─────────────────
            # Map 0 → 20, threshold_linear → 30, 1.0 → 127
            norm = rms_td / max(threshold_linear, 1e-9)
            velocity = int(np.clip(20 + norm * 60, 20, 127))

            # ── Spectral classification in a 30-frame window ──────────────
            win_start = int(frame_idx)
            win_end   = min(magnitude.shape[1], win_start + 30)
            if win_start >= magnitude.shape[1]:
                continue
            spec = magnitude[:, win_start:win_end]

            low_mask  = freqs < 200                          # kick:  < 200 Hz
            mid_mask  = (freqs >= 200) & (freqs < 2500)     # snare: 200–2500 Hz
            high_mask = freqs >= 5000                        # hihat: > 5 kHz
            tom_mask  = (freqs >= 100) & (freqs < 500)      # tom:   100–500 Hz

            low_e  = float(np.mean(spec[low_mask, :]))  if low_mask.any()  else 0.0
            mid_e  = float(np.mean(spec[mid_mask, :]))  if mid_mask.any()  else 0.0
            high_e = float(np.mean(spec[high_mask, :])) if high_mask.any() else 0.0
            tom_e  = float(np.mean(spec[tom_mask, :]))  if tom_mask.any()  else 0.0
            total_e = low_e + mid_e + high_e + 1e-12

            spectral_centroid = float(
                np.sum(freqs[:, None] * spec) / (np.sum(spec) + 1e-12)
            )

            # Decision tree
            if high_e / total_e > 0.55:
                drum_type  = "hihat"
                confidence = min(0.99, 0.72 + (high_e / total_e) * 0.27)
            elif low_e > mid_e and low_e > high_e and spectral_centroid < 450:
                drum_type  = "kick"
                confidence = min(0.99, 0.72 + (low_e / total_e) * 0.27)
            elif mid_e > low_e * 1.3 and spectral_centroid > 800:
                drum_type  = "snare"
                confidence = min(0.99, 0.70 + (mid_e / total_e) * 0.29)
            elif tom_e > 0 and spectral_centroid < 650 and low_e < mid_e:
                drum_type  = "tom"
                confidence = 0.72
            else:
                drum_type  = "kick" if spectral_centroid < 500 else "snare"
                confidence = 0.62

            hits.append({
                "id":                str(uuid.uuid4()),
                "timestamp":         round(float(onset_time), 4),
                "drum_type":         drum_type,
                "velocity":          velocity,
                "confidence":        round(confidence, 3),
                "frequency_centroid": round(spectral_centroid, 1),
            })

        elapsed = time.perf_counter() - t0
        return hits, round(elapsed, 3)

    async def detect_tempo(self, y: np.ndarray, sr: int) -> float:
        """Return the estimated BPM of the audio using librosa beat tracking."""
        try:
            tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo_arr[0]) if hasattr(tempo_arr, "__len__") else float(tempo_arr)
            return round(max(40.0, min(300.0, bpm)), 1)
        except Exception:
            return 120.0
