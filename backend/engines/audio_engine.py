import librosa
import soundfile as sf
import numpy as np
import os
import io
from typing import Tuple


class AudioEngine:
    def __init__(self):
        self.is_ready = False
        self._cache: dict = {}

    async def initialize(self):
        self.is_ready = True

    async def load_from_bytes(self, file_bytes: bytes, filename: str) -> dict:
        if not self.is_ready:
            await self.initialize()

        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        buf = io.BytesIO(file_bytes)

        y, sr = librosa.load(buf, sr=None, mono=False)

        if y.ndim == 1:
            channels = 1
        else:
            channels = y.shape[0]
            y = librosa.to_mono(y)

        duration = librosa.get_duration(y=y, sr=sr)
        total_frames = len(y)

        import uuid
        audio_id = str(uuid.uuid4())
        self._cache[audio_id] = (y, sr)

        return {
            "audio_id": audio_id,
            "file_name": filename,
            "sample_rate": sr,
            "channels": channels,
            "duration": round(duration, 3),
            "format": ext.upper() if ext else "UNKNOWN",
            "total_frames": total_frames,
        }

    def get_audio(self, audio_id: str) -> Tuple[np.ndarray, int]:
        if audio_id not in self._cache:
            raise ValueError(f"Audio ID {audio_id} not found in cache")
        return self._cache[audio_id]

    def get_waveform_peaks(self, audio_id: str, num_points: int = 200) -> list:
        y, sr = self.get_audio(audio_id)
        chunk_size = max(1, len(y) // num_points)
        peaks = []
        for i in range(num_points):
            start = i * chunk_size
            end = min(start + chunk_size, len(y))
            chunk = y[start:end]
            peaks.append(float(np.max(np.abs(chunk))) if len(chunk) > 0 else 0.0)
        return peaks
