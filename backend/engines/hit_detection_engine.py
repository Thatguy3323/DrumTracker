import librosa
import numpy as np
from typing import List
import uuid
import time


DRUM_COLORS = {
    "kick": "#FF2244",
    "snare": "#00C8FF",
    "hihat": "#00FF7F",
    "tom": "#FF7A00",
}

# GM MIDI note numbers for standard kit
DRUM_MIDI_NOTES = {
    "kick": 36,
    "snare": 38,
    "hihat": 42,
    "tom": 45,
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
    ) -> List[dict]:
        if not self.is_ready:
            await self.initialize()

        t0 = time.perf_counter()

        # --- Onset detection (real DSP) ---
        # sensitivity maps to librosa's delta parameter (lower delta = more sensitive)
        # sensitivity 0..1  →  delta 2.0..0.1
        delta = max(0.1, 2.0 - sensitivity * 1.9)

        # pre_filter_ms → hop_length in samples
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

        # --- Threshold filter by RMS energy at each onset ---
        threshold_linear = 10 ** (threshold_db / 20.0)

        hits = []
        freqs = librosa.fft_frequencies(sr=sr)

        # Pre-compute STFT once
        D = librosa.stft(y, hop_length=hop_length)
        magnitude = np.abs(D)

        for i, (frame_idx, onset_time) in enumerate(zip(onset_frames, onset_times)):
            # Get a short window (up to 20 frames) after the onset
            win_start = int(frame_idx)
            win_end = min(magnitude.shape[1], win_start + 20)
            if win_start >= magnitude.shape[1]:
                continue
            window_mag = magnitude[:, win_start:win_end]

            rms = np.sqrt(np.mean(window_mag ** 2))
            if rms < threshold_linear:
                continue

            # Velocity from RMS (map to 20-127)
            velocity = int(np.clip(20 + rms * 800, 20, 127))

            # Spectral classification using energy in frequency bands
            low_mask = freqs < 200           # kick: < 200 Hz
            mid_mask = (freqs >= 200) & (freqs < 2500)   # snare: 200-2500 Hz
            high_mask = freqs >= 5000        # hi-hat: > 5 kHz
            tom_mask = (freqs >= 100) & (freqs < 500)    # tom overlaps kick/snare

            low_e = float(np.mean(window_mag[low_mask, :]))
            mid_e = float(np.mean(window_mag[mid_mask, :]))
            high_e = float(np.mean(window_mag[high_mask, :]))
            tom_e = float(np.mean(window_mag[tom_mask, :]))

            spectral_centroid = float(
                np.sum(freqs[:, None] * window_mag) / (np.sum(window_mag) + 1e-8)
            )

            # Decision tree based on spectral energy ratios
            if high_e > 0.6 * (low_e + mid_e + high_e):
                drum_type = "hihat"
                confidence = min(0.99, 0.75 + high_e / (low_e + mid_e + high_e + 1e-8) * 0.24)
            elif low_e > mid_e and low_e > high_e and spectral_centroid < 400:
                drum_type = "kick"
                confidence = min(0.99, 0.75 + low_e / (low_e + mid_e + high_e + 1e-8) * 0.24)
            elif mid_e > low_e * 1.5 and spectral_centroid > 1000:
                drum_type = "snare"
                confidence = min(0.99, 0.72 + mid_e / (low_e + mid_e + high_e + 1e-8) * 0.27)
            elif tom_e > 0 and spectral_centroid < 600 and low_e < mid_e:
                drum_type = "tom"
                confidence = min(0.99, 0.68 + 0.15)
            else:
                # Fallback: lowest centroid → kick, else snare
                drum_type = "kick" if spectral_centroid < 500 else "snare"
                confidence = 0.65

            hits.append({
                "id": str(uuid.uuid4()),
                "timestamp": round(float(onset_time), 4),
                "drum_type": drum_type,
                "velocity": velocity,
                "confidence": round(confidence, 3),
                "frequency_centroid": round(spectral_centroid, 1),
            })

        elapsed = time.perf_counter() - t0
        return hits, round(elapsed, 3)
