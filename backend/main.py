import asyncio
import io
import logging
import os
import uuid
import json
import zipfile
from datetime import datetime, timezone  # FIXED: Included explicit timezone awareness
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse, StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth, OAuthError

from models import DetectRequest, DetectionResult, DrumHit, AudioMetadata
from auth import User, get_current_user, test_auth_enabled, TEST_AUTH_COOKIE
from engines.audio_engine import AudioEngine
from engines.hit_detection_engine import HitDetectionEngine
from engines.midi_export_engine import MidiExportEngine
from engines.replacement_engine import DrumReplacementEngine
from engines.conversion_engine import ConversionEngine
from database import (
    init_db, save_audio_session, save_detection_session,
    list_sessions, load_audio_session, load_detection_session,
    cleanup_orphaned_uploads, upsert_user_from_claims,
    UPLOADS_DIR,
)

logger = logging.getLogger("drumtracker")

app = FastAPI(title="DrumTracker API", version="1.0.0")

# FIXED: Hardened CORS configuration to fetch allowed domains from configuration variables instead of wildcards
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", 
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # Crucial for maintaining HttpOnly OIDC sessions safely
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed, HttpOnly session cookie that carries the logged-in user's OIDC id.
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    same_site="lax",     
    https_only=True,     
)

# ── Replit OIDC client (Authlib) ────────────────────────────────────────────────
OIDC_ISSUER = os.environ.get("ISSUER_URL", "https://replit.com/oidc").rstrip("/")

oauth = OAuth()
oauth.register(
    name="replit",
    client_id=os.environ["REPL_ID"],
    server_metadata_url=f"{OIDC_ISSUER}/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid profile email",
        "code_challenge_method": "S256",       
        "token_endpoint_auth_method": "none",  
    },
)


def _oidc_redirect_uri() -> str:
    domains = os.environ.get("REPLIT_DOMAINS", "").strip()
    domain = domains.split(",")[0].strip() if domains else os.environ.get("REPLIT_DEV_DOMAIN", "").strip()
    if not domain:
        raise HTTPException(
            status_code=500,
            detail="No REPLIT_DOMAINS/REPLIT_DEV_DOMAIN configured for OIDC redirect.",
        )
    domain = domain.replace("https://", "").replace("http://", "").rstrip("/")
    return f"https://{domain}/api/callback"


audio_engine = AudioEngine()
hit_engine = HitDetectionEngine()
midi_engine = MidiExportEngine()
replacement_engine = DrumReplacementEngine()
conversion_engine = ConversionEngine()


_cleanup_lock = asyncio.Lock()


def _run_cleanup():
    """Synchronous cleanup worker — called from a thread pool so it never blocks the event loop."""
    try:
        orphaned, old, pruned_audio, pruned_detections = cleanup_orphaned_uploads(
            max_age_days=30, orphan_grace_seconds=600
        )
        if orphaned or old or pruned_audio or pruned_detections:
            logger.info(
                "Cleanup: removed %d orphaned files, %d old files, "
                "%d audio_sessions rows, %d detection_sessions rows.",
                orphaned, old, pruned_audio, pruned_detections,
            )
        else:
            logger.debug("Cleanup: nothing to remove.")
    except Exception:
        logger.exception("Upload cleanup failed.")


async def _schedule_cleanup():
    """Fire-and-forget: run the cleanup in a thread, but skip if a cleanup is already in progress."""
    if _cleanup_lock.locked():
        return
    async with _cleanup_lock:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_cleanup)


async def _prune_conversions_loop():
    """Background loop: prune stale conversion jobs and their temp files every 10 minutes."""
    while True:
        await asyncio.sleep(600)
        try:
            removed = conversion_engine.prune_stale()
            if removed:
                logger.info("Conversion prune: removed %d stale job(s).", removed)
        except Exception:
            logger.exception("Conversion prune failed.")


@app.on_event("startup")
async def startup():
    init_db()
    await audio_engine.initialize()
    await hit_engine.initialize()
    asyncio.create_task(_schedule_cleanup())
    asyncio.create_task(_prune_conversions_loop())


# ── Auth ───────────────────────────────────────────────────────────────────────

@app.get("/api/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "profile_image": user.profile_image,
    }


@app.get("/api/login", include_in_schema=False)
async def login(request: Request):
    request.session.clear()
    redirect_uri = _oidc_redirect_uri()
    return await oauth.replit.authorize_redirect(request, redirect_uri)


@app.get("/api/callback", include_in_schema=False)
async def auth_callback(request: Request):
    try:
        token = await oauth.replit.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(url="/?auth_error=1", status_code=302)

    claims = token.get("userinfo") or {}
    if not claims.get("sub"):
        return RedirectResponse(url="/?auth_error=1", status_code=302)

    profile = upsert_user_from_claims(dict(claims))

    request.session.clear()
    request.session["user_id"] = profile["id"]
    return RedirectResponse(url="/", status_code=302)


@app.post("/api/logout")
async def logout(request: Request):
    request.session.clear()
    response = Response(status_code=204)
    for kwargs in (
        {"path": "/"},
        {"path": "/", "secure": True, "samesite": "none"},
        {"path": "/", "secure": True, "samesite": "lax"},
    ):
        response.delete_cookie("REPL_AUTH", **kwargs)
    response.delete_cookie(TEST_AUTH_COOKIE, path="/")
    response.delete_cookie(TEST_AUTH_COOKIE, path="/", secure=True, samesite="lax")
    return response


@app.get("/api/__test/login", include_in_schema=False)
async def test_login(username: str = "Test User"):
    if not test_auth_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        TEST_AUTH_COOKIE,
        username,
        path="/",
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return response


# ── Audio ──────────────────────────────────────────────────────────────────────

@app.post("/api/audio/upload", response_model=AudioMetadata)
@app.post("/api/audio/load",   response_model=AudioMetadata)
async def upload_audio(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    content = await file.read()
    try:
        meta = await audio_engine.load_from_bytes(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {e}")

    audio_meta = AudioMetadata(**meta)

    audio_path = str(UPLOADS_DIR / f"{audio_meta.audio_id}{Path(file.filename).suffix}")
    with open(audio_path, "wb") as f:
        f.write(content)

    save_audio_session(meta, user_id=user.id, audio_path=audio_path)
    asyncio.create_task(_schedule_cleanup())
    return audio_meta


@app.get("/api/audio/{audio_id}/waveform")
async def get_waveform(audio_id: str, points: int = 200, user: User = Depends(get_current_user)):
    if not load_audio_session(audio_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Audio ID not found.")
    try:
        peaks = audio_engine.get_waveform_peaks(audio_id, points)
    except ValueError:
        restored = await _restore_audio(audio_id, user_id=user.id)
        if not restored:
            raise HTTPException(status_code=404, detail="Audio ID not found.")
        peaks = audio_engine.get_waveform_peaks(audio_id, points)
    return {"audio_id": audio_id, "peaks": peaks}


# ── Hit Detection ──────────────────────────────────────────────────────────────

@app.post("/api/detection/detect", response_model=DetectionResult)
async def detect_hits(req: DetectRequest, user: User = Depends(get_current_user)):
    if not load_audio_session(req.audio_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")
    try:
        y, sr = audio_engine.get_audio(req.audio_id)
    except ValueError:
        restored = await _restore_audio(req.audio_id, user_id=user.id)
        if not restored:
            raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")
        y, sr = audio_engine.get_audio(req.audio_id)

    (raw_hits, elapsed), tempo_bpm = await asyncio.gather(
        hit_engine.detect_hits(
            y=y,
            sr=sr,
            sensitivity=req.sensitivity,
            threshold_db=req.threshold,
            pre_filter_ms=req.pre_filter,
        ),
        hit_engine.detect_tempo(y=y, sr=sr),
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

    completed_at = datetime.now(timezone.utc).isoformat()  # FIXED: Modern timezone awareness
    result = DetectionResult(
        detection_id=detection_id,
        audio_id=req.audio_id,
        total_hits=len(drum_hits),
        hits_by_type=hits_by_type,
        confidence=avg_conf,
        processing_time=elapsed,
        hits=drum_hits,
        completed_at=completed_at,
        tempo_bpm=tempo_bpm,
    )

    save_detection_session(result.dict(), user_id=user.id)
    return result


@app.get("/api/detection/{detection_id}", response_model=DetectionResult)
async def get_detection(detection_id: str, user: User = Depends(get_current_user)):
    data = load_detection_session(detection_id, user_id=user.id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found.")
    return DetectionResult(**data)


# ── Sessions ───────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def get_sessions(limit: int = 50, user: User = Depends(get_current_user)):
    return list_sessions(user_id=user.id, limit=limit)


@app.get("/api/sessions/{detection_id}/load")
async def load_session(detection_id: str, user: User = Depends(get_current_user)):
    detection_data = load_detection_session(detection_id, user_id=user.id)
    if not detection_data:
        raise HTTPException(status_code=404, detail="Session not found.")

    audio_data = load_audio_session(detection_data["audio_id"], user_id=user.id)
    if not audio_data:
        raise HTTPException(status_code=404, detail="Audio metadata not found for session.")

    try:
        audio_engine.get_audio(audio_data["audio_id"])
    except ValueError:
        await _restore_audio(audio_data["audio_id"], user_id=user.id)

    audio_meta = {k: v for k, v in audio_data.items() if k != "audio_path"}
    detection_result = DetectionResult(**detection_data)

    return {
        "audio": audio_meta,
        "detection": detection_result,
    }


@app.get("/api/sessions/{detection_id}/export")
async def export_session(detection_id: str, user: User = Depends(get_current_user)):
    detection_data = load_detection_session(detection_id, user_id=user.id)
    if not detection_data:
        raise HTTPException(status_code=404, detail="Session not found.")

    audio_data = load_audio_session(detection_data["audio_id"], user_id=user.id)
    if not audio_data:
        raise HTTPException(status_code=404, detail="Audio metadata not found for session.")

    audio_path = audio_data.get("audio_path")
    if not audio_path or not Path(audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk — it may have been pruned.")

    hits_json_bytes = json.dumps(detection_data, indent=2).encode("utf-8")

    audio_filename = Path(audio_path).name
    short_id = detection_id[:8]
    zip_filename = f"drumtracker_session_{short_id}.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(audio_path, arcname=audio_filename)
        zf.writestr(f"hits_{short_id}.json", hits_json_bytes)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


# ── Drum Replacement ───────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class ReplacementRequest(_BaseModel):
    detection_id: str
    kit_id: str = "rock"
    keep_original: bool = True
    kit_level: float = 0.8


@app.post("/api/replacement/process")
async def process_replacement(req: ReplacementRequest, user: User = Depends(get_current_user)):
    data = load_detection_session(req.detection_id, user_id=user.id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found. Run hit detection first.")

    result = DetectionResult(**data)

    try:
        y, sr = audio_engine.get_audio(result.audio_id)
    except ValueError:
        restored = await _restore_audio(result.audio_id, user_id=user.id)
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
async def export_midi(
    detection_id: str, 
    tempo: int = 120, 
    time_sig_num: int = 4,   # FIXED: Exposed customizable time signature numerator parameters
    time_sig_den: int = 4,   # FIXED: Exposed customizable time signature denominator parameters
    user: User = Depends(get_current_user)
):
    data = load_detection_session(detection_id, user_id=user.id)
    if not data:
        raise HTTPException(status_code=404, detail="Detection ID not found.")

    result = DetectionResult(**data)
    hits_raw = [h.dict() for h in result.hits]
    
    # Leverages safe power-of-two validations applied inside the updated MidiExportEngine
    midi_bytes = midi_engine.generate_midi(
        hits_raw, 
        tempo=tempo, 
        time_sig_num=time_sig_num, 
        time_sig_den=time_sig_den
    )

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
async def start_conversion(req: ConvertRequest, user: User = Depends(get_current_user)):
    meta = load_audio_session(req.audio_id, user_id=user.id)
    if not meta:
        raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")

    try:
        y, sr = audio_engine.get_audio(req.audio_id)
    except ValueError:
        restored = await _restore_audio(req.audio_id, user_id=user.id)
        if not restored:
            raise HTTPException(status_code=404, detail="Audio ID not found. Upload audio first.")
        y, sr = audio_engine.get_audio(req.audio_id)

    source_name = meta["file_name"] if meta else "audio"

    try:
        # Properly triggers value validation checks added to ConversionEngine
        job_id = await conversion_engine.start_job(
            y=y, sr=sr,
            source_filename=source_name,
            target_format=req.target_format,
            bitrate=req.bitrate,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    job = conversion_engine.get_job(job_id)
    if job is not None:
        job["user_id"] = user.id

    return {"job_id": job_id, "status": "running", "format": req.target_format}


@app.get("/api/convert/{job_id}/status")
async def conversion_status(job_id: str, user: User = Depends(get_current_user)):
    job = conversion_engine.get_job(job_id)
    if not job or job.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "job_id":   job["job_id"],
        "status":   job["status"],
        "format":   job["format"],
        "filename": job["filename"],
        "error":    job.get("error"),
    }


@app.get("/api/convert/{job_id}/download")
async def download_conversion(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    job = conversion_engine.get_job(job_id)
    if not job or job.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job is {job['status']}, not done yet.")
    path = job["output_path"]
    if not Path(path).exists():
        raise HTTPException(status_code=410, detail="Output file no longer available.")
    background_tasks.add_task(conversion_engine.cleanup_job, job_id)
    return FileResponse(
        path=path,
        media_type="application/octet-stream",
        filename=job["filename"],
        background=background_tasks,
    )


# ── Session Import ─────────────────────────────────────────────────────────────

@app.post("/api/sessions/import")
async def import_session(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=422, detail="File must be a .zip archive.")

    content = await file.read()
    try:
        buf = io.BytesIO(content)
        zf = zipfile.ZipFile(buf, "r")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=422, detail="Not a valid ZIP file.")

    names = zf.namelist()
    
    # FIXED: Comprehensive Path Traversal (Zip Slip) security guard & format extension whitelist check
    VALID_AUDIO_EXTS = {".wav", ".mp3", ".flac", ".ogg", ".aiff"}
    for name in names:
        if ".." in name or name.startswith("/") or name.startswith("\\"):
            raise HTTPException(status_code=400, detail="Security boundary violation: Malicious path escaping found in archive contents.")

    audio_name = next(
        (n for n in names if Path(n).suffix.lower() in VALID_AUDIO_EXTS),
        None,
    )
    hits_name = next((n for n in names if n.lower().endswith(".json") and Path(n).name.startswith("hits_")), None)

    if not audio_name:
        raise HTTPException(status_code=422, detail="ZIP archive does not contain a supported audio format file.")
    if not hits_name:
        raise HTTPException(status_code=422, detail="ZIP archive does not contain a valid transient hits JSON configuration.")

    audio_bytes = zf.read(audio_name)
    hits_bytes = zf.read(hits_name)

    try:
        hits_data = json.loads(hits_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse hits JSON in ZIP.")

    try:
        meta = await audio_engine.load_from_bytes(audio_bytes, audio_name)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {e}")

    new_audio_id = meta["audio_id"]
    audio_path = str(UPLOADS_DIR / f"{new_audio_id}{Path(audio_name).suffix}")
    with open(audio_path, "wb") as f:
        f.write(audio_bytes)
    save_audio_session(meta, user_id=user.id, audio_path=audio_path)

    new_detection_id = str(uuid.uuid4())
    imported_at = datetime.now(timezone.utc).isoformat()  # FIXED: Non-deprecated timezone explicit timestamp

    hits_list = hits_data.get("hits", [])
    hits_by_type: dict = {}
    for h in hits_list:
        dt = h.get("drum_type", "unknown")
        hits_by_type[dt] = hits_by_type.get(dt, 0) + 1

    total_hits = hits_data.get("total_hits", len(hits_list))
    confidence = hits_data.get("confidence", 0.0)
    processing_time = hits_data.get("processing_time", 0.0)

    detection_payload = {
        "detection_id": new_detection_id,
        "audio_id": new_audio_id,
        "total_hits": total_hits,
        "hits_by_type": hits_by_type,
        "confidence": confidence,
        "processing_time": processing_time,
        "hits": hits_list,
        "completed_at": imported_at,
    }
    save_detection_session(detection_payload, user_id=user.id)

    asyncio.create_task(_schedule_cleanup())

    return {
        "detection_id": new_detection_id,
        "audio_id": new_audio_id,
        "file_name": meta.get("file_name", audio_name),
        "total_hits": total_hits,
        "confidence": confidence,
        "completed_at": imported_at,
        "duration": meta.get("duration", 0),
    }


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _restore_audio(audio_id: str, user_id: str) -> bool:
    audio_data = load_audio_session(audio_id, user_id=user_id)
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
