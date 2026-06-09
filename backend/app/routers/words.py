"""Words API — precomputed cache, refreshed on demand."""
from __future__ import annotations

import re
from collections import defaultdict

from fastapi import APIRouter, Query

from services import LESSONS_DIR, _load_lesson

router = APIRouter(prefix="/api", tags=["words"])

PUNCT = re.compile(r"^[.,!?;:\-\"'`]+|[.,!?;:\-\"'`]+$")

# ── Cache ──
_cache: list[dict] | None = None
_cache_total: int = 0
_cache_cat_map: dict[str, str] = {}  # lesson_id → category


def _clean(word: str) -> str:
    return PUNCT.sub('', word.strip().lower())


def _build_cache():
    """Precompute word index from all lesson JSONs."""
    global _cache, _cache_total, _cache_cat_map
    from services import list_lessons
    _cache_cat_map = {lesson.id: lesson.category or 'Other' for lesson in list_lessons()}

    word_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "lessons": defaultdict(list)})

    if LESSONS_DIR.exists():
        for json_file in sorted(LESSONS_DIR.glob("*.json")):
            try:
                lesson = _load_lesson(json_file)
                for w in lesson.words:
                    word = _clean(w.text)
                    if not word:
                        continue
                    entry = word_map[word]
                    entry["count"] += 1
                    entry["lessons"][lesson.id].append({
                        "title": lesson.title,
                        "start": round(w.start, 2),
                    })
            except Exception:
                continue

    words = [
        {
            "word": word,
            "count": data["count"],
            "lessons": [
                {"id": lid, "title": times[0]["title"], "occurrences": [t["start"] for t in times]}
                for lid, times in data["lessons"].items()
            ],
        }
        for word, data in word_map.items()
    ]
    # Pre-sort by frequency desc
    words.sort(key=lambda x: x["count"], reverse=True)
    _cache = words
    _cache_total = len(words)


def _ensure_cache():
    if _cache is None:
        _build_cache()


@router.get("/words")
def get_words(
    q: str = Query(default="", description="Search query"),
    sort: str = Query(default="freq", description="Sort: freq or alpha"),
    order: str = Query(default="desc", description="Order: asc or desc"),
    limit: int = Query(default=200, ge=10, le=1000),
    offset: int = Query(default=0, ge=0),
    category: str = Query(default="", description="Filter by lesson category (IELTS, Aesop's Fables, etc)"),
    collection: str = Query(default="", description="Filter by smart collection type (all_clips, favorites, etc)"),
):
    """Return deduplicated word list (lightweight — only word + count)."""
    _ensure_cache()

    # Resolve collection → lesson IDs
    collection_lesson_ids: set[str] | None = None
    if collection:
        # Handle category-based collections (category:IELTS → category filter)
        if collection.startswith("category:"):
            category = collection[len("category:"):]
            collection = ""
        from database import get_conn
        import json as _json
        from services.collection_service import DYNAMIC_QUERIES
        sql = DYNAMIC_QUERIES.get(collection)
        if sql:
            conn = get_conn()
            rows = conn.execute(sql).fetchall()
            collection_lesson_ids = set()
            for r in rows:
                lid = r["lesson_id"] if r["lesson_id"] else None
                if not lid:
                    # Try extra_data for clip favorites
                    try:
                        extra = r["extra_data"]
                        if extra:
                            ed = _json.loads(extra)
                            lid = ed.get("lessonId")
                    except (_json.JSONDecodeError, TypeError):
                        pass
                if not lid and collection in ('favorites', 'all_audio', 'today_practice'):
                    # For audio-type items, item_ref is the lesson ID
                    lid = r["item_ref"]
                if lid:
                    collection_lesson_ids.add(lid)

    # Filter
    filtered = _cache
    if q:
        filtered = [w for w in filtered if q.lower() in w["word"]]
    if category:
        filtered = [
            w for w in filtered
            if any(_cache_cat_map.get(l["id"]) == category for l in w["lessons"])
        ]
    if collection_lesson_ids is not None:
        filtered = [
            w for w in filtered
            if any(l["id"] in collection_lesson_ids for l in w["lessons"])
        ]

    # Sort
    desc = order != "asc"
    if sort == "alpha":
        filtered.sort(key=lambda x: x["word"], reverse=desc)
    else:
        filtered.sort(key=lambda x: x["count"], reverse=desc)

    total = len(filtered)
    page = filtered[offset:offset + limit]
    # Lightweight response — only word + count; occurrences are fetched on demand
    return {
        "total": total,
        "words": [{"word": w["word"], "count": w["count"]} for w in page],
    }


@router.get("/words/{word}")
def get_word_detail(word: str):
    """Return full word detail with lesson occurrences (audio timestamps)."""
    _ensure_cache()
    # Binary search on sorted cache (words are sorted by count desc, so linear scan)
    for w in _cache:
        if w["word"] == word:
            return w
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
