"""Clips CRUD API backed by SQLite."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from database import get_conn

router = APIRouter(prefix="/api/clips", tags=["clips"])


class ClipCreate(BaseModel):
    audio_id: str
    audio_title: str
    start_time: float
    end_time: float
    text: str
    note: str = ""


@router.get("/")
def list_clips():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM clips ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/", status_code=201)
def create_clip(data: ClipCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO clips (audio_id, audio_title, start_time, end_time, text, note) VALUES (?,?,?,?,?,?)",
        [data.audio_id, data.audio_title, data.start_time, data.end_time, data.text, data.note],
    )
    conn.commit()
    row = conn.execute("SELECT * FROM clips WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.delete("/{clip_id}")
def delete_clip(clip_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM clips WHERE id=?", [clip_id])
    conn.commit()
    return {"ok": True}
