"""Words API — precomputed cache, refreshed on demand."""
from __future__ import annotations

import json
from collections import defaultdict

from fastapi import APIRouter, Body, Query

from database import get_conn
from services import LESSONS_DIR, _load_lesson
from services.word_difficulty_service import WordDifficultyService
from text_utils import clean_word

router = APIRouter(prefix="/api", tags=["words"])

# ── Cache ──
_cache: list[dict] | None = None
_cache_by_word: dict[str, dict] | None = None  # word → cache entry, O(1) lookups
_best_sentence_cache_by_word: dict[str, list[dict]] | None = None
_cache_total: int = 0
_cache_cat_map: dict[str, str] = {}  # lesson_id → category


def _build_cache():
    """Precompute word index from all lesson JSONs."""
    global _cache, _cache_by_word, _best_sentence_cache_by_word, _cache_total, _cache_cat_map
    from services import list_lessons
    _cache_cat_map = {lesson.id: lesson.category or 'Other' for lesson in list_lessons()}

    word_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "lessons": defaultdict(list)})
    sentence_cache: dict[str, dict] = {}

    if LESSONS_DIR.exists():
        for json_file in sorted(LESSONS_DIR.glob("*.json")):
            try:
                lesson = _load_lesson(json_file)
                sentence_idx = 0
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
                    while (
                        sentence_idx + 1 < len(lesson.transcript)
                        and lesson.transcript[sentence_idx].end <= w.start
                    ):
                        sentence_idx += 1
                    if sentence_idx >= len(lesson.transcript):
                        continue
                    sent = lesson.transcript[sentence_idx]
                    if not (sent.start <= w.start < sent.end):
                        continue
                    duration = sent.end - sent.start
                    candidate = {
                        "lesson_id": lesson.id,
                        "lesson_title": lesson.title,
                        "sentence_text": sent.text,
                        "start_time": sent.start,
                        "end_time": sent.end,
                    }
                    score = (len(sent.text), duration, lesson.id)
                    current = sentence_cache.get(word)
                    if current is None or score < current["_score"]:
                        sentence_cache[word] = {**candidate, "_score": score}
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
    _cache_by_word = {w["word"]: w for w in _cache}
    _best_sentence_cache_by_word = {
        word: [{k: v for k, v in sentence.items() if k != "_score"}]
        for word, sentence in sentence_cache.items()
    }
    _cache_total = len(words)


def _ensure_cache():
    if _cache is None or _cache_by_word is None or _best_sentence_cache_by_word is None:
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
    exam: str = Query(default="", description="Filter by exam tag (CET-4, CET-6, TEM-4, TEM-8, IELTS, TOEFL)"),
    difficulty: str = Query(default="", description="Difficulty level: easy, medium, hard"),
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
                                ed = json.loads(extra)
                                lid = ed.get("lessonId")
                        except (json.JSONDecodeError, TypeError):
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

    # Exam tag filter (from dictionary table)
    if exam:
        conn = get_conn()
        tag_rows = conn.execute(
            "SELECT word FROM dictionary WHERE tags LIKE ?", [f'%"{exam}"%']
        ).fetchall()
        exam_words = {r[0] for r in tag_rows}
        filtered = [w for w in filtered if w["word"] in exam_words]
    if difficulty:
        conn = get_conn()
        WordDifficultyService(conn).ensure_computed()
        diff_rows = conn.execute(
            "SELECT word FROM word_difficulty WHERE level=?", [difficulty]
        ).fetchall()
        diff_words = {r["word"] for r in diff_rows}
        filtered = [w for w in filtered if w["word"] in diff_words]

    # Sort
    desc = order != "asc"
    if sort == "alpha":
        filtered.sort(key=lambda x: x["word"], reverse=desc)
    else:
        filtered.sort(key=lambda x: x["count"], reverse=desc)

    total = len(filtered)
    page = filtered[offset:offset + limit]

    # Batch-fetch tags from dictionary table
    page_words = [w["word"] for w in page]
    tag_map: dict[str, list[str]] = {}
    difficulty_map: dict[str, dict] = {}
    if page_words:
        conn = get_conn()
        WordDifficultyService(conn).ensure_computed()
        placeholders = ",".join("?" * len(page_words))
        rows = conn.execute(
            f"SELECT word, tags FROM dictionary WHERE word IN ({placeholders})",
            page_words,
        ).fetchall()
        for r in rows:
            tag_map[r["word"]] = json.loads(r["tags"])
        rows = conn.execute(
            f"SELECT word, score, level FROM word_difficulty WHERE word IN ({placeholders})",
            page_words,
        ).fetchall()
        for r in rows:
            difficulty_map[r["word"]] = {"score": r["score"], "level": r["level"]}

    return {
        "total": total,
        "words": [
            {
                "word": w["word"],
                "count": w["count"],
                "tags": tag_map.get(w["word"], []),
                "difficulty_score": difficulty_map.get(w["word"], {}).get("score"),
                "difficulty_level": difficulty_map.get(w["word"], {}).get("level"),
            }
            for w in page
        ],
    }


@router.get("/words/difficulty")
def get_word_difficulty(
    level: str = Query(default="", description="easy, medium, hard"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
):
    svc = WordDifficultyService(get_conn())
    svc.ensure_computed()
    return svc.get_words_by_level(level or None, offset, limit)


@router.get("/words/difficulty/{word}")
def get_word_difficulty_detail(word: str):
    from fastapi import HTTPException
    svc = WordDifficultyService(get_conn())
    svc.ensure_computed()
    result = svc.get_word_difficulty(word)
    if not result:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
    return result


@router.post("/words/difficulty/refresh")
def refresh_word_difficulty():
    svc = WordDifficultyService(get_conn())
    return {"updated": svc.compute_all()}


@router.get("/words/{word}")
def get_word_detail(word: str):
    """Return full word detail with lesson occurrences (audio timestamps)."""
    _ensure_cache()
    cleaned = clean_word(word)
    for w in _cache:
        if w["word"] == cleaned:
            result = dict(w)
            # Attach tags from dictionary table
            conn = get_conn()
            row = conn.execute("SELECT tags FROM dictionary WHERE word=?", [cleaned]).fetchone()
            result["tags"] = json.loads(row["tags"]) if row else []
            return result
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Word '{word}' not found")


@router.get("/dictionary/{word}")
def get_dictionary_entry(word: str):
    """Return dictionary entry: pronunciation, part of speech, definition, tags."""
    conn = get_conn()
    cleaned = clean_word(word)
    row = conn.execute(
        "SELECT * FROM dictionary WHERE word=?", [cleaned]
    ).fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Dictionary entry for '{word}' not found")
    return {
        "word": row["word"],
        "pronunciation": row["pronunciation"],
        "partOfSpeech": row["part_of_speech"],
        "definition": row["definition"],
        "tags": json.loads(row["tags"]),
    }


@router.get("/words/{word}/sentences")
def get_word_sentences(
    word: str,
    prioritize: str = Query(
        default="",
        description="Comma-separated collection slugs to prioritize "
                    "(e.g. 'favorites,recent_plays'). Lessons from these "
                    "collections are checked first.",
    ),
):
    """Return sentences containing the word, for review fill-in-the-blank."""
    results = _find_word_sentences(word, prioritize)
    if not results:
        return {"sentences": []}
    return {"sentences": results}


@router.post("/words/sentences/batch")
def get_word_sentences_batch(
    words: list[str] = Body(embed=True, description="List of words to look up"),
    prioritize: str = Query(
        default="",
        description="Comma-separated collection slugs to prioritize",
    ),
):
    """Batch lookup — returns the best cached playable sentence for each word.

    Response: {"results": {"apple": {"sentences": [...]}, ...}}
    Words with no match are omitted from the map.
    """
    _ensure_cache()

    results: dict[str, list[dict]] = {}
    seen_cleaned: set[str] = set()
    for raw_word in words:
        cleaned = clean_word(raw_word)
        if not cleaned or cleaned in seen_cleaned:
            continue
        seen_cleaned.add(cleaned)
        sentences = _best_sentence_cache_by_word.get(cleaned) if _best_sentence_cache_by_word else None
        if sentences:
            results[raw_word] = sentences

    return {"results": results}


# ── Helpers ──


def _resolve_prioritized_lesson_ids(prioritize: str) -> set[str]:
    """Resolve comma-separated collection slugs into lesson IDs."""
    ids: set[str] = set()
    from services.collection_service import DYNAMIC_QUERIES
    from database import get_conn
    for slug in prioritize.split(","):
        slug = slug.strip()
        sql = DYNAMIC_QUERIES.get(slug)
        if not sql:
            continue
        try:
            conn = get_conn()
            for r in conn.execute(sql).fetchall():
                lid = r["lesson_id"] if r["lesson_id"] else None
                if not lid:
                    try:
                        extra = json.loads(r["extra_data"]) if r.get("extra_data") else {}
                        lid = extra.get("lessonId") or (r["item_ref"] if r["item_type"] == "audio" else None)
                    except (json.JSONDecodeError, TypeError):
                        lid = r["item_ref"] if r["item_type"] == "audio" else None
                if lid:
                    ids.add(lid)
        except Exception:
            continue
    return ids


def _find_word_sentences(word: str, prioritize: str = "") -> list[dict]:
    """Look up sentences containing *word* in the cache (O(1) via dict)."""
    _ensure_cache()
    cleaned = clean_word(word)

    prioritized_ids: set[str] = set()
    if prioritize:
        prioritized_ids = _resolve_prioritized_lesson_ids(prioritize)

    w = _cache_by_word.get(cleaned) if _cache_by_word else None
    if w:
        return _collect_sentences_for_word(w, prioritized_ids)
    return []


def _collect_sentences_for_word(w: dict, prioritized_ids: set[str]) -> list[dict]:
    """Given a cache entry for one word, collect transcript sentences."""
    from services import get_lesson
    phase1: list[dict] = []
    phase2: list[dict] = []

    for lesson_info in w["lessons"]:
        lesson = get_lesson(lesson_info["id"])
        if not lesson:
            continue
        timestamps = lesson_info.get("occurrences", [])
        if not timestamps:
            continue
        t = timestamps[0]
        for sent in lesson.transcript:
            if sent.start <= t < sent.end:
                entry = {
                    "lesson_id": lesson.id,
                    "lesson_title": lesson.title,
                    "sentence_text": sent.text,
                    "start_time": sent.start,
                    "end_time": sent.end,
                }
                if lesson.id in prioritized_ids:
                    phase1.append(entry)
                else:
                    phase2.append(entry)
                break

    phase1.sort(key=lambda e: (
        0 if e["lesson_id"] in prioritized_ids else 1,
        e["lesson_id"],
    ))
    return phase1 + phase2


def _collect_best_sentence_for_word(w: dict, prioritized_ids: set[str]) -> dict | None:
    """Return the best playable sentence for one word without returning every candidate."""
    from services import get_lesson

    best: tuple[tuple[int, int, float, str], dict] | None = None

    for lesson_info in w["lessons"]:
        lesson = get_lesson(lesson_info["id"])
        if not lesson:
            continue
        timestamps = lesson_info.get("occurrences", [])
        if not timestamps:
            continue
        for t in timestamps:
            for sent in lesson.transcript:
                if sent.start <= t < sent.end:
                    entry = {
                        "lesson_id": lesson.id,
                        "lesson_title": lesson.title,
                        "sentence_text": sent.text,
                        "start_time": sent.start,
                        "end_time": sent.end,
                    }
                    duration = sent.end - sent.start
                    score = (
                        0 if lesson.id in prioritized_ids else 1,
                        len(sent.text),
                        duration,
                        lesson.id,
                    )
                    if best is None or score < best[0]:
                        best = (score, entry)
                    break

    return best[1] if best else None
