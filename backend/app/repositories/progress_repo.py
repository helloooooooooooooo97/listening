from __future__ import annotations

import sqlite3
from typing import Any


class ProgressRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    # ── Dictation ──

    def add_dictation(self, audio_id: str, audio_title: str, sentence_index: int, score: float, user_input: str, expected_text: str) -> int:
        cur = self._conn.execute(
            "INSERT INTO dictation_history (audio_id, audio_title, sentence_index, score, user_input, expected_text) VALUES (?,?,?,?,?,?)",
            [audio_id, audio_title, sentence_index, score, user_input, expected_text],
        )
        self._conn.commit()
        return cur.lastrowid

    def update_dictation_progress(self, audio_id: str, audio_title: str, score: float) -> None:
        """Update audio_progress dictation count and average score after a dictation."""
        row = self._conn.execute(
            "SELECT dictation_count, dictation_avg_score FROM audio_progress WHERE audio_id=?", [audio_id]
        ).fetchone()
        if row:
            new_count = row["dictation_count"] + 1
            new_avg = (row["dictation_avg_score"] * row["dictation_count"] + score) / new_count
            self._conn.execute(
                "UPDATE audio_progress SET dictation_count=?, dictation_avg_score=?, completed=1, updated_at=unixepoch() WHERE audio_id=?",
                [new_count, round(new_avg, 1), audio_id],
            )
        else:
            self._conn.execute(
                "INSERT INTO audio_progress (audio_id, audio_title, dictation_count, dictation_avg_score, completed) VALUES (?,?,1,?,1)",
                [audio_id, audio_title, score],
            )
        self._conn.commit()

    # ── Play History ──

    def add_play_history(self, audio_id: str, audio_title: str, duration_seconds: float) -> None:
        self._conn.execute(
            "INSERT INTO play_history (audio_id, audio_title, duration_seconds) VALUES (?,?,?)",
            [audio_id, audio_title, duration_seconds],
        )
        self._conn.commit()

    def list_play_history(self, limit: int = 100) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM play_history ORDER BY played_at DESC LIMIT ?", [limit]
        ).fetchall()
        return [dict(r) for r in rows]

    def upsert_play_progress(self, audio_id: str, audio_title: str, duration_seconds: float) -> None:
        """Update audio_progress total_seconds after a play event."""
        existing = self._conn.execute(
            "SELECT total_seconds FROM audio_progress WHERE audio_id=?", [audio_id]
        ).fetchone()
        if existing:
            self._conn.execute(
                "UPDATE audio_progress SET total_seconds=total_seconds+?, updated_at=unixepoch() WHERE audio_id=?",
                [duration_seconds, audio_id],
            )
        else:
            self._conn.execute(
                "INSERT INTO audio_progress (audio_id, audio_title, total_seconds) VALUES (?,?,?)",
                [audio_id, audio_title, duration_seconds],
            )
        self._conn.commit()

    # ── Audio Progress ──

    def upsert_audio_progress(self, audio_id: str, audio_title: str, completed: bool = False, last_position: float = 0, total_seconds: float = 0) -> None:
        existing = self._conn.execute(
            "SELECT id FROM audio_progress WHERE audio_id=?", [audio_id]
        ).fetchone()
        if existing:
            self._conn.execute(
                "UPDATE audio_progress SET completed=?, last_position=?, total_seconds=total_seconds+?, updated_at=unixepoch() WHERE audio_id=?",
                [int(completed), last_position, total_seconds, audio_id],
            )
        else:
            self._conn.execute(
                "INSERT INTO audio_progress (audio_id, audio_title, completed, last_position, total_seconds) VALUES (?,?,?,?,?)",
                [audio_id, audio_title, int(completed), last_position, total_seconds],
            )
        self._conn.commit()

    # ── Word Progress ──

    def get_known_words(self) -> list[str]:
        rows = self._conn.execute(
            "SELECT word FROM word_progress WHERE known=1 ORDER BY reviewed_at DESC"
        ).fetchall()
        return [r[0] for r in rows]

    def set_word_known(self, word: str, known: bool) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO word_progress (word, known, reviewed_count, reviewed_at) "
            "VALUES (?,?,COALESCE((SELECT reviewed_count FROM word_progress WHERE word=?),0)+1,unixepoch())",
            [word, 1 if known else 0, word],
        )
        self._conn.commit()

    # ── Review System ──

    def add_review(self, word: str, score: float) -> None:
        """Record a word review session. Updates review count, score, and timestamp."""
        self._conn.execute(
            "INSERT INTO word_progress (word, known, reviewed_count, last_score, reviewed_at) "
            "VALUES (?,1,1,?,unixepoch()) "
            "ON CONFLICT(word) DO UPDATE SET "
            "  reviewed_count=reviewed_count+1, last_score=?, reviewed_at=unixepoch(), known=1",
            [word, score, score],
        )
        self._conn.commit()

    def get_due_words(self, limit: int = 20) -> list[dict]:
        """Return words due for review, sorted by urgency.

        Priority:
        1. Known words with low score (< 60) — highest urgency
        2. Known words not reviewed recently (oldest reviewed_at first)
        3. Known words never reviewed (reviewed_count = 0)
        """
        rows = self._conn.execute("""
            SELECT word, reviewed_count, last_score, reviewed_at
            FROM word_progress
            WHERE known=1
            ORDER BY
              CASE WHEN last_score IS NOT NULL AND last_score < 60 THEN 0 ELSE 1 END,
              CASE WHEN last_score IS NOT NULL THEN last_score ELSE 100 END ASC,
              reviewed_at ASC
            LIMIT ?
        """, [limit]).fetchall()
        return [dict(r) for r in rows]

    # ── Daily Words ──

    def record_listened_words(self, words: list[str], audio_id: str, audio_title: str) -> None:
        """Record words that were actually heard in a play session."""
        today = self._get_today_date()
        from text_utils import clean_word
        for w in words:
            cleaned = clean_word(w)
            if not cleaned:
                continue
            self._conn.execute(
                "INSERT OR IGNORE INTO listened_words (word, audio_id, audio_title, listened_date) VALUES (?,?,?,?)",
                [cleaned, audio_id, audio_title, today],
            )
        self._conn.commit()

    def _get_today_date(self) -> str:
        row = self._conn.execute("SELECT date('now') AS d").fetchone()
        return row["d"] if row else ""

    def get_today_words(self) -> list[dict]:
        """Return today's listened words with progress info, sorted by frequency."""
        return [dict(r) for r in self._conn.execute("""
            SELECT lw.word,
                   COUNT(DISTINCT lw.audio_id) AS audio_count,
                   GROUP_CONCAT(DISTINCT lw.audio_title) AS audio_titles,
                   COALESCE(wp.known, 0) AS known,
                   wp.last_score,
                   wp.reviewed_at
            FROM listened_words lw
            LEFT JOIN word_progress wp ON wp.word = lw.word
            WHERE lw.listened_date = date('now')
            GROUP BY lw.word
            ORDER BY audio_count DESC, lw.word ASC
        """).fetchall()]

    def get_today_stats(self) -> dict:
        """Return today's word stats: total words, audio count, reviewed count."""
        stats = self._conn.execute("""
            SELECT COUNT(DISTINCT word) AS total_words,
                   COUNT(DISTINCT audio_id) AS audio_count
            FROM listened_words
            WHERE listened_date = date('now')
        """).fetchone()
        reviewed = self._conn.execute("""
            SELECT COUNT(DISTINCT lw.word) AS reviewed_count
            FROM listened_words lw
            JOIN word_progress wp ON wp.word = lw.word
            WHERE lw.listened_date = date('now')
              AND wp.reviewed_at >= unixepoch() - 86400
        """).fetchone()
        return {
            "total_words": stats["total_words"] if stats else 0,
            "audio_count": stats["audio_count"] if stats else 0,
            "reviewed_count": reviewed["reviewed_count"] if reviewed else 0,
        }

    def get_due_words_count(self) -> int:
        """Count of words due for review."""
        row = self._conn.execute("""
            SELECT COUNT(*) FROM word_progress
            WHERE known=1
              AND (last_score IS NULL OR last_score < 80)
        """).fetchone()
        return row[0] if row else 0

    # ── Batch Review ──

    def batch_review(self, session_id: str, source: str, mode: str, results: list[dict]) -> dict:
        """Record a batch of review results: write to review_history + update word_progress.

        Returns { reviewed: N, correct: M }.
        """
        correct = 0
        for r in results:
            word = r["word"]
            score = float(r["score"])
            is_correct = 1 if score >= 80 else 0
            if is_correct:
                correct += 1
            # Insert review_history row
            self._conn.execute(
                "INSERT INTO review_history (word, session_id, source, mode, correct, score, session_index) VALUES (?,?,?,?,?,?,?)",
                [word, session_id, source, mode, is_correct, score, r.get("session_index", 0)],
            )
            # Update word_progress
            self._conn.execute(
                "INSERT INTO word_progress (word, known, reviewed_count, last_score, reviewed_at) "
                "VALUES (?,1,1,?,unixepoch()) "
                "ON CONFLICT(word) DO UPDATE SET "
                "  reviewed_count=reviewed_count+1, last_score=?, reviewed_at=unixepoch(), known=1",
                [word, score, score],
            )
        self._conn.commit()
        return {"reviewed": len(results), "correct": correct}

    def get_review_history(self, limit: int = 50) -> list[dict]:
        """Return recent review sessions, grouped by session_id."""
        rows = self._conn.execute("""
            SELECT session_id, source, mode, COUNT(*) AS word_count,
                   SUM(correct) AS correct_count,
                   ROUND(AVG(score), 1) AS avg_score,
                   MIN(created_at) AS created_at
            FROM review_history
            GROUP BY session_id
            ORDER BY created_at DESC
            LIMIT ?
        """, [limit]).fetchall()
        return [dict(r) for r in rows]

    def get_review_stats(self) -> dict:
        """Return today's review stats and overall accuracy."""
        today = self._get_today_date()
        # Today's stats
        today_row = self._conn.execute("""
            SELECT COUNT(*) AS total, SUM(correct) AS correct
            FROM review_history
            WHERE date(created_at, 'unixepoch') = date('now')
        """).fetchone()
        # Streak: consecutive days with reviews
        streak_rows = self._conn.execute("""
            SELECT DISTINCT date(created_at, 'unixepoch') AS d
            FROM review_history
            ORDER BY d DESC
            LIMIT 90
        """).fetchall()
        streak = 0
        from datetime import datetime, timedelta
        today_dt = datetime.now().date()
        for i, row in enumerate(streak_rows):
            expected = today_dt - timedelta(days=i)
            if datetime.strptime(row["d"], "%Y-%m-%d").date() == expected:
                streak += 1
            else:
                break
        return {
            "today_reviewed": today_row["total"] if today_row else 0,
            "today_correct": today_row["correct"] if today_row and today_row["correct"] else 0,
            "streak": streak,
        }
