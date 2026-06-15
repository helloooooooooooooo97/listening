"""Statistics API — aggregate user interaction data."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from database import get_conn, locked
from services import list_lessons, get_stats as get_lesson_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
@locked
def stats_root():
    """Redirect bare /api/stats to /overview."""
    return overview()


@router.get("/overview")
@locked
def overview():
    """Top-level stats cards."""
    conn = get_conn()

    total_sec = conn.execute("SELECT COALESCE(SUM(duration_seconds),0) FROM play_history").fetchone()[0]
    completed = conn.execute("SELECT COUNT(*) FROM audio_progress WHERE completed=1").fetchone()[0]
    total_audios = conn.execute("SELECT COUNT(*) FROM audio_progress").fetchone()[0]
    avg_score = conn.execute("SELECT COALESCE(AVG(score),0) FROM dictation_history").fetchone()[0]
    dict_sentences = conn.execute("SELECT COUNT(*) FROM dictation_history").fetchone()[0]
    words_mastered = conn.execute("SELECT COUNT(*) FROM word_progress WHERE known=1").fetchone()[0]
    clips_count = conn.execute("SELECT COUNT(*) FROM clips").fetchone()[0]

    # Today & yesterday
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    today_sec = conn.execute(
        "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at, 'unixepoch')=?", [today]
    ).fetchone()[0]
    yesterday_sec = conn.execute(
        "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at, 'unixepoch')=?", [yesterday]
    ).fetchone()[0]

    # Streak
    rows = conn.execute(
        "SELECT DISTINCT date(played_at, 'unixepoch') FROM play_history WHERE date(played_at, 'unixepoch') > date('now', '-365 days')"
    ).fetchall()
    active_dates = {r[0] for r in rows}
    streak = 0
    d = datetime.now()
    while d.strftime("%Y-%m-%d") in active_dates:
        streak += 1
        d -= timedelta(days=1)

    # Total words
    total_words = 0
    try:
        wc = conn.execute("SELECT COUNT(DISTINCT word) FROM word_occurrences").fetchone()[0]
        if wc > 0:
            total_words = wc
    except Exception:
        pass
    if total_words == 0:
        total_words = get_lesson_stats().get("uniqueWords", 0)

    # Due words count (for review system)
    due_words = conn.execute(
        "SELECT COUNT(*) FROM word_progress WHERE known=1 AND (last_score IS NULL OR last_score < 80)"
    ).fetchone()[0]

    # Currency balance
    currency_row = conn.execute("SELECT balance FROM currency WHERE id=1").fetchone()
    currency_balance = currency_row["balance"] if currency_row else 0

    return {
        "total_listening_seconds": total_sec,
        "completed_audios": completed,
        "total_audios": max(total_audios, len(list_lessons())),
        "avg_dictation_score": round(avg_score, 1),
        "dictation_total_sentences": dict_sentences,
        "words_mastered": words_mastered,
        "total_words": total_words,
        "clips_count": clips_count,
        "streak_days": streak,
        "today_seconds": today_sec,
        "yesterday_seconds": yesterday_sec,
        "due_words": due_words,
        "currency_balance": currency_balance,
    }


@router.get("/daily-time")
@locked
def daily_time(days: int = Query(default=7, ge=1, le=90)):
    """Daily listening time for bar chart."""
    conn = get_conn()
    result = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        sec = conn.execute(
            "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at, 'unixepoch')=?", [day]
        ).fetchone()[0]
        result.append({"date": day, "seconds": sec})
    return {"days": result}


@router.get("/dictation-trend")
@locked
def dictation_trend(limit: int = Query(default=20, ge=1, le=100)):
    """Dictation score trend for line chart."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT audio_title, score, created_at FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    return {"scores": [{"date": datetime.fromtimestamp(r["created_at"]).strftime("%Y-%m-%d"), "audio": r["audio_title"], "score": r["score"]} for r in rows][::-1]}


@router.get("/dictation-records")
@locked
def dictation_records(limit: int = Query(default=100, ge=1, le=500)):
    """Detailed dictation records grouped by audio."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, audio_id, audio_title, sentence_index, score, user_input, expected_text, created_at "
        "FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()

    groups: dict[str, dict] = {}
    for r in rows:
        key = f"{r['audio_id']}|{r['audio_title']}"
        if key not in groups:
            groups[key] = {"audio_id": r["audio_id"], "audio_title": r["audio_title"], "records": []}
        groups[key]["records"].append({
            "id": r["id"],
            "sentence_index": r["sentence_index"],
            "score": r["score"],
            "user_input": r["user_input"] or "",
            "expected_text": r["expected_text"] or "",
            "created_at": r["created_at"],
        })

    result = []
    for g in groups.values():
        scores = [r["score"] for r in g["records"]]
        g["avg_score"] = round(sum(scores) / len(scores), 1) if scores else 0
        g["total_sentences"] = len(scores)
        g["last_practiced"] = g["records"][0]["created_at"]
        result.append(g)

    result.sort(key=lambda x: x["last_practiced"], reverse=True)
    return {"audios": result}


@router.get("/audio-detail/{audio_id}")
@locked
def audio_detail(audio_id: str):
    """Per-audio learning stats for the playback page."""
    conn = get_conn()
    from services import get_lesson
    lesson = get_lesson(audio_id)

    total_words = len(lesson.words) if lesson else 0
    total_sentences = len(lesson.transcript) if lesson else 0
    duration_seconds = lesson.duration if lesson else 0

    known_words = 0
    if lesson:
        known_set = {r["word"] for r in conn.execute("SELECT word FROM word_progress WHERE known=1").fetchall()}
        known_words = sum(1 for w in lesson.words if w.text.strip().lower() in known_set)

    row = conn.execute(
        "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE audio_id=?", [audio_id]
    ).fetchone()
    listening_seconds = int(row[0]) if row else 0

    row = conn.execute(
        "SELECT COUNT(*), COALESCE(AVG(score),0) FROM dictation_history WHERE audio_id=?", [audio_id]
    ).fetchone()
    dictation_count = row[0] if row else 0
    dictation_avg_score = round(row[1], 1) if row else 0

    row = conn.execute("SELECT * FROM audio_progress WHERE audio_id=?", [audio_id]).fetchone()
    completed = bool(row["completed"]) if row else False
    last_position = row["last_position"] if row else 0

    row = conn.execute("SELECT COUNT(*) FROM clips WHERE audio_id=?", [audio_id]).fetchone()
    clips_count = row[0] if row else 0

    row = conn.execute(
        "SELECT MAX(created_at) FROM dictation_history WHERE audio_id=?", [audio_id]
    ).fetchone()
    last_practiced = int(row[0]) if row and row[0] else 0

    return {
        "audio_id": audio_id,
        "title": lesson.title if lesson else "",
        "total_words": total_words,
        "total_sentences": total_sentences,
        "duration_seconds": duration_seconds,
        "known_words": known_words,
        "listening_seconds": listening_seconds,
        "dictation_avg_score": dictation_avg_score,
        "dictation_count": dictation_count,
        "completed": completed,
        "clips_count": clips_count,
        "last_position": last_position,
        "last_practiced": last_practiced,
    }


@router.get("/dictation-sentences/{audio_id}")
@locked
def dictation_sentences(audio_id: str):
    """Per-sentence dictation stats for the transcript view."""
    conn = get_conn()
    from services import get_lesson
    lesson = get_lesson(audio_id)
    total_sentences = len(lesson.transcript) if lesson else 0

    rows = conn.execute(
        "SELECT sentence_index, score, user_input, expected_text FROM dictation_history WHERE audio_id=? ORDER BY created_at",
        [audio_id]
    ).fetchall()

    sentence_map: dict[int, dict] = {}
    for r in rows:
        idx = r["sentence_index"]
        if idx not in sentence_map:
            sentence_map[idx] = {"index": idx, "scores": [], "wrong_indices": set(), "count": 0}
        sentence_map[idx]["scores"].append(r["score"])
        sentence_map[idx]["count"] += 1
        if r["user_input"] and r["expected_text"]:
            expected = r["expected_text"].lower().split()
            actual = r["user_input"].lower().split()
            for i, _ in enumerate(expected):
                if i >= len(actual) or actual[i] != expected[i]:
                    sentence_map[idx]["wrong_indices"].add(i)

    sentences = []
    for i in range(total_sentences):
        if i in sentence_map:
            data = sentence_map[i]
            scores = data["scores"]
            sentences.append({
                "index": i,
                "avg_score": round(sum(scores) / len(scores), 1),
                "count": data["count"],
                "last_score": scores[-1],
                "wrong_indices": sorted(data["wrong_indices"]),
            })
        else:
            sentences.append({"index": i, "avg_score": 0, "count": 0, "last_score": 0, "wrong_indices": []})

    return {"sentences": sentences}


@router.get("/audio-progress")
@locked
def audio_progress():
    """Audio completion progress list."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM audio_progress ORDER BY updated_at DESC").fetchall()
    return {
        "audios": [
            {
                "id": r["audio_id"], "title": r["audio_title"],
                "completed": bool(r["completed"]),
                "last_position": r["last_position"],
                "total_seconds": r["total_seconds"],
                "dictation_score": r["dictation_avg_score"],
            }
            for r in rows
        ]
    }


@router.get("/recent-activity")
@locked
def recent_activity(limit: int = Query(default=20, ge=1, le=100)):
    """Recent activity feed for timeline."""
    conn = get_conn()
    activities = []

    plays = conn.execute(
        "SELECT audio_title, duration_seconds, played_at FROM play_history ORDER BY played_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in plays:
        activities.append({
            "type": "play", "time": int(r["played_at"]),
            "detail": f"学习了 {r['audio_title']} ({int(r['duration_seconds'])}秒)",
        })

    dicts = conn.execute(
        "SELECT audio_title, score, created_at FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in dicts:
        activities.append({
            "type": "dictation", "time": int(r["created_at"]),
            "detail": f"完成听写 {r['audio_title']} ({r['score']}%)",
        })

    clip_rows = conn.execute(
        "SELECT audio_title, text, created_at FROM clips ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in clip_rows:
        activities.append({
            "type": "clip", "time": int(r["created_at"]),
            "detail": f"收藏片段: {r['text'][:40]}...",
        })

    words = conn.execute(
        "SELECT word, reviewed_at FROM word_progress WHERE known=1 ORDER BY reviewed_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in words:
        activities.append({
            "type": "word", "time": int(r["reviewed_at"]),
            "detail": f"掌握单词 '{r['word']}'",
        })

    activities.sort(key=lambda x: x["time"], reverse=True)
    return {"activities": activities[:limit]}
