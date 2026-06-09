"""Clips CRUD API backed by SQLite."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn, locked

router = APIRouter(prefix="/api/clips", tags=["clips"])


class ClipCreate(BaseModel):
    audio_id: str
    audio_title: str
    start_time: float
    end_time: float
    text: str
    note: str = ""
    color: str = "#facc15"


class ClipUpdate(BaseModel):
    text: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None


@router.get("/")
@locked
def list_clips():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM clips ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/", status_code=201)
@locked
def create_clip(data: ClipCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO clips (audio_id, audio_title, start_time, end_time, text, note, color) VALUES (?,?,?,?,?,?,?)",
        [data.audio_id, data.audio_title, data.start_time, data.end_time, data.text, data.note, data.color],
    )
    conn.commit()
    row = conn.execute("SELECT * FROM clips WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.put("/{clip_id}")
@locked
def update_clip(clip_id: int, data: ClipUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM clips WHERE id=?", [clip_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Clip not found")

    updates = {}
    if data.text is not None:
        updates["text"] = data.text
    if data.note is not None:
        updates["note"] = data.note
    if data.color is not None:
        updates["color"] = data.color

    if not updates:
        return dict(existing)

    sets = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [clip_id]
    conn.execute(f"UPDATE clips SET {sets} WHERE id=?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM clips WHERE id=?", [clip_id]).fetchone()
    return dict(row)


@router.delete("/{clip_id}")
@locked
def delete_clip(clip_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM clips WHERE id=?", [clip_id])
    conn.commit()
    return {"ok": True}
