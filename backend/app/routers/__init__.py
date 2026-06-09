"""Routers — centralized registration of all API routers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from services import get_audio_path, get_lesson, get_stats, list_lessons

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("/stats")
def get_lesson_stats():
    """Return global stats including unique word count."""
    return get_stats()


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


# ── Collect all routers for centralized registration in main.py ──

from .clips import router as clips_router
from .favorites import router as favorites_router
from .translation import router as translation_router
from .words import router as words_router
from .progress_api import router as progress_router
from .stats_api import router as stats_router
from .import_api import router as import_router
from .collections_api import router as collections_router

routers = [
    router,             # lessons
    clips_router,
    favorites_router,
    translation_router,
    words_router,
    progress_router,
    stats_router,
    import_router,
    collections_router,
]
