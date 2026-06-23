import os
import uuid
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

# In-memory session store
_audio_sessions: dict = {}   # audio_id -> AudioMetadata
_detection_sessions: dict = {}  # detection_id -> DetectionResult


@app.on_event("startup")
async def startup():
    await audio_engine.initialize()
    await hit_engine.initialize()


# ── Audio ──────────────────────────────────────────────────────────────────────

@app.post("/api/audio/upload", response_model=AudioMetadata)
async def upload_audio(file: UploadFile = File(...)):
    content = await file.read()
    try:
        meta = await audio_engine.load_from_bytes(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {e}")
    audio_meta = AudioMetadata(**meta)
    _audio_sessions[audio_meta.audio_id] = audio_meta
    return audio_meta


@app.get("/api/audio/{audio_id}/waveform")
async def get_waveform(audio_id: str, points: int = 200):
    try:
        peaks = audio_engine.get_waveform_peaks(audio_id, points)
        return {"audio_id": audio_id, "peaks": peaks}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Hit Detection ──────────────────────────────────────────────────────────────

@app.post("/api/detection/detect", response_model=DetectionResult)
async def detect_hits(req: DetectRequest):
    try:
        y, sr = audio_engine.get_audio(req.audio_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")

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

    result = DetectionResult(
        detection_id=detection_id,
        audio_id=req.audio_id,
        total_hits=len(drum_hits),
        hits_by_type=hits_by_type,
        confidence=avg_conf,
        processing_time=elapsed,
        hits=drum_hits,
        completed_at=datetime.utcnow().isoformat(),
    )
    _detection_sessions[detection_id] = result
    return result


@app.get("/api/detection/{detection_id}", response_model=DetectionResult)
async def get_detection(detection_id: str):
    result = _detection_sessions.get(detection_id)
    if not result:
        raise HTTPException(status_code=404, detail="Detection ID not found.")
    return result


# ── MIDI Export ────────────────────────────────────────────────────────────────

@app.get("/api/export/midi/{detection_id}")
async def export_midi(detection_id: str, tempo: int = 120):
    result = _detection_sessions.get(detection_id)
    if not result:
        raise HTTPException(status_code=404, detail="Detection ID not found.")

    hits_raw = [h.dict() for h in result.hits]
    midi_bytes = midi_engine.generate_midi(hits_raw, tempo=tempo)

    return Response(
        content=midi_bytes,
        media_type="audio/midi",
        headers={
            "Content-Disposition": f'attachment; filename="drumtracker_{detection_id[:8]}.mid"'
        },
    )


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Serve built React frontend (production) ────────────────────────────────────

_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        index = _DIST / "index.html"
        return FileResponse(str(index))
