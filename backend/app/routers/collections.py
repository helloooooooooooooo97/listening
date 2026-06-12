"""Collections API — uses CollectionService for business logic."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from database import get_conn
from models.collection import CollectionCreate, CollectionUpdate, ItemCreate, ReorderPayload
from services.collection_service import CollectionService

router = APIRouter(prefix="/api/collections", tags=["collections"])


def get_service() -> CollectionService:
    return CollectionService(get_conn())


@router.get("/")
def list_collections(svc: CollectionService = Depends(get_service)):
    return svc.list_collections()


@router.post("/", status_code=201)
def create_collection(data: CollectionCreate, svc: CollectionService = Depends(get_service)):
    conn = svc._conn
    cur = conn.execute(
        "INSERT INTO collections (name, icon, color, is_dynamic) VALUES (?,?,?,0)",
        [data.name, data.icon, data.color],
    )
    conn.commit()
    row = conn.execute("SELECT * FROM collections WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.get("/{collection_id}")
def get_collection(collection_id: int, svc: CollectionService = Depends(get_service)):
    col = svc.get_collection(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return col


@router.put("/{collection_id}")
def update_collection(collection_id: int, data: CollectionUpdate, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")

    updates = data.model_dump(exclude_none=True)
    if not updates:
        return dict(existing)

    sets = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [collection_id]
    conn.execute(f"UPDATE collections SET {sets}, updated_at=unixepoch() WHERE id=?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    return dict(row)


@router.delete("/{collection_id}")
def delete_collection(collection_id: int, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    conn.execute("DELETE FROM collections WHERE id=?", [collection_id])
    conn.commit()
    return {"ok": True}


@router.post("/{collection_id}/refresh")
def refresh_collection(collection_id: int, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        svc.refresh_category_cache()
        from services.collection_service import _build_category_collections
        for syn in _build_category_collections():
            if syn["id"] == collection_id:
                items = svc.resolve_items(collection_id, True, syn["dynamic_type"])
                return {"items": items, "item_count": len(items)}
        raise HTTPException(status_code=404, detail="Collection not found")

    conn = svc._conn
    row = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not row["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Only dynamic collections can be refreshed")

    items = svc.resolve_items(collection_id, True, row["dynamic_type"])
    return {"items": items, "item_count": len(items)}


@router.post("/{collection_id}/items", status_code=201)
def add_item(collection_id: int, data: ItemCreate, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")

    max_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) FROM collection_items WHERE collection_id=?",
        [collection_id],
    ).fetchone()[0]

    cur = conn.execute(
        "INSERT INTO collection_items (collection_id, item_type, item_ref, lesson_id, lesson_title, title, subtitle, start_time, end_time, extra_data, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [collection_id, data.item_type, data.item_ref, data.lesson_id, data.lesson_title,
         data.title, data.subtitle, data.start_time, data.end_time, data.extra_data, max_order + 1],
    )
    conn.commit()
    svc._update_item_count(collection_id)
    conn.commit()
    row = conn.execute("SELECT * FROM collection_items WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.delete("/{collection_id}/items/{item_id}")
def remove_item(collection_id: int, item_id: int, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    conn.execute("DELETE FROM collection_items WHERE id=? AND collection_id=?", [item_id, collection_id])
    conn.commit()
    svc._update_item_count(collection_id)
    conn.commit()
    return {"ok": True}


@router.put("/{collection_id}/items/reorder")
def reorder_items(collection_id: int, data: ReorderPayload, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    for i, item_id in enumerate(data.item_ids):
        conn.execute(
            "UPDATE collection_items SET sort_order=? WHERE id=? AND collection_id=?",
            [i, item_id, collection_id],
        )
    conn.commit()
    return {"ok": True}


@router.delete("/{collection_id}/items")
def clear_items(collection_id: int, svc: CollectionService = Depends(get_service)):
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = svc._conn
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    conn.execute("DELETE FROM collection_items WHERE collection_id=?", [collection_id])
    conn.commit()
    svc._update_item_count(collection_id)
    conn.commit()
    return {"ok": True}
