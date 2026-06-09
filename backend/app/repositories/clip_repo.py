from __future__ import annotations

import sqlite3

from models.clip import ClipOut, ClipCreate, ClipUpdate


class ClipRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def list_all(self) -> list[ClipOut]:
        rows = self._conn.execute("SELECT * FROM clips ORDER BY created_at DESC").fetchall()
        return [ClipOut.model_validate(dict(r)) for r in rows]

    def get_by_id(self, clip_id: int) -> ClipOut | None:
        row = self._conn.execute("SELECT * FROM clips WHERE id=?", [clip_id]).fetchone()
        return ClipOut.model_validate(dict(row)) if row else None

    def create(self, data: ClipCreate) -> ClipOut:
        cur = self._conn.execute(
            "INSERT INTO clips (audio_id, audio_title, start_time, end_time, text, note, color) VALUES (?,?,?,?,?,?,?)",
            [data.audio_id, data.audio_title, data.start_time, data.end_time, data.text, data.note, data.color],
        )
        self._conn.commit()
        return self.get_by_id(cur.lastrowid)

    def update(self, clip_id: int, data: ClipUpdate) -> ClipOut | None:
        existing = self.get_by_id(clip_id)
        if not existing:
            return None
        updates = data.model_dump(exclude_none=True)
        if not updates:
            return existing
        sets = ", ".join(f"{k}=?" for k in updates)
        values = list(updates.values()) + [clip_id]
        self._conn.execute(f"UPDATE clips SET {sets} WHERE id=?", values)
        self._conn.commit()
        return self.get_by_id(clip_id)

    def delete(self, clip_id: int) -> bool:
        cur = self._conn.execute("DELETE FROM clips WHERE id=?", [clip_id])
        self._conn.commit()
        return cur.rowcount > 0
