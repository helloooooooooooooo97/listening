from __future__ import annotations

import hashlib
import sqlite3
from typing import Any

from models.translation import TranslationIn, TranslationOut


class TranslationRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    @staticmethod
    def _hash_text(text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()

    def get(self, source_type: str, source_text: str) -> TranslationOut | None:
        h = self._hash_text(source_text)
        row = self._conn.execute(
            "SELECT id, source_text, translated_text, source_type, extra_data FROM translations WHERE source_hash=? AND source_type=?",
            [h, source_type],
        ).fetchone()
        if not row:
            return None
        return TranslationOut(id=row[0], source_text=row[1], translated_text=row[2], source_type=row[3], extra_data=row[4])

    def upsert(self, data: TranslationIn) -> TranslationOut:
        h = self._hash_text(data.source_text)
        existing = self._conn.execute(
            "SELECT id FROM translations WHERE source_hash=? AND source_type=?",
            [h, data.source_type],
        ).fetchone()

        extra = data.extra_data
        extra_json = extra if isinstance(extra, str) else str(extra) if extra else None

        if existing:
            row_id = existing[0]
            self._conn.execute(
                "UPDATE translations SET translated_text=?, extra_data=?, updated_at=unixepoch() WHERE id=?",
                [data.translated_text, extra_json, row_id],
            )
        else:
            cur = self._conn.execute(
                "INSERT INTO translations (source_hash, source_text, translated_text, source_type, extra_data) VALUES (?,?,?,?,?)",
                [h, data.source_text, data.translated_text, data.source_type, extra_json],
            )
            row_id = cur.lastrowid
        self._conn.commit()

        row = self._conn.execute(
            "SELECT id, source_text, translated_text, source_type, extra_data FROM translations WHERE id=?",
            [row_id],
        ).fetchone()
        return TranslationOut(id=row[0], source_text=row[1], translated_text=row[2], source_type=row[3], extra_data=row[4])
