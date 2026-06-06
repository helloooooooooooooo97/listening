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


def _clean(word: str) -> str:
    return PUNCT.sub('', word.strip().lower())


def _build_cache():
    """Precompute word index from all lesson JSONs."""
    global _cache, _cache_total
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
):
    """Return deduplicated word list with frequency and lesson occurrences."""
    _ensure_cache()

    # Filter
    if q:
        filtered = [w for w in _cache if q.lower() in w["word"]]
    else:
        filtered = list(_cache)

    # Sort
    desc = order != "asc"
    if sort == "alpha":
        filtered.sort(key=lambda x: x["word"], reverse=desc)
    else:
        filtered.sort(key=lambda x: x["count"], reverse=desc)

    total = len(filtered)
    page = filtered[offset:offset + limit]
    return {"total": total, "words": page}
