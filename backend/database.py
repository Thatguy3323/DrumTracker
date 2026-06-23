import json
from pathlib import Path
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime

DB_PATH = Path(__file__).parent / "drumtracker.db"
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class AudioSessionRow(Base):
    __tablename__ = "audio_sessions"

    audio_id = Column(String, primary_key=True)
    file_name = Column(String, nullable=False)
    sample_rate = Column(Integer, nullable=False)
    channels = Column(Integer, nullable=False)
    duration = Column(Float, nullable=False)
    format = Column(String, nullable=False)
    total_frames = Column(Integer, nullable=False)
    audio_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DetectionSessionRow(Base):
    __tablename__ = "detection_sessions"

    detection_id = Column(String, primary_key=True)
    audio_id = Column(String, nullable=False)
    total_hits = Column(Integer, nullable=False)
    hits_by_type_json = Column(Text, nullable=False, default="{}")
    confidence = Column(Float, nullable=False)
    processing_time = Column(Float, nullable=False)
    hits_json = Column(Text, nullable=False, default="[]")
    completed_at = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def save_audio_session(meta: dict, audio_path: str | None = None):
    with SessionLocal() as db:
        row = AudioSessionRow(
            audio_id=meta["audio_id"],
            file_name=meta["file_name"],
            sample_rate=meta["sample_rate"],
            channels=meta["channels"],
            duration=meta["duration"],
            format=meta["format"],
            total_frames=meta["total_frames"],
            audio_path=audio_path,
        )
        db.merge(row)
        db.commit()


def save_detection_session(result: dict):
    with SessionLocal() as db:
        row = DetectionSessionRow(
            detection_id=result["detection_id"],
            audio_id=result["audio_id"],
            total_hits=result["total_hits"],
            hits_by_type_json=json.dumps(result.get("hits_by_type", {})),
            confidence=result["confidence"],
            processing_time=result["processing_time"],
            hits_json=json.dumps([h if isinstance(h, dict) else h.dict() for h in result.get("hits", [])]),
            completed_at=result.get("completed_at", ""),
        )
        db.merge(row)
        db.commit()


def list_sessions(limit: int = 50) -> list[dict]:
    with SessionLocal() as db:
        rows = (
            db.query(DetectionSessionRow)
            .order_by(DetectionSessionRow.created_at.desc())
            .limit(limit)
            .all()
        )
        result = []
        for r in rows:
            audio_row = db.query(AudioSessionRow).filter_by(audio_id=r.audio_id).first()
            audio_path = audio_row.audio_path if audio_row else None
            audio_available = bool(audio_path and Path(audio_path).exists())
            result.append({
                "detection_id": r.detection_id,
                "audio_id": r.audio_id,
                "file_name": audio_row.file_name if audio_row else "Unknown",
                "total_hits": r.total_hits,
                "confidence": r.confidence,
                "completed_at": r.completed_at,
                "duration": audio_row.duration if audio_row else 0,
                "audio_available": audio_available,
                "created_at": audio_row.created_at.isoformat() if audio_row and audio_row.created_at else None,
            })
        return result


def load_audio_session(audio_id: str) -> dict | None:
    with SessionLocal() as db:
        row = db.query(AudioSessionRow).filter_by(audio_id=audio_id).first()
        if not row:
            return None
        return {
            "audio_id": row.audio_id,
            "file_name": row.file_name,
            "sample_rate": row.sample_rate,
            "channels": row.channels,
            "duration": row.duration,
            "format": row.format,
            "total_frames": row.total_frames,
            "audio_path": row.audio_path,
        }


def list_audio_ids_in_db() -> set[str]:
    """Return the set of all audio_ids currently tracked in the database."""
    with SessionLocal() as db:
        rows = db.query(AudioSessionRow.audio_id).all()
        return {r.audio_id for r in rows}


def cleanup_orphaned_uploads(
    max_age_days: int = 30,
    orphan_grace_seconds: int = 600,
) -> tuple[int, int, int, int]:
    """
    Remove files from UPLOADS_DIR that are either:
      - Not referenced by any row in audio_sessions AND older than
        orphan_grace_seconds (default 10 min) — protects in-flight uploads
        that have been written to disk but not yet committed to the DB.
      - Older than max_age_days days (regardless of DB presence).

    Also prunes stale database rows:
      - audio_sessions rows older than max_age_days are deleted.
      - detection_sessions rows whose audio_id no longer exists in
        audio_sessions are deleted (cascade cleanup).

    Returns (orphaned_files, old_files, pruned_audio_rows, pruned_detection_rows).
    """
    import time
    from datetime import timezone

    known_ids = list_audio_ids_in_db()
    now = time.time()
    age_cutoff = now - max_age_days * 86400
    grace_cutoff = now - orphan_grace_seconds

    orphaned = 0
    old = 0

    for filepath in UPLOADS_DIR.iterdir():
        if not filepath.is_file():
            continue

        # Derive the audio_id from the filename stem (UUID before extension)
        audio_id = filepath.stem
        mtime = filepath.stat().st_mtime
        in_db = audio_id in known_ids

        if not in_db and mtime < grace_cutoff:
            # Orphaned and past the grace window — safe to remove
            filepath.unlink(missing_ok=True)
            orphaned += 1
        elif in_db and mtime < age_cutoff:
            # Known to DB but older than the retention limit
            filepath.unlink(missing_ok=True)
            old += 1

    # --- DB row pruning ---
    pruned_audio = 0
    pruned_detections = 0

    age_cutoff_dt = datetime.utcfromtimestamp(age_cutoff)

    with SessionLocal() as db:
        # 1. Delete audio_sessions rows older than the retention cutoff.
        old_audio_rows = (
            db.query(AudioSessionRow)
            .filter(AudioSessionRow.created_at < age_cutoff_dt)
            .all()
        )
        old_audio_ids = {r.audio_id for r in old_audio_rows}
        if old_audio_ids:
            db.query(AudioSessionRow).filter(
                AudioSessionRow.audio_id.in_(old_audio_ids)
            ).delete(synchronize_session=False)
            pruned_audio = len(old_audio_ids)

        # 2. Delete detection_sessions rows whose audio_id no longer exists
        #    in audio_sessions (covers rows just pruned above and any
        #    previously orphaned entries).
        remaining_audio_ids_query = db.query(AudioSessionRow.audio_id)
        orphaned_detections = (
            db.query(DetectionSessionRow)
            .filter(DetectionSessionRow.audio_id.notin_(remaining_audio_ids_query))
            .all()
        )
        if orphaned_detections:
            detection_ids = [r.detection_id for r in orphaned_detections]
            db.query(DetectionSessionRow).filter(
                DetectionSessionRow.detection_id.in_(detection_ids)
            ).delete(synchronize_session=False)
            pruned_detections = len(detection_ids)

        db.commit()

    return orphaned, old, pruned_audio, pruned_detections


def load_detection_session(detection_id: str) -> dict | None:
    with SessionLocal() as db:
        row = db.query(DetectionSessionRow).filter_by(detection_id=detection_id).first()
        if not row:
            return None
        return {
            "detection_id": row.detection_id,
            "audio_id": row.audio_id,
            "total_hits": row.total_hits,
            "hits_by_type": json.loads(row.hits_by_type_json),
            "confidence": row.confidence,
            "processing_time": row.processing_time,
            "hits": json.loads(row.hits_json),
            "completed_at": row.completed_at,
        }
