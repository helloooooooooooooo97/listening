"""Play history and word progress API."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from database import get_conn, locked

router = APIRouter(prefix="/api", tags=["progress"])


# ── Dictation Tracking ──
class DictationCreate(BaseModel):
    audio_id: str
    audio_title: str
    sentence_index: int
    score: float
    user_input: str = ''
    expected_text: str = ''


@router.post("/progress/dictation", status_code=201)
@locked
def add_dictation(data: DictationCreate):
    conn = get_conn()
    conn.execute(
        "INSERT INTO dictation_history (audio_id, audio_title, sentence_index, score, user_input, expected_text) VALUES (?,?,?,?,?,?)",
        [data.audio_id, data.audio_title, data.sentence_index, data.score, data.user_input, data.expected_text],
    )
    # Update audio progress
    row = conn.execute("SELECT dictation_count, dictation_avg_score FROM audio_progress WHERE audio_id=?", [data.audio_id]).fetchone()
    if row:
        new_count = row["dictation_count"] + 1
        new_avg = (row["dictation_avg_score"] * row["dictation_count"] + data.score) / new_count
        conn.execute(
            "UPDATE audio_progress SET dictation_count=?, dictation_avg_score=?, completed=1, updated_at=datetime('now') WHERE audio_id=?",
            [new_count, round(new_avg, 1), data.audio_id],
        )
    else:
        conn.execute(
            "INSERT INTO audio_progress (audio_id, audio_title, dictation_count, dictation_avg_score, completed) VALUES (?,?,1,?,1)",
            [data.audio_id, data.audio_title, data.score],
        )
    conn.commit()
    return {"ok": True}


class PlayCreate(BaseModel):
    audio_id: str
    audio_title: str
    duration_seconds: float = 0


@router.get("/progress/play-history")
@locked
def list_history():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM play_history ORDER BY played_at DESC LIMIT 100").fetchall()
    return [dict(r) for r in rows]


@router.post("/progress/play-history", status_code=201)
@locked
def add_history(data: PlayCreate):
    conn = get_conn()
    conn.execute(
        "INSERT INTO play_history (audio_id, audio_title, duration_seconds) VALUES (?,?,?)",
        [data.audio_id, data.audio_title, data.duration_seconds],
    )
    # Auto-upsert audio_progress
    existing = conn.execute("SELECT total_seconds FROM audio_progress WHERE audio_id=?", [data.audio_id]).fetchone()
    if existing:
        conn.execute(
            "UPDATE audio_progress SET total_seconds=total_seconds+?, updated_at=datetime('now') WHERE audio_id=?",
            [data.duration_seconds, data.audio_id],
        )
    else:
        conn.execute(
            "INSERT INTO audio_progress (audio_id, audio_title, total_seconds) VALUES (?,?,?)",
            [data.audio_id, data.audio_title, data.duration_seconds],
        )
    conn.commit()
    return {"ok": True}


class WordKnownUpdate(BaseModel):
    word: str
    known: bool


@router.get("/progress/words")
@locked
def list_word_progress():
    conn = get_conn()
    rows = conn.execute("SELECT word FROM word_progress WHERE known=1").fetchall()
    return [r["word"] for r in rows]


@router.post("/progress/words")
@locked
def set_word_known(data: WordKnownUpdate):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO word_progress (word, known, reviewed_at) VALUES (?,?,datetime('now'))",
        [data.word, 1 if data.known else 0],
    )
    conn.commit()
    return {"ok": True}
