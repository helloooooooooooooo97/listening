"""Words API — deduplicated word list with frequency and occurrences."""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, Query

from services import LESSONS_DIR, _load_lesson

router = APIRouter(prefix="/api", tags=["words"])

PUNCT = re.compile(r"^[.,!?;:\-\"'`]+|[.,!?;:\-\"'`]+$")


def _clean(word: str) -> str:
    return PUNCT.sub('', word.strip().lower())


@router.get("/words")
def get_words(
    q: str = Query(default="", description="Search query"),
    sort: str = Query(default="freq", description="Sort: freq or alpha"),
    order: str = Query(default="desc", description="Order: asc or desc"),
    limit: int = Query(default=200, ge=10, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Return deduplicated word list with frequency and lesson occurrences."""
    word_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "lessons": defaultdict(list)})

    if not LESSONS_DIR.exists():
        return {"total": 0, "words": []}

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

    # Filter by search
    if q:
        word_map = {k: v for k, v in word_map.items() if q.lower() in k}

    # Sort
    desc = order != "asc"
    if sort == "alpha":
        sorted_words = sorted(word_map.items(), key=lambda x: x[0], reverse=desc)
    else:
        sorted_words = sorted(word_map.items(), key=lambda x: x[1]["count"], reverse=desc)

    total = len(sorted_words)
    page = sorted_words[offset:offset + limit]

    words = [
        {
            "word": word,
            "count": data["count"],
            "lessons": [
                {"id": lid, "title": times[0]["title"], "occurrences": [t["start"] for t in times]}
                for lid, times in data["lessons"].items()
            ],
        }
        for word, data in page
    ]

    return {"total": total, "words": words}
