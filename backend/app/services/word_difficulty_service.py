from __future__ import annotations

import json
import math
import sqlite3
from collections import defaultdict

from services import LESSONS_DIR, _load_lesson
from text_utils import clean_word


TAG_ORDER = ['CET-4', 'CET-6', 'TEM-4', 'TEM-8', 'IELTS', 'TOEFL']


class WordDifficultyService:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def ensure_computed(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) AS n FROM word_difficulty").fetchone()
        if row and row["n"] > 0:
            return row["n"]
        return self.compute_all()

    def compute_all(self) -> int:
        freq: dict[str, int] = defaultdict(int)
        if LESSONS_DIR.exists():
            for json_file in sorted(LESSONS_DIR.glob("*.json")):
                try:
                    lesson = _load_lesson(json_file)
                except Exception:
                    continue
                for w in lesson.words:
                    word = clean_word(w.text)
                    if word:
                        freq[word] += 1

        if not freq:
            return 0

        tag_map = self._load_tag_map(list(freq.keys()))
        max_log_freq = max(math.log(count + 1) for count in freq.values()) or 1

        self._conn.execute("DELETE FROM word_difficulty")
        rows = []
        for word, count in freq.items():
            tags = tag_map.get(word, [])
            score = self._score(word, count, tags, max_log_freq)
            rows.append((word, score, self._level(score), count, len(word)))

        self._conn.executemany(
            """
            INSERT OR REPLACE INTO word_difficulty
              (word, score, level, freq, length, updated_at)
            VALUES (?,?,?,?,?,unixepoch())
            """,
            rows,
        )
        self._conn.commit()
        return len(rows)

    def get_word_difficulty(self, word: str) -> dict | None:
        cleaned = clean_word(word)
        row = self._conn.execute(
            """
            SELECT wd.word, wd.score, wd.level, wd.freq, wd.length, d.tags
            FROM word_difficulty wd
            LEFT JOIN dictionary d ON d.word = wd.word
            WHERE wd.word=?
            """,
            [cleaned],
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def get_words_by_level(self, level: str | None, offset: int = 0, limit: int = 50) -> dict:
        where = ""
        args: list[object] = []
        if level:
            where = "WHERE wd.level=?"
            args.append(level)

        total = self._conn.execute(
            f"SELECT COUNT(*) AS n FROM word_difficulty wd {where}",
            args,
        ).fetchone()["n"]

        rows = self._conn.execute(
            f"""
            SELECT wd.word, wd.score, wd.level, wd.freq, wd.length, d.tags
            FROM word_difficulty wd
            LEFT JOIN dictionary d ON d.word = wd.word
            {where}
            ORDER BY wd.score DESC, wd.word ASC
            LIMIT ? OFFSET ?
            """,
            [*args, limit, offset],
        ).fetchall()
        return {"total": total, "words": [self._row_to_dict(r) for r in rows]}

    def _load_tag_map(self, words: list[str]) -> dict[str, list[str]]:
        if not words:
            return {}
        tag_map: dict[str, list[str]] = {}
        chunk_size = 800
        for i in range(0, len(words), chunk_size):
            chunk = words[i:i + chunk_size]
            placeholders = ",".join("?" * len(chunk))
            rows = self._conn.execute(
                f"SELECT word, tags FROM dictionary WHERE word IN ({placeholders})",
                chunk,
            ).fetchall()
            for row in rows:
                tag_map[row["word"]] = self._parse_tags(row["tags"])
        return tag_map

    @staticmethod
    def _score(word: str, freq: int, tags: list[str], max_log_freq: float) -> float:
        freq_score = 1 - (math.log(freq + 1) / max_log_freq)
        len_score = min(len(word) / 20.0, 1.0)
        known_tags = [TAG_ORDER.index(t) for t in tags if t in TAG_ORDER]
        exam_score = max(known_tags) / (len(TAG_ORDER) - 1) if known_tags else 0.3
        return round(0.50 * freq_score + 0.30 * len_score + 0.20 * exam_score, 4)

    @staticmethod
    def _level(score: float) -> str:
        if score < 0.33:
            return "easy"
        if score < 0.66:
            return "medium"
        return "hard"

    @staticmethod
    def _parse_tags(raw: str | None) -> list[str]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        return {
            "word": row["word"],
            "score": row["score"],
            "level": row["level"],
            "freq": row["freq"],
            "length": row["length"],
            "tags": self._parse_tags(row["tags"] if "tags" in row.keys() else None),
        }
