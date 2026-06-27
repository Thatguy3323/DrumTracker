import asyncio
import time
import uuid
from pathlib import Path
import tempfile
import numpy as np
import soundfile as sf

SUPPORTED_FORMATS = {
    "mp3":  {"ext": "mp3",  "codec": "libmp3lame", "lossy": True},
    "wav":  {"ext": "wav",  "codec": "pcm_s16le",  "lossy": False},
    "flac": {"ext": "flac", "codec": "flac",        "lossy": False},
    "ogg":  {"ext": "ogg",  "codec": "libvorbis",   "lossy": True},
    "aac":  {"ext": "m4a",  "codec": "aac",         "lossy": True},
    "m4a":  {"ext": "m4a",  "codec": "aac",         "lossy": True},
}

TEMP_DIR = Path(tempfile.gettempdir()) / "drumtracker_conversions"

JOB_TTL_SECONDS = 3600


class ConversionEngine:
    def __init__(self):
        TEMP_DIR.mkdir(exist_ok=True)
        self._jobs: dict = {}

    def get_job(self, job_id: str) -> dict | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list:
        return list(self._jobs.values())

    def cleanup_job(self, job_id: str) -> None:
        job = self._jobs.pop(job_id, None)
        if job:
            path = Path(job.get("output_path", ""))
            path.unlink(missing_ok=True)

    def prune_stale(self, max_age: float = JOB_TTL_SECONDS) -> int:
        now = time.monotonic()
        stale = [
            jid for jid, job in list(self._jobs.items())
            if now - job.get("created_at", now) >= max_age
        ]
        for jid in stale:
            self.cleanup_job(jid)
        return len(stale)

    async def start_job(
        self,
        y: np.ndarray,
        sr: int,
        source_filename: str,
        target_format: str,
        bitrate: str = "192k",
    ) -> str:
        fmt_key = target_format.lower()
        fmt = SUPPORTED_FORMATS.get(fmt_key)
        if not fmt:
            raise ValueError(f"Unsupported format: {target_format}. Choose from: {', '.join(SUPPORTED_FORMATS)}")

        job_id = str(uuid.uuid4())
        base = Path(source_filename).stem
        output_filename = f"{base}.{fmt['ext']}"
        output_path = TEMP_DIR / f"{job_id}_{output_filename}"

        self._jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "format": fmt_key,
            "filename": output_filename,
            "output_path": str(output_path),
            "source": source_filename,
            "error": None,
            "created_at": time.monotonic(),
        }

        asyncio.create_task(
            self._run(job_id, y, sr, output_path, fmt, bitrate)
        )
        return job_id

    async def _run(self, job_id: str, y: np.ndarray, sr: int,
                   output_path: Path, fmt: dict, bitrate: str):
        tmp_wav = TEMP_DIR / f"{job_id}_src.wav"
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: sf.write(str(tmp_wav), y, sr, format="WAV", subtype="PCM_16"),
            )

            cmd = ["ffmpeg", "-y", "-i", str(tmp_wav), "-acodec", fmt["codec"]]
            if fmt["lossy"] and bitrate:
                cmd += ["-b:a", bitrate]
            cmd.append(str(output_path))

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode == 0:
                self._jobs[job_id]["status"] = "done"
            else:
                self._jobs[job_id]["status"] = "failed"
                self._jobs[job_id]["error"] = stderr.decode(errors="replace")[-300:]
        except Exception as exc:
            self._jobs[job_id]["status"] = "failed"
            self._jobs[job_id]["error"] = str(exc)
        finally:
            tmp_wav.unlink(missing_ok=True)
