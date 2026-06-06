"""Favorites API — unified favorites for audio, clips, and words."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from database import get_conn, locked

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


class FavoriteCreate(BaseModel):
    item_id: str
    item_type: str  # 'audio' | 'clip' | 'word'
    title: str = ''
    subtitle: str = ''
    extra_data: str = '{}'


@router.get("/")
@locked
def list_favorites():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM favorites ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/", status_code=201)
@locked
def add_favorite(data: FavoriteCreate):
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO favorites (item_id, item_type, title, subtitle, extra_data) VALUES (?,?,?,?,?)",
            [data.item_id, data.item_type, data.title, data.subtitle, data.extra_data],
        )
        conn.commit()
        row = conn.execute("SELECT * FROM favorites WHERE id=?", [cur.lastrowid]).fetchone()
        return dict(row)
    except Exception:
        conn.rollback()
        return {"ok": False, "error": "already exists"}


@router.delete("/{fav_id}")
@locked
def remove_favorite(fav_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM favorites WHERE id=?", [fav_id])
    conn.commit()
    return {"ok": True}


@router.delete("/by-item/{item_type}/{item_id}")
@locked
def remove_favorite_by_item(item_type: str, item_id: str):
    conn = get_conn()
    conn.execute("DELETE FROM favorites WHERE item_type=? AND item_id=?", [item_type, item_id])
    conn.commit()
    return {"ok": True}
