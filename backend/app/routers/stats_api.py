"""Statistics API — aggregate user interaction data."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from database import get_conn

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
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
        "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at)=?", [today]
    ).fetchone()[0]
    yesterday_sec = conn.execute(
        "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at)=?", [yesterday]
    ).fetchone()[0]

    # Streak — single query for all active dates
    active_dates = set()
    rows = conn.execute(
        "SELECT DISTINCT date(played_at) FROM play_history WHERE date(played_at) > date('now', '-365 days')"
    ).fetchall()
    for r in rows:
        active_dates.add(r[0])

    streak = 0
    d = datetime.now()
    while d.strftime("%Y-%m-%d") in active_dates:
        streak += 1
        d -= timedelta(days=1)

    # Total words — from occurrences table if populated, else scan lesson JSONs
    total_words = 0
    try:
        wc = conn.execute("SELECT COUNT(DISTINCT word) FROM word_occurrences").fetchone()[0]
        if wc > 0:
            total_words = wc
    except Exception:
        pass
    if total_words == 0:
        try:
            from services import LESSONS_DIR, _load_lesson
            all_w = set()
            for f in LESSONS_DIR.glob("*.json"):
                lesson = _load_lesson(f)
                for w in lesson.words:
                    all_w.add(w.text.strip().lower())
            total_words = len(all_w)
        except Exception:
            pass

    return {
        "total_listening_seconds": total_sec,
        "completed_audios": completed,
        "total_audios": max(total_audios, len(list(LESSONS_DIR.glob("*.json")))) if 'LESSONS_DIR' in dir() else max(total_audios, 0),
        "avg_dictation_score": round(avg_score, 1),
        "dictation_total_sentences": dict_sentences,
        "words_mastered": words_mastered,
        "total_words": total_words,
        "clips_count": clips_count,
        "streak_days": streak,
        "today_seconds": today_sec,
        "yesterday_seconds": yesterday_sec,
    }


@router.get("/daily-time")
def daily_time(days: int = Query(default=7, ge=1, le=90)):
    """Daily listening time for bar chart."""
    conn = get_conn()
    result = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        sec = conn.execute(
            "SELECT COALESCE(SUM(duration_seconds),0) FROM play_history WHERE date(played_at)=?", [day]
        ).fetchone()[0]
        result.append({"date": day, "seconds": sec})
    return {"days": result}


@router.get("/dictation-trend")
def dictation_trend(limit: int = Query(default=20, ge=1, le=100)):
    """Dictation score trend for line chart."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT audio_title, score, created_at FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    return {"scores": [{"date": r["created_at"][:10], "audio": r["audio_title"], "score": r["score"]} for r in rows][::-1]}


@router.get("/dictation-records")
def dictation_records(limit: int = Query(default=100, ge=1, le=500)):
    """Detailed dictation records grouped by audio."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, audio_id, audio_title, sentence_index, score, user_input, expected_text, created_at "
        "FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()

    # Group by audio
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


@router.get("/audio-progress")
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
def recent_activity(limit: int = Query(default=20, ge=1, le=100)):
    """Recent activity feed for timeline."""
    conn = get_conn()
    activities = []

    plays = conn.execute(
        "SELECT audio_title, duration_seconds, played_at FROM play_history ORDER BY played_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in plays:
        activities.append({
            "type": "play", "time": r["played_at"],
            "detail": f"学习了 {r['audio_title']} ({int(r['duration_seconds'])}秒)",
        })

    dicts = conn.execute(
        "SELECT audio_title, score, created_at FROM dictation_history ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in dicts:
        activities.append({
            "type": "dictation", "time": r["created_at"],
            "detail": f"完成听写 {r['audio_title']} ({r['score']}%)",
        })

    clip_rows = conn.execute(
        "SELECT audio_title, text, created_at FROM clips ORDER BY created_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in clip_rows:
        activities.append({
            "type": "clip", "time": r["created_at"],
            "detail": f"收藏片段: {r['text'][:40]}...",
        })

    words = conn.execute(
        "SELECT word, reviewed_at FROM word_progress WHERE known=1 ORDER BY reviewed_at DESC LIMIT ?", [limit]
    ).fetchall()
    for r in words:
        activities.append({
            "type": "word", "time": r["reviewed_at"],
            "detail": f"掌握单词 '{r['word']}'",
        })

    activities.sort(key=lambda x: x["time"], reverse=True)
    return {"activities": activities[:limit]}
