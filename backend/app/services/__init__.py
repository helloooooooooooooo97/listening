from __future__ import annotations

import json
from pathlib import Path

from models import LessonSummary, ListeningLesson

LESSONS_DIR = Path(__file__).resolve().parent.parent / "data" / "lessons"


def list_lessons() -> list[LessonSummary]:
    """Return a summary list of all available lessons."""
    summaries: list[LessonSummary] = []
    if not LESSONS_DIR.exists():
        return summaries

    for json_file in sorted(LESSONS_DIR.glob("*.json")):
        try:
            lesson = _load_lesson(json_file)
            summaries.append(
                LessonSummary(
                    id=lesson.id,
                    title=lesson.title,
                    subtitle=lesson.subtitle,
                    level=lesson.level,
                    duration=lesson.duration,
                    audioFileName=lesson.audioFileName,
                    sourceURL=lesson.sourceURL,
                    textSourceURL=lesson.textSourceURL,
                    sentenceCount=len(lesson.transcript),
                    wordCount=len(lesson.words),
                )
            )
        except Exception:
            continue

    return summaries


def get_lesson(lesson_id: str) -> ListeningLesson | None:
    """Load a full lesson by its ID."""
    json_file = LESSONS_DIR / f"{lesson_id}.json"
    if not json_file.exists():
        return None
    return _load_lesson(json_file)


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
    """Return stats including unique word count across all lessons."""
    all_words: set[str] = set()
    total_sentences = 0
    lesson_count = 0

    if not LESSONS_DIR.exists():
        return {"lessonCount": 0, "totalSentences": 0, "uniqueWords": 0}

    for json_file in sorted(LESSONS_DIR.glob("*.json")):
        try:
            lesson = _load_lesson(json_file)
            lesson_count += 1
            total_sentences += len(lesson.transcript)
            for w in lesson.words:
                word = w.text.strip().lower()
                if word and word not in {".", ",", "!", "?", ";", ":", "-", "\"", "'", "—"}:
                    all_words.add(word)
        except Exception:
            continue

    return {
        "lessonCount": lesson_count,
        "totalSentences": total_sentences,
        "uniqueWords": len(all_words),
    }


def _load_lesson(json_file: Path) -> ListeningLesson:
    data = json.loads(json_file.read_text(encoding="utf-8"))
    return ListeningLesson(**data)
