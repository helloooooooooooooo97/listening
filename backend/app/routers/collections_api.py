"""Collections API — saved playlists, both dynamic (auto-generated) and manual."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn, locked
from services import get_lesson, list_lessons

router = APIRouter(prefix="/api/collections", tags=["collections"])


# ── Schemas ──

class CollectionCreate(BaseModel):
    name: str
    icon: str = 'HiQueueList'
    color: str = '#3b82f6'


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class ItemCreate(BaseModel):
    item_type: str  # 'audio' | 'clip' | 'sentence' | 'word'
    item_ref: str
    lesson_id: str = ''
    lesson_title: str = ''
    title: str = ''
    subtitle: str = ''
    start_time: float = 0
    end_time: float = 0
    extra_data: str = '{}'


class ReorderPayload(BaseModel):
    item_ids: list[int]


# ── Category config ──
CATEGORY_CONFIG: dict[str, tuple[str, str, str]] = {
    'IELTS': ('IELTS', 'HiBookOpen', '#fa2d48'),
    "Aesop's Fables": ('伊索寓言', 'HiBookOpen', '#f59e0b'),
    'Other': ('📂 其他', 'HiFolderOpen', '#3b82f6'),
}


# ── Dynamic Queries ──

DYNAMIC_QUERIES = {
    'favorites': """
        SELECT item_id AS item_ref, item_type, title, subtitle, extra_data,
               '' AS lesson_id, '' AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM favorites
        WHERE item_type IN ('audio', 'clip')
        ORDER BY created_at DESC
    """,
    'today_practice': """
        SELECT DISTINCT audio_id AS item_ref, 'audio' AS item_type,
               audio_title AS title, '' AS subtitle, '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM play_history
        WHERE date(played_at) = date('now')
        ORDER BY played_at DESC
    """,
    'recent_dictation_errors': """
        SELECT audio_id || ':' || sentence_index AS item_ref,
               'sentence' AS item_type,
               expected_text AS title, audio_title AS subtitle,
               '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM dictation_history
        WHERE score < 80
        GROUP BY audio_id, sentence_index
        HAVING MAX(created_at)
        ORDER BY MAX(created_at) DESC
        LIMIT 100
    """,
    'recent_plays': """
        SELECT audio_id AS item_ref, 'audio' AS item_type,
               audio_title AS title, '' AS subtitle, '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM play_history
        GROUP BY audio_id
        HAVING MAX(played_at)
        ORDER BY MAX(played_at) DESC
        LIMIT 50
    """,
    'frequent_wrong_words': """
        SELECT word AS item_ref, 'word' AS item_type,
               word AS title,
               printf('出错 %d 次', COUNT(*)) AS subtitle,
               '{}' AS extra_data,
               '' AS lesson_id, '' AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM (
            SELECT LOWER(TRIM(value)) AS word, dh.audio_id
            FROM dictation_history dh,
                 json_each('["' || REPLACE(dh.expected_text, ' ', '","') || '"]')
            WHERE dh.score < 80
              AND dh.expected_text != ''
        )
        WHERE word != ''
        GROUP BY word
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        LIMIT 50
    """,
    'all_audio': """
        SELECT audio_id AS item_ref, 'audio' AS item_type,
               audio_title AS title, '' AS subtitle, '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM audio_progress
        ORDER BY updated_at DESC
    """,
    'all_clips': """
        SELECT id AS item_ref, 'clip' AS item_type,
               text AS title, audio_title AS subtitle,
               '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               start_time, end_time
        FROM clips
        ORDER BY created_at DESC
    """,
    'all_words': """
        SELECT word AS item_ref, 'word' AS item_type,
               word AS title,
               printf('掌握 · 复习 %d 次', reviewed_count) AS subtitle,
               '{}' AS extra_data,
               '' AS lesson_id, '' AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM word_progress
        WHERE known = 1
        ORDER BY reviewed_at DESC
        LIMIT 200
    """,
    'all_dictation': """
        SELECT audio_id || ':' || sentence_index AS item_ref,
               'sentence' AS item_type,
               expected_text AS title, audio_title AS subtitle,
               '{}' AS extra_data,
               audio_id AS lesson_id, audio_title AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM dictation_history
        GROUP BY audio_id, sentence_index
        HAVING MAX(created_at)
        ORDER BY MAX(created_at) DESC
        LIMIT 200
    """,
}


# ── Category-based collections (computed from lesson data) ──

_CATEGORY_LESSONS_CACHE: dict[str, list[dict]] | None = None


def _get_category_items() -> dict[str, list[dict]]:
    """Group all lessons by category. Returns lists of item dicts keyed by category name."""
    global _CATEGORY_LESSONS_CACHE
    if _CATEGORY_LESSONS_CACHE is not None:
        return _CATEGORY_LESSONS_CACHE

    groups: dict[str, list[dict]] = {}
    for lesson in list_lessons():
        cat = lesson.category or 'Other'
        if cat not in groups:
            groups[cat] = []
        groups[cat].append({
            "id": 0,
            "collection_id": 0,
            "item_type": "audio",
            "item_ref": lesson.id,
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "title": lesson.title,
            "subtitle": lesson.subtitle,
            "start_time": 0,
            "end_time": 0,
            "extra_data": "{}",
            "sort_order": len(groups[cat]),
            "added_at": "",
        })
    _CATEGORY_LESSONS_CACHE = groups
    return groups


def _build_category_collections() -> list[dict]:
    """Build synthetic collection summaries for each category."""
    groups = _get_category_items()
    result = []
    sort_base = 100  # after all seeded collections
    for i, (cat, items) in enumerate(groups.items()):
        name, icon, color = CATEGORY_CONFIG.get(cat, (cat, 'HiFolderOpen', '#3b82f6'))
        # Use negative IDs to avoid DB clashes
        result.append({
            "id": -(i + 1),
            "name": name,
            "icon": icon,
            "color": color,
            "is_dynamic": True,
            "dynamic_type": f"category:{cat}",
            "item_count": len(items),
            "sort_order": sort_base + i,
            "created_at": "",
            "updated_at": "",
        })
    return result


# ── Helpers ──

def _resolve_items(conn, collection_id: int, is_dynamic: bool, dynamic_type: Optional[str]) -> list[dict]:
    """Return resolved items for a collection."""
    # Handle category-based collections (negative IDs from synthetic data)
    if is_dynamic and dynamic_type and dynamic_type.startswith("category:"):
        cat = dynamic_type[len("category:"):]
        groups = _get_category_items()
        return groups.get(cat, [])

    if is_dynamic and dynamic_type and dynamic_type in DYNAMIC_QUERIES:
        rows = conn.execute(DYNAMIC_QUERIES[dynamic_type]).fetchall()
        items = [
            {
                "id": 0,
                "collection_id": collection_id,
                "item_type": r["item_type"],
                "item_ref": r["item_ref"],
                "lesson_id": r["lesson_id"] or "",
                "lesson_title": r["lesson_title"] or "",
                "title": r["title"] or "",
                "subtitle": r["subtitle"] or "",
                "start_time": r["start_time"] or 0,
                "end_time": r["end_time"] or 0,
                "extra_data": r["extra_data"] or "{}",
                "sort_order": i,
                "added_at": "",
            }
            for i, r in enumerate(rows)
        ]

        if dynamic_type in ('recent_dictation_errors', 'all_dictation'):
            _resolve_sentence_times(items)
        if dynamic_type == 'favorites':
            _resolve_clip_extra(items)

        return items

    # Static collection
    rows = conn.execute(
        "SELECT * FROM collection_items WHERE collection_id=? ORDER BY sort_order, added_at",
        [collection_id],
    ).fetchall()
    return [dict(r) for r in rows]


def _resolve_sentence_times(items: list[dict]):
    """Populate start_time/end_time for sentence-type items from lesson transcript."""
    lesson_cache: dict[str, dict] = {}
    for item in items:
        if item["item_type"] != "sentence":
            continue
        lesson_id = item["lesson_id"]
        if not lesson_id:
            continue

        if lesson_id not in lesson_cache:
            lesson = get_lesson(lesson_id)
            if not lesson:
                continue
            lesson_cache[lesson_id] = lesson

        lesson = lesson_cache[lesson_id]
        try:
            sentence_index = int(item["item_ref"].split(":")[-1])
        except (IndexError, ValueError):
            continue

        if 0 <= sentence_index < len(lesson.transcript):
            sent = lesson.transcript[sentence_index]
            item["start_time"] = sent.start
            item["end_time"] = sent.end
            if not item["title"]:
                item["title"] = sent.text



def _resolve_clip_extra(items: list[dict]):
    """Parse extra_data JSON for clip items to populate lesson_id, start_time, end_time."""
    import json
    for item in items:
        if item["item_type"] != "clip":
            continue
        try:
            data = json.loads(item.get("extra_data") or "{}")
            if data.get("lessonId"):
                item["lesson_id"] = data["lessonId"]
            if data.get("start"):
                item["start_time"] = data["start"]
            if data.get("end"):
                item["end_time"] = data["end"]
        except (json.JSONDecodeError, TypeError):
            pass
def _update_item_count(conn, collection_id: int):
    count = conn.execute(
        "SELECT COUNT(*) FROM collection_items WHERE collection_id=?",
        [collection_id],
    ).fetchone()[0]
    conn.execute(
        "UPDATE collections SET item_count=?, updated_at=datetime('now') WHERE id=?",
        [count, collection_id],
    )


# ── Endpoints ──


@router.get("/")
@locked
def list_collections():
    """Return all collections (dynamic + manual + category) with item counts."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM collections ORDER BY sort_order, id"
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        if d["is_dynamic"] and d["dynamic_type"] and d["dynamic_type"] in DYNAMIC_QUERIES:
            items = conn.execute(DYNAMIC_QUERIES[d["dynamic_type"]]).fetchall()
            d["item_count"] = len(items)
        result.append(d)

    # Append synthetic category collections
    result.extend(_build_category_collections())

    return result


@router.post("/", status_code=201)
@locked
def create_collection(data: CollectionCreate):
    """Create a new user-defined collection."""
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO collections (name, icon, color, is_dynamic) VALUES (?,?,?,0)",
        [data.name, data.icon, data.color],
    )
    conn.commit()
    row = conn.execute("SELECT * FROM collections WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.get("/{collection_id}")
@locked
def get_collection(collection_id: int):
    """Return collection detail with resolved items."""
    conn = get_conn()

    # Synthetic category collection (negative ID)
    if collection_id < 0:
        for syn in _build_category_collections():
            if syn["id"] == collection_id:
                syn["items"] = _resolve_items(conn, collection_id, True, syn["dynamic_type"])
                syn["item_count"] = len(syn["items"])
                return syn
        raise HTTPException(status_code=404, detail="Collection not found")

    row = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")

    col = dict(row)
    items = _resolve_items(conn, collection_id, col["is_dynamic"], col["dynamic_type"])
    col["items"] = items
    col["item_count"] = len(items)
    return col


@router.put("/{collection_id}")
@locked
def update_collection(collection_id: int, data: CollectionUpdate):
    """Update collection metadata (name, icon, color)."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = get_conn()
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")

    updates = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.icon is not None:
        updates["icon"] = data.icon
    if data.color is not None:
        updates["color"] = data.color
    if not updates:
        return dict(existing)

    sets = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [collection_id]
    conn.execute(f"UPDATE collections SET {sets}, updated_at=datetime('now') WHERE id=?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    return dict(row)


@router.delete("/{collection_id}")
@locked
def delete_collection(collection_id: int):
    """Delete a collection and its items (CASCADE)."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot delete category collection")
    conn = get_conn()
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot delete dynamic collection")
    conn.execute("DELETE FROM collections WHERE id=?", [collection_id])
    conn.commit()
    return {"ok": True}


@router.post("/{collection_id}/refresh")
@locked
def refresh_collection(collection_id: int):
    """Re-resolve items for a dynamic collection and return them."""
    if collection_id < 0:
        # Refresh category cache
        global _CATEGORY_LESSONS_CACHE
        _CATEGORY_LESSONS_CACHE = None
        for syn in _build_category_collections():
            if syn["id"] == collection_id:
                items = _resolve_items(None, collection_id, True, syn["dynamic_type"])
                return {"items": items, "item_count": len(items)}
        raise HTTPException(status_code=404, detail="Collection not found")

    conn = get_conn()
    row = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not row["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Only dynamic collections can be refreshed")

    items = _resolve_items(conn, collection_id, True, row["dynamic_type"])
    return {"items": items, "item_count": len(items)}


@router.post("/{collection_id}/items", status_code=201)
@locked
def add_item(collection_id: int, data: ItemCreate):
    """Add an item to a static collection."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = get_conn()
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
    _update_item_count(conn, collection_id)
    conn.commit()
    row = conn.execute("SELECT * FROM collection_items WHERE id=?", [cur.lastrowid]).fetchone()
    return dict(row)


@router.delete("/{collection_id}/items/{item_id}")
@locked
def remove_item(collection_id: int, item_id: int):
    """Remove an item from a static collection."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = get_conn()
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    conn.execute("DELETE FROM collection_items WHERE id=? AND collection_id=?", [item_id, collection_id])
    conn.commit()
    _update_item_count(conn, collection_id)
    conn.commit()
    return {"ok": True}


@router.put("/{collection_id}/items/reorder")
@locked
def reorder_items(collection_id: int, data: ReorderPayload):
    """Batch-update sort_order for items in a static collection."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = get_conn()
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
@locked
def clear_items(collection_id: int):
    """Remove all items from a static collection."""
    if collection_id < 0:
        raise HTTPException(status_code=400, detail="Cannot modify category collection")
    conn = get_conn()
    existing = conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Collection not found")
    if existing["is_dynamic"]:
        raise HTTPException(status_code=400, detail="Cannot modify dynamic collection")
    conn.execute("DELETE FROM collection_items WHERE collection_id=?", [collection_id])
    conn.commit()
    _update_item_count(conn, collection_id)
    conn.commit()
    return {"ok": True}
