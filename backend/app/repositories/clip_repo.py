from __future__ import annotations

import hashlib
import sqlite3

from models.clip import ClipOut, ClipCreate, ClipUpdate


def _resolve_ai(clip: ClipOut, translations: dict[str, str]) -> ClipOut:
    h = hashlib.md5(clip.text.encode()).hexdigest()
    if h in translations:
        clip.ai_analysis = translations[h]
    return clip


def _fetch_translations(conn: sqlite3.Connection) -> dict[str, str]:
    """Return {source_hash: translated_text} for all clip translations."""
    rows = conn.execute(
        "SELECT source_hash, translated_text FROM translations WHERE source_type='clip'"
    ).fetchall()
    return {r[0]: r[1] for r in rows}


class ClipRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def list_all(self) -> list[ClipOut]:
        rows = self._conn.execute("SELECT * FROM clips ORDER BY created_at DESC").fetchall()
        trans = _fetch_translations(self._conn)
        clips = [ClipOut.model_validate(dict(r)) for r in rows]
        return [_resolve_ai(c, trans) for c in clips]

    def get_by_id(self, clip_id: int) -> ClipOut | None:
        row = self._conn.execute("SELECT * FROM clips WHERE id=?", [clip_id]).fetchone()
        if not row:
            return None
        clip = ClipOut.model_validate(dict(row))
        trans = _fetch_translations(self._conn)
        return _resolve_ai(clip, trans)

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
