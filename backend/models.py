from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
import uuid


class DrumHit(BaseModel):
    id: str = ""
    timestamp: float
    drum_type: str
    velocity: int
    confidence: float
    frequency_centroid: Optional[float] = None


class AudioMetadata(BaseModel):
    audio_id: str
    file_name: str
    sample_rate: int
    channels: int
    duration: float
    format: str
    total_frames: int


class DetectRequest(BaseModel):
    audio_id: str
    sensitivity: float = 0.7
    threshold: float = -18.0
    pre_filter: int = 15
    classification_mode: str = "default"


class DetectionResult(BaseModel):
    detection_id: str
    audio_id: str
    total_hits: int
    hits_by_type: Dict[str, int] = {}
    confidence: float
    processing_time: float
    hits: List[DrumHit] = []
    completed_at: str = ""


class ExportRequest(BaseModel):
    detection_id: str
    tempo: int = 120
    time_signature_num: int = 4
    time_signature_den: int = 4
