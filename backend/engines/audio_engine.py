import librosa
import soundfile as sf
import numpy as np
import os
import io
import uuid
from typing import Tuple


class AudioEngine:
    def __init__(self, max_cache_size: int = 32):
        self.is_ready = False
        self._cache: dict = {}
        self._cache_history: list = []  # FIXED: Track key sequencing for bounded memory evictions
        self.max_cache_size = max_cache_size

    async def initialize(self):
        self.is_ready = True

    def evict_audio(self, audio_id: str) -> None:
        """Explicitly release memory matrices belonging to a specific target tracking ID."""
        self._cache.pop(audio_id, None)
        if audio_id in self._cache_history:
            self._cache_history.remove(audio_id)

    def _enforce_cache_bounds(self) -> None:
        """Prevent RAM exhaustion by popping historical memory files when size constraints break."""
        while len(self._cache_history) > self.max_cache_size:
            oldest_id = self._cache_history.pop(0)
            self._cache.pop(oldest_id, None)

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

        audio_id = str(uuid.uuid4())
        self._cache[audio_id] = (y, sr)
        self._cache_history.append(audio_id)
        self._enforce_cache_bounds()

        return {
            "audio_id": audio_id,
            "file_name": filename,
            "sample_rate": sr,
            "channels": channels,
            "duration": round(duration, 3),
            "format": ext.upper() if ext else "UNKNOWN",
            "total_frames": total_frames,
        }

    async def load_from_bytes_with_id(self, file_bytes: bytes, filename: str, audio_id: str) -> None:
        if not self.is_ready:
            await self.initialize()

        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        buf = io.BytesIO(file_bytes)

        y, sr = librosa.load(buf, sr=None, mono=False)
        if y.ndim > 1:
            y = librosa.to_mono(y)

        self._cache[audio_id] = (y, sr)
        if audio_id not in self._cache_history:
            self._cache_history.append(audio_id)
        self._enforce_cache_bounds()

    def get_audio(self, audio_id: str) -> Tuple[np.ndarray, int]:
        if audio_id not in self._cache:
            raise ValueError(f"Audio ID {audio_id} not found or has been evicted from active RAM cache.")
        return self._cache[audio_id]

    def get_waveform_peaks(self, audio_id: str, num_points: int = 200) -> list:
        # FIXED: Refactored execution to leverage vectorized NumPy resizing arrays for fast coordinate processing
        y, _ = self.get_audio(audio_id)
        total_len = len(y)
        if total_len == 0:
            return [0.0] * num_points

        # Calculate truncation boundary to fit exact reshape multiples cleanly
        valid_len = (total_len // num_points) * num_points
        if valid_len == 0:
            return [float(np.max(np.abs(y)))] * num_points

        reshaped = np.abs(y[:valid_len]).reshape(num_points, -1)
        peaks = np.max(reshaped, axis=1).tolist()
        return [float(p) for p in peaks]
        
