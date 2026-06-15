"""Collection service — business logic for collections, dynamic queries, category items."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Optional

from services import get_lesson, list_lessons


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
    'today_words': """
        SELECT lw.word AS item_ref, 'word' AS item_type,
               lw.word AS title,
               printf('来自 %d 个音频', COUNT(DISTINCT lw.audio_id)) AS subtitle,
               json_object('count', COUNT(DISTINCT lw.audio_id),
                           'known', COALESCE(wp.known, 0),
                           'last_score', wp.last_score) AS extra_data,
               GROUP_CONCAT(DISTINCT lw.audio_id) AS lesson_id,
               '' AS lesson_title,
               0 AS start_time, 0 AS end_time
        FROM listened_words lw
        LEFT JOIN word_progress wp ON wp.word = lw.word
        WHERE lw.listened_date = date('now')
        GROUP BY lw.word
        ORDER BY COUNT(DISTINCT lw.audio_id) DESC, lw.word ASC
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
               json_object('color', color) AS extra_data,
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


# ── Category-based collections ──
_CATEGORY_LESSONS_CACHE: dict[str, list[dict]] | None = None


def _get_category_items() -> dict[str, list[dict]]:
    """Group all lessons by category."""
    global _CATEGORY_LESSONS_CACHE
    if _CATEGORY_LESSONS_CACHE is not None:
        return _CATEGORY_LESSONS_CACHE

    groups: dict[str, list[dict]] = {}
    for lesson in list_lessons():
        cat = lesson.category or 'Other'
        if cat not in groups:
            groups[cat] = []
        groups[cat].append({
            "id": 0, "collection_id": 0, "item_type": "audio",
            "item_ref": lesson.id, "lesson_id": lesson.id,
            "lesson_title": lesson.title, "title": lesson.title,
            "subtitle": lesson.subtitle, "start_time": 0, "end_time": 0,
            "extra_data": "{}", "sort_order": len(groups[cat]), "added_at": "",
        })
    _CATEGORY_LESSONS_CACHE = groups
    return groups


def _build_category_collections() -> list[dict]:
    """Build synthetic collection summaries for each category."""
    groups = _get_category_items()
    result = []
    for i, (cat, items) in enumerate(groups.items()):
        name, icon, color = CATEGORY_CONFIG.get(cat, (cat, 'HiFolderOpen', '#3b82f6'))
        result.append({
            "id": -(i + 1), "name": name, "icon": icon, "color": color,
            "is_dynamic": True, "dynamic_type": f"category:{cat}",
            "item_count": len(items), "sort_order": 100 + i,
            "created_at": "", "updated_at": "",
        })
    return result


def _resolve_sentence_times(items: list[dict]):
    """Populate start_time/end_time for sentence-type items from lesson transcript."""
    lesson_cache: dict[str, Any] = {}
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


class CollectionService:
    """Business logic for collections."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def resolve_items(self, collection_id: int, is_dynamic: bool, dynamic_type: Optional[str]) -> list[dict]:
        """Resolve items for a collection (dynamic query, category, or static)."""
        if is_dynamic and dynamic_type:
            if dynamic_type.startswith("category:"):
                cat = dynamic_type[len("category:"):]
                return _get_category_items().get(cat, [])
            if dynamic_type in DYNAMIC_QUERIES:
                return self._execute_dynamic(dynamic_type, collection_id)
        return self._list_static_items(collection_id)

    def _execute_dynamic(self, dynamic_type: str, collection_id: int) -> list[dict]:
        rows = self._conn.execute(DYNAMIC_QUERIES[dynamic_type]).fetchall()
        items = [
            {
                "id": 0, "collection_id": collection_id,
                "item_type": r["item_type"], "item_ref": r["item_ref"],
                "lesson_id": r["lesson_id"] or "", "lesson_title": r["lesson_title"] or "",
                "title": r["title"] or "", "subtitle": r["subtitle"] or "",
                "start_time": r["start_time"] or 0, "end_time": r["end_time"] or 0,
                "extra_data": r["extra_data"] or "{}",
                "sort_order": i, "added_at": "",
            }
            for i, r in enumerate(rows)
        ]
        if dynamic_type in ('recent_dictation_errors', 'all_dictation'):
            _resolve_sentence_times(items)
        if dynamic_type == 'favorites':
            _resolve_clip_extra(items)
        return items

    def _list_static_items(self, collection_id: int) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM collection_items WHERE collection_id=? ORDER BY sort_order, added_at",
            [collection_id],
        ).fetchall()
        return [dict(r) for r in rows]

    def list_collections(self) -> list[dict]:
        rows = self._conn.execute("SELECT * FROM collections ORDER BY sort_order, id").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d["is_dynamic"] and d["dynamic_type"] and d["dynamic_type"] in DYNAMIC_QUERIES:
                items = self._conn.execute(DYNAMIC_QUERIES[d["dynamic_type"]]).fetchall()
                d["item_count"] = len(items)
            result.append(d)
        result.extend(_build_category_collections())
        return result

    def get_collection(self, collection_id: int) -> dict | None:
        """Get a single collection with resolved items."""
        if collection_id < 0:
            for syn in _build_category_collections():
                if syn["id"] == collection_id:
                    syn["items"] = self.resolve_items(collection_id, True, syn["dynamic_type"])
                    syn["item_count"] = len(syn["items"])
                    return syn
            return None
        row = self._conn.execute("SELECT * FROM collections WHERE id=?", [collection_id]).fetchone()
        if not row:
            return None
        col = dict(row)
        col["items"] = self.resolve_items(collection_id, col["is_dynamic"], col["dynamic_type"])
        col["item_count"] = len(col["items"])
        return col

    def refresh_category_cache(self) -> None:
        global _CATEGORY_LESSONS_CACHE
        _CATEGORY_LESSONS_CACHE = None

    def _update_item_count(self, collection_id: int) -> None:
        count = self._conn.execute(
            "SELECT COUNT(*) FROM collection_items WHERE collection_id=?", [collection_id]
        ).fetchone()[0]
        self._conn.execute(
            "UPDATE collections SET item_count=?, updated_at=unixepoch() WHERE id=?",
            [count, collection_id],
        )
