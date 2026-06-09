"""Words API — precomputed cache, refreshed on demand."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Query

from services import LESSONS_DIR, _load_lesson
from text_utils import clean_word

router = APIRouter(prefix="/api", tags=["words"])

# ── Cache ──
_cache: list[dict] | None = None
_cache_total: int = 0
_cache_cat_map: dict[str, str] = {}  # lesson_id → category


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
                    word = clean_word(w.text)
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

    # Resolve collection → lesson IDs or word names
    collection_word_set: set[str] | None = None
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
            # Check if collection returns words directly (e.g. all_words, today_words)
            if rows and rows[0]["item_type"] == "word":
                collection_word_set = {r["item_ref"] for r in rows}
            else:
                collection_lesson_ids = set()
                for r in rows:
                    lid = r["lesson_id"] if r["lesson_id"] else None
                    if not lid:
                        try:
                            extra = r["extra_data"]
                            if extra:
                                ed = _json.loads(extra)
                                lid = ed.get("lessonId")
                        except (_json.JSONDecodeError, TypeError):
                            pass
                    if not lid and collection in ('favorites', 'all_audio', 'today_practice'):
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
    if collection_word_set is not None:
        filtered = [w for w in filtered if w["word"] in collection_word_set]
    elif collection_lesson_ids is not None:
        if collection_lesson_ids:
            filtered = [
                w for w in filtered
                if any(l["id"] in collection_lesson_ids for l in w["lessons"])
            ]
        else:
            # Audio/clip collection with no resolved IDs → empty result
            filtered = []

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
    cleaned = clean_word(word)
    for w in _cache:
        if w["word"] == cleaned:
            return w
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Word '{word}' not found")


@router.get("/words/{word}/sentences")
def get_word_sentences(word: str):
    """Return sentences containing the word, for review fill-in-the-blank.

    Uses timestamp-based matching to find the correct sentence,
    avoiding punctuation/cleaning mismatches with the cache.
    """
    _ensure_cache()
    from services import get_lesson
    from fastapi import HTTPException as Http404

    cleaned = clean_word(word)
    results = []
    for w in _cache:
        if w["word"] != cleaned:
            continue
        for lesson_info in w["lessons"]:
            lesson = get_lesson(lesson_info["id"])
            if not lesson:
                continue
            timestamps = lesson_info.get("occurrences", [])
            if not timestamps:
                continue
            # Match by timestamp: find which sentence contains the word's first occurrence
            t = timestamps[0]
            for sent in lesson.transcript:
                if sent.start <= t < sent.end:
                    results.append({
                        "lesson_id": lesson.id,
                        "lesson_title": lesson.title,
                        "sentence_text": sent.text,
                        "start_time": sent.start,
                        "end_time": sent.end,
                    })
                    break
        break

    if not results:
        raise Http404(status_code=404, detail=f"No sentence found for word '{word}'")
    return {"sentences": results}
