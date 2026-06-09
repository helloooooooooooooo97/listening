from __future__ import annotations

import sqlite3

from models.favorite import FavoriteOut, FavoriteCreate


class FavoriteRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def list_all(self) -> list[FavoriteOut]:
        rows = self._conn.execute("SELECT * FROM favorites ORDER BY created_at DESC").fetchall()
        return [FavoriteOut.model_validate(dict(r)) for r in rows]

    def add(self, data: FavoriteCreate) -> FavoriteOut | dict:
        try:
            cur = self._conn.execute(
                "INSERT INTO favorites (item_id, item_type, title, subtitle, extra_data) VALUES (?,?,?,?,?)",
                [data.item_id, data.item_type, data.title, data.subtitle, data.extra_data],
            )
            self._conn.commit()
            return self.get_by_id(cur.lastrowid)
        except sqlite3.IntegrityError:
            self._conn.rollback()
            return {"ok": False, "error": "already exists"}

    def get_by_id(self, fav_id: int) -> FavoriteOut | None:
        row = self._conn.execute("SELECT * FROM favorites WHERE id=?", [fav_id]).fetchone()
        return FavoriteOut.model_validate(dict(row)) if row else None

    def remove(self, fav_id: int) -> bool:
        cur = self._conn.execute("DELETE FROM favorites WHERE id=?", [fav_id])
        self._conn.commit()
        return cur.rowcount > 0

    def remove_by_item(self, item_type: str, item_id: str) -> bool:
        cur = self._conn.execute("DELETE FROM favorites WHERE item_type=? AND item_id=?", [item_type, item_id])
        self._conn.commit()
        return cur.rowcount > 0
