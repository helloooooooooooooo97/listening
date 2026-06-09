from __future__ import annotations

import sqlite3
from typing import Any


class ProgressRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def add_dictation(self, audio_id: str, audio_title: str, sentence_index: int, score: float, user_input: str, expected_text: str) -> int:
        cur = self._conn.execute(
            "INSERT INTO dictation_history (audio_id, audio_title, sentence_index, score, user_input, expected_text) VALUES (?,?,?,?,?,?)",
            [audio_id, audio_title, sentence_index, score, user_input, expected_text],
        )
        self._conn.commit()
        return cur.lastrowid

    def add_play_history(self, audio_id: str, audio_title: str, duration_seconds: float) -> None:
        self._conn.execute(
            "INSERT INTO play_history (audio_id, audio_title, duration_seconds) VALUES (?,?,?)",
            [audio_id, audio_title, duration_seconds],
        )
        self._conn.commit()

    def upsert_audio_progress(self, audio_id: str, audio_title: str, completed: bool = False, last_position: float = 0, total_seconds: float = 0) -> None:
        existing = self._conn.execute(
            "SELECT id FROM audio_progress WHERE audio_id=?", [audio_id]
        ).fetchone()
        if existing:
            self._conn.execute(
                "UPDATE audio_progress SET completed=?, last_position=?, total_seconds=total_seconds+?, updated_at=datetime('now') WHERE audio_id=?",
                [int(completed), last_position, total_seconds, audio_id],
            )
        else:
            self._conn.execute(
                "INSERT INTO audio_progress (audio_id, audio_title, completed, last_position, total_seconds) VALUES (?,?,?,?,?)",
                [audio_id, audio_title, int(completed), last_position, total_seconds],
            )
        self._conn.commit()

    def get_known_words(self) -> list[str]:
        rows = self._conn.execute(
            "SELECT word FROM word_progress WHERE known=1 ORDER BY reviewed_at DESC"
        ).fetchall()
        return [r[0] for r in rows]
