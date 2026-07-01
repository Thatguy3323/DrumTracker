import librosa
import soundfile as sf
import numpy as np
import os
import io
import uuid
from typing import Tuple


class AudioEngine:
    def __init__(self, max_cache_size: int = 32):
        self._cache: dict = {}
        self._cache_history: list = []  # Track key sequencing for bounded memory evictions
        self.max_cache_size = max_cache_size

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

    def _load_audio_to_cache(self, file_bytes: bytes, audio_id: str) -> Tuple[np.ndarray, int]:
        """Load audio from bytes and store in cache. Returns (audio_array, sample_rate)."""
        buf = io.BytesIO(file_bytes)
        y, sr = librosa.load(buf, sr=None, mono=False)
        
        if y.ndim > 1:
            y = librosa.to_mono(y)
        
        self._cache[audio_id] = (y, sr)
        
        if audio_id not in self._cache_history:
            self._cache_history.append(audio_id)
        
        self._enforce_cache_bounds()
        return y, sr

    def _get_original_channels(self, file_bytes: bytes) -> int:
        """Determine the original number of channels before mono conversion."""
        buf = io.BytesIO(file_bytes)
        y, _ = librosa.load(buf, sr=None, mono=False)
        return 1 if y.ndim == 1 else y.shape[0]

    @staticmethod
    def _get_format(filename: str) -> str:
        """Extract and format the file extension."""
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        return ext.upper() if ext else "UNKNOWN"

    async def load_from_bytes(self, file_bytes: bytes, filename: str) -> dict:
        """Load audio from bytes with auto-generated ID."""
        audio_id = str(uuid.uuid4())
        y, sr = self._load_audio_to_cache(file_bytes, audio_id)
        
        channels = self._get_original_channels(file_bytes)
        duration = librosa.get_duration(y=y, sr=sr)
        total_frames = len(y)

        return {
            "audio_id": audio_id,
            "file_name": filename,
            "sample_rate": sr,
            "channels": channels,
            "duration": round(duration, 3),
            "format": self._get_format(filename),
            "total_frames": total_frames,
        }

    async def load_from_bytes_with_id(self, file_bytes: bytes, filename: str, audio_id: str) -> None:
        """Load audio from bytes with specified ID."""
        self._load_audio_to_cache(file_bytes, audio_id)

    def get_audio(self, audio_id: str) -> Tuple[np.ndarray, int]:
        """Retrieve cached audio data by ID."""
        if audio_id not in self._cache:
            raise ValueError(f"Audio ID {audio_id} not found or has been evicted from active RAM cache.")
        return self._cache[audio_id]

    def get_waveform_peaks(self, audio_id: str, num_points: int = 200) -> list:
        """Generate waveform peak data for visualization using vectorized NumPy operations."""
        y, _ = self.get_audio(audio_id)
        total_len = len(y)
        
        if total_len == 0:
            return [0.0] * num_points

        # Calculate truncation boundary to fit exact reshape multiples cleanly
        valid_len = (total_len // num_points) * num_points
        if valid_len == 0:
            return [float(np.max(np.abs(y)))] * num_points

        # Use vectorized NumPy for fast peak calculation
        reshaped = np.abs(y[:valid_len]).reshape(num_points, -1)
        peaks = np.max(reshaped, axis=1).tolist()
        return [float(p) for p in peaks]
