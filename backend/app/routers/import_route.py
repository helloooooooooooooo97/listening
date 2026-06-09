"""Import API — upload audio and start WhisperX transcription."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from services import LESSONS_DIR
from services.import_service import start_import, get_task

router = APIRouter(prefix="/api/lessons", tags=["import"])

SUPPORTED_FORMATS = {".mp3", ".wav", ".m4a", ".ogg"}


class ImportStatus(BaseModel):
    task_id: str
    status: str  # pending | transcribing | aligning | completed | failed
    progress: float  # 0-100
    error: Optional[str] = None
    lesson_id: Optional[str] = None


@router.post("/import", status_code=201)
async def import_lesson(
    file: UploadFile = File(...),
    title: str = Form(...),
    subtitle: str = Form(""),
    level: str = Form("A2"),
    source_url: str = Form(""),
):
    """Upload audio file and start import process."""
    if not file.filename:
        raise HTTPException(400, "Missing filename")
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(400, f"Unsupported audio format '{ext}'. Supported: {', '.join(SUPPORTED_FORMATS)}")

    audio_id = title.lower().replace(" ", "-").replace("'", "").replace("--", "-")
    audio_filename = f"{audio_id}.mp3"

    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    audio_path = LESSONS_DIR / audio_filename
    content = await file.read()
    audio_path.write_bytes(content)

    task_id = start_import(audio_path, title, subtitle, level, source_url)
    return {"task_id": task_id, "status": "pending"}


@router.get("/import/{task_id}", response_model=ImportStatus)
def get_import_status(task_id: str):
    """Poll import progress."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return ImportStatus(**task)
