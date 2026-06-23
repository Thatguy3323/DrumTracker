import asyncio
import logging
import os
import uuid
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles

from models import DetectRequest, DetectionResult, DrumHit, AudioMetadata
from engines.audio_engine import AudioEngine
from engines.hit_detection_engine import HitDetectionEngine
from engines.midi_export_engine import MidiExportEngine
from engines.replacement_engine import DrumReplacementEngine
from engines.conversion_engine import ConversionEngine
from database import (
    init_db, save_audio_session, save_detection_session,
    list_sessions, load_audio_session, load_detection_session,
    cleanup_orphaned_uploads,
    UPLOADS_DIR,
)

logger = logging.getLogger("drumtracker")

app = FastAPI(title="DrumTracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

audio_engine = AudioEngine()
hit_engine = HitDetectionEngine()
midi_engine = MidiExportEngine()
replacement_engine = DrumReplacementEngine()
conversion_engine = ConversionEngine()


_cleanup_lock = asyncio.Lock()


def _run_cleanup():
    """Synchronous cleanup worker — called from a thread pool so it never blocks the event loop."""
    try:
        orphaned, old = cleanup_orphaned_uploads(max_age_days=30, orphan_grace_seconds=600)
        if orphaned or old:
            logger.info("Upload cleanup: removed %d orphaned and %d old files.", orphaned, old)
        else:
            logger.debug("Upload cleanup: nothing to remove.")
    except Exception:
        logger.exception("Upload cleanup failed.")


async def _schedule_cleanup():
    """Fire-and-forget: run the cleanup in a thread, but skip if a cleanup is already in progress."""
    if _cleanup_lock.locked():
        return
    async with _cleanup_lock:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_cleanup)


@app.on_event("startup")
async def startup():
    init_db()
    await audio_engine.initialize()
    await hit_engine.initialize()
    asyncio.create_task(_schedule_cleanup())


# ── Audio ──────────────────────────────────────────────────────────────────────

@app.post("/api/audio/upload", response_model=AudioMetadata)
@app.post("/api/audio/load",   response_model=AudioMetadata)
async def upload_audio(file: UploadFile = File(...)):
    content = await file.read()
    try:
        meta = await audio_engine.load_from_bytes(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {e}")

    audio_meta = AudioMetadata(**meta)

    # Persist audio file to disk so we can restore it after restarts
    audio_path = str(UPLOADS_DIR / f"{audio_meta.audio_id}{Path(file.filename).suffix}")
    with open(audio_path, "wb") as f:
        f.write(content)

    save_audio_session(meta, audio_path=audio_path)
    asyncio.create_task(_schedule_cleanup())
    return audio_meta


@app.get("/api/audio/{audio_id}/waveform")
async def get_waveform(audio_id: str, points: int = 200):
    # If not in engine cache, try to restore from disk
    try:
        peaks = audio_engine.get_waveform_peaks(audio_id, points)
    except ValueError:
        restored = await _restore_audio(audio_id)
        if not restored:
            raise HTTPException(status_code=404, detail="Audio ID not found.")
        peaks = audio_engine.get_waveform_peaks(audio_id, points)
    return {"audio_id": audio_id, "peaks": peaks}


# ── Hit Detection ──────────────────────────────────────────────────────────────

@app.post("/api/detection/detect", response_model=DetectionResult)
async def detect_hits(req: DetectRequest):
    try:
        y, sr = audio_engine.get_audio(req.audio_id)
    except ValueError:
        restored = await _restore_audio(req.audio_id)
        if not restored:
            raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")
        y, sr = audio_engine.get_audio(req.audio_id)

    raw_hits, elapsed = await hit_engine.detect_hits(
        y=y,
        sr=sr,
        sensitivity=req.sensitivity,
        threshold_db=req.threshold,
        pre_filter_ms=req.pre_filter,
    )

    detection_id = str(uuid.uuid4())
    hits_by_type: dict = {}
    drum_hits = []
    for h in raw_hits:
        drum_hits.append(DrumHit(**h))
        hits_by_type[h["drum_type"]] = hits_by_type.get(h["drum_type"], 0) + 1

    avg_conf = round(
        sum(h["confidence"] for h in raw_hits) / len(raw_hits), 3
    ) if raw_hits else 0.0

    completed_at = datetime.utcnow().isoformat()
    result = DetectionResult(
        detection_id=detection_id,
        audio_id=req.audio_id,
        total_hits=len(drum_hits),
        hits_by_type=hits_by_type,
        confidence=avg_conf,
        processing_time=elapsed,
        hits=drum_hits,
        completed_at=completed_at,
    )

    save_detection_session(result.dict())
    return result


@app.get("/api/detection/{detection_id}", response_model=DetectionResult)
async def get_detection(detection_id: str):
    data = load_detection_session(detection_id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found.")
    return DetectionResult(**data)


# ── Sessions ───────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def get_sessions(limit: int = 50):
    return list_sessions(limit=limit)


@app.get("/api/sessions/{detection_id}/load")
async def load_session(detection_id: str):
    detection_data = load_detection_session(detection_id)
    if not detection_data:
        raise HTTPException(status_code=404, detail="Session not found.")

    audio_data = load_audio_session(detection_data["audio_id"])
    if not audio_data:
        raise HTTPException(status_code=404, detail="Audio metadata not found for session.")

    # Restore audio into engine cache if needed
    try:
        audio_engine.get_audio(audio_data["audio_id"])
    except ValueError:
        await _restore_audio(audio_data["audio_id"])

    audio_meta = {k: v for k, v in audio_data.items() if k != "audio_path"}
    detection_result = DetectionResult(**detection_data)

    return {
        "audio": audio_meta,
        "detection": detection_result,
    }


# ── Drum Replacement ───────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class ReplacementRequest(_BaseModel):
    detection_id: str
    kit_id: str = "rock"
    keep_original: bool = True
    kit_level: float = 0.8


@app.post("/api/replacement/process")
async def process_replacement(req: ReplacementRequest):
    data = load_detection_session(req.detection_id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found. Run hit detection first.")

    result = DetectionResult(**data)

    try:
        y, sr = audio_engine.get_audio(result.audio_id)
    except ValueError:
        restored = await _restore_audio(result.audio_id)
        if not restored:
            raise HTTPException(status_code=404, detail="Original audio not found. Please re-upload the audio file.")
        y, sr = audio_engine.get_audio(result.audio_id)

    hits_raw = [h.dict() for h in result.hits]

    wav_bytes = replacement_engine.process(
        y=y,
        sr=sr,
        hits=hits_raw,
        kit_id=req.kit_id,
        keep_original=req.keep_original,
        kit_level=req.kit_level,
    )

    mode = "augmented" if req.keep_original else "replaced"
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'attachment; filename="drumtracker_{mode}_{req.detection_id[:8]}.wav"'
        },
    )


# ── MIDI Export ────────────────────────────────────────────────────────────────

@app.get("/api/export/midi/{detection_id}")
async def export_midi(detection_id: str, tempo: int = 120):
    data = load_detection_session(detection_id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found.")

    result = DetectionResult(**data)
    hits_raw = [h.dict() for h in result.hits]
    midi_bytes = midi_engine.generate_midi(hits_raw, tempo=tempo)

    return Response(
        content=midi_bytes,
        media_type="audio/midi",
        headers={
            "Content-Disposition": f'attachment; filename="drumtracker_{detection_id[:8]}.mid"'
        },
    )


# ── Format Conversion (FFmpeg background jobs) ─────────────────────────────────

from pydantic import BaseModel as _BM2

class ConvertRequest(_BM2):
    audio_id: str
    target_format: str = "mp3"
    bitrate: str = "192k"


@app.post("/api/convert/start")
async def start_conversion(req: ConvertRequest):
    try:
        y, sr = audio_engine.get_audio(req.audio_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")

    meta = load_audio_session(req.audio_id)
    source_name = meta["file_name"] if meta else "audio"

    try:
        job_id = await conversion_engine.start_job(
            y=y, sr=sr,
            source_filename=source_name,
            target_format=req.target_format,
            bitrate=req.bitrate,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {"job_id": job_id, "status": "running", "format": req.target_format}


@app.get("/api/convert/{job_id}/status")
async def conversion_status(job_id: str):
    job = conversion_engine.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "job_id":   job["job_id"],
        "status":   job["status"],
        "format":   job["format"],
        "filename": job["filename"],
        "error":    job.get("error"),
    }


@app.get("/api/convert/{job_id}/download")
async def download_conversion(job_id: str):
    job = conversion_engine.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job is {job['status']}, not done yet.")
    path = job["output_path"]
    if not Path(path).exists():
        raise HTTPException(status_code=410, detail="Output file no longer available.")
    return FileResponse(
        path=path,
        media_type="application/octet-stream",
        filename=job["filename"],
    )


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _restore_audio(audio_id: str) -> bool:
    audio_data = load_audio_session(audio_id)
    if not audio_data or not audio_data.get("audio_path"):
        return False
    audio_path = audio_data["audio_path"]
    if not Path(audio_path).exists():
        return False
    with open(audio_path, "rb") as f:
        content = f.read()
    await audio_engine.load_from_bytes_with_id(content, audio_data["file_name"], audio_id)
    return True


# ── Serve built React frontend (production) ────────────────────────────────────

_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        index = _DIST / "index.html"
        return FileResponse(str(index))
