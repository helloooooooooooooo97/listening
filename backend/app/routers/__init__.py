from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from services import get_audio_path, get_lesson, list_lessons

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("/")
def get_lesson_list():
    """Return summaries of all available lessons."""
    return list_lessons()


@router.get("/{lesson_id}")
def get_lesson_detail(lesson_id: str):
    """Return full lesson data including transcript and word timestamps."""
    lesson = get_lesson(lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail=f"Lesson '{lesson_id}' not found")
    return lesson


@router.get("/{lesson_id}/audio")
def get_lesson_audio(lesson_id: str):
    """Stream the audio file for a lesson."""
    audio_path = get_audio_path(lesson_id)
    if audio_path is None:
        raise HTTPException(status_code=404, detail=f"Audio for lesson '{lesson_id}' not found")
    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=f"{lesson_id}.mp3",
    )
