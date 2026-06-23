import numpy as np
import io
import soundfile as sf


KIT_PROFILES = {
    "rock":       {"kick_freq": 70,  "kick_decay": 18, "snare_noise": 0.65, "hat_decay": 55, "tom_freq": 140},
    "jazz":       {"kick_freq": 90,  "kick_decay": 25, "snare_noise": 0.80, "hat_decay": 80, "tom_freq": 160},
    "electronic": {"kick_freq": 55,  "kick_decay": 12, "snare_noise": 0.45, "hat_decay": 45, "tom_freq": 120},
    "hiphop":     {"kick_freq": 60,  "kick_decay": 14, "snare_noise": 0.70, "hat_decay": 60, "tom_freq": 130},
    "metal":      {"kick_freq": 80,  "kick_decay": 22, "snare_noise": 0.55, "hat_decay": 40, "tom_freq": 170},
    "latin":      {"kick_freq": 100, "kick_decay": 20, "snare_noise": 0.90, "hat_decay": 70, "tom_freq": 180},
}

DEFAULT_PROFILE = KIT_PROFILES["rock"]


class DrumReplacementEngine:
    def synthesize_drum(self, drum_type: str, velocity: int, sr: int, profile: dict) -> np.ndarray:
        amplitude = min(velocity / 127.0, 1.0)

        if drum_type == "kick":
            duration = 0.28
            n = int(sr * duration)
            t = np.linspace(0, duration, n)
            freq = profile["kick_freq"]
            decay = profile["kick_decay"]
            envelope = np.exp(-t * decay)
            pitch_drop = np.sin(2 * np.pi * freq * t * (1.0 - t * 1.5))
            sample = amplitude * envelope * pitch_drop

        elif drum_type == "snare":
            duration = 0.18
            n = int(sr * duration)
            t = np.linspace(0, duration, n)
            envelope = np.exp(-t * 28)
            sine_body = np.sin(2 * np.pi * 200 * t) * 0.35
            noise_ratio = profile["snare_noise"]
            rng = np.random.default_rng(42)
            noise_body = rng.standard_normal(n) * noise_ratio
            sample = amplitude * envelope * (sine_body + noise_body)

        elif drum_type == "hihat":
            duration = 0.09
            n = int(sr * duration)
            t = np.linspace(0, duration, n)
            decay = profile["hat_decay"]
            envelope = np.exp(-t * decay)
            rng = np.random.default_rng(7)
            noise = rng.standard_normal(n)
            sample = amplitude * 0.35 * envelope * noise

        else:
            duration = 0.22
            n = int(sr * duration)
            t = np.linspace(0, duration, n)
            freq = profile["tom_freq"]
            envelope = np.exp(-t * 14)
            sample = amplitude * envelope * np.sin(2 * np.pi * freq * t)

        return sample.astype(np.float32)

    def process(
        self,
        y: np.ndarray,
        sr: int,
        hits: list,
        kit_id: str,
        keep_original: bool,
        kit_level: float = 0.8,
    ) -> bytes:
        profile = KIT_PROFILES.get(kit_id, DEFAULT_PROFILE)

        if keep_original:
            result = y.copy().astype(np.float64)
        else:
            result = np.zeros(len(y), dtype=np.float64)

        for hit in hits:
            sample = self.synthesize_drum(
                hit["drum_type"], hit["velocity"], sr, profile
            ).astype(np.float64)

            start = int(hit["timestamp"] * sr)
            end = min(start + len(sample), len(result))
            length = end - start
            if length <= 0:
                continue
            result[start:end] += sample[:length] * kit_level

        peak = np.max(np.abs(result))
        if peak > 1.0:
            result = result / peak * 0.95

        buf = io.BytesIO()
        sf.write(buf, result.astype(np.float32), sr, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return buf.read()
