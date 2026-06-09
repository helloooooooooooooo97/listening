from __future__ import annotations

import json
import os
import re
from pathlib import Path

from models import LessonSummary, ListeningLesson

LESSONS_DIR = Path(__file__).resolve().parent.parent / "data" / "lessons"

# ── Module-level cache (invalidate when any .json mtime changes) ──
_cache: dict[str, object] = {}
_cache_mtime: float = 0


def _refresh_if_stale() -> bool:
    """Check if any lesson JSON changed; return True if cache is still fresh."""
    global _cache_mtime
    if not LESSONS_DIR.exists():
        return False
    try:
        latest = max(f.stat().st_mtime for f in LESSONS_DIR.iterdir() if f.suffix == ".json")
    except (OSError, ValueError):
        return False
    if latest <= _cache_mtime:
        return True  # cache is fresh
    # Invalidate
    _cache.clear()
    _cache_mtime = latest
    return False


def _load_lesson(json_file: Path) -> ListeningLesson:
    data = json.loads(json_file.read_text(encoding="utf-8"))
    return ListeningLesson(**data)


def _build_summary(lesson: ListeningLesson) -> LessonSummary:
    return LessonSummary(
        id=lesson.id,
        title=lesson.title,
        subtitle=lesson.subtitle,
        category=_derive_category(lesson),
        level=lesson.level,
        duration=lesson.duration,
        audioFileName=lesson.audioFileName,
        sourceURL=lesson.sourceURL,
        textSourceURL=lesson.textSourceURL,
        sentenceCount=len(lesson.transcript),
        wordCount=len(lesson.words),
    )


def _derive_category(lesson: ListeningLesson) -> str:
    sub = lesson.subtitle.lower()
    if 'ielts' in sub or 'cambridge ielts' in sub:
        return 'IELTS'
    if 'aesop' in sub or 'fable' in sub or 'fable' in lesson.title.lower():
        return "Aesop's Fables"
    return 'Other'


def list_lessons() -> list[LessonSummary]:
    """Return a summary list of all available lessons (cached)."""
    if _refresh_if_stale() and 'summaries' in _cache:
        return _cache['summaries']  # type: ignore[return-value]

    summaries: list[LessonSummary] = []
    if not LESSONS_DIR.exists():
        _cache['summaries'] = summaries
        return summaries

    for json_file in sorted(LESSONS_DIR.glob("*.json")):
        try:
            lesson = _load_lesson(json_file)
            summaries.append(_build_summary(lesson))
        except Exception:
            continue

    _cache['summaries'] = summaries
    return summaries


def get_lesson(lesson_id: str) -> ListeningLesson | None:
    """Load a full lesson by its ID (cached per lesson)."""
    key = f"lesson:{lesson_id}"
    if _refresh_if_stale() and key in _cache:
        return _cache[key]  # type: ignore[return-value]

    json_file = LESSONS_DIR / f"{lesson_id}.json"
    if not json_file.exists():
        _cache[key] = None
        return None
    lesson = _load_lesson(json_file)
    _cache[key] = lesson
    return lesson


def get_audio_path(lesson_id: str) -> Path | None:
    """Get the filesystem path to the lesson's audio file."""
    lesson = get_lesson(lesson_id)
    if lesson is None:
        return None
    audio_path = LESSONS_DIR / lesson.audioFileName
    if not audio_path.exists():
        return None
    return audio_path


def get_stats() -> dict:
    """Return stats including unique word count across all lessons (cached)."""
    if _refresh_if_stale() and 'stats' in _cache:
        return _cache['stats']  # type: ignore[return-value]

    all_words: set[str] = set()
    total_sentences = 0
    lesson_count = 0

    if not LESSONS_DIR.exists():
        result = {"lessonCount": 0, "totalSentences": 0, "uniqueWords": 0}
        _cache['stats'] = result
        return result

    for json_file in sorted(LESSONS_DIR.glob("*.json")):
        try:
            lesson = _load_lesson(json_file)
            lesson_count += 1
            total_sentences += len(lesson.transcript)
            for w in lesson.words:
                word = w.text.strip().lower()
                word = re.sub(r'^[.,!?;:\-"' "'—]+", '', word)
                word = re.sub(r'[.,!?;:\-"' "'—]+$", '', word)
                if word:
                    all_words.add(word)
        except Exception:
            continue

    result = {
        "lessonCount": lesson_count,
        "totalSentences": total_sentences,
        "uniqueWords": len(all_words),
    }
    _cache['stats'] = result
    return result
