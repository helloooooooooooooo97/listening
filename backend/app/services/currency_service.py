"""Currency service — inspiration points (IP) settlement engine.

Settlement is passive: called when balance or draw status is queried.
Scans today's play/review/dictation records, computes earned IP, writes
transactions.  Dedup via UNIQUE(source, ref_id) ensures idempotence.
"""
from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Any

from config import get_config


# ── Daily range helper ──

def _today_start() -> int:
    """Unix timestamp (seconds) for today 00:00 UTC."""
    return int(datetime.combine(datetime.now(timezone.utc).date(), time.min).timestamp())


# ── Settlement ──

def settle(conn) -> int:
    """Scan today's un-settled activity, earn IP, write transactions.

    Returns the total IP earned this call.
    """
    cfg = get_config()
    curr = cfg["currency"]
    today = _today_start()
    total_earned = 0

    # ── 1. Listening time (1 IP / second) ──
    listen_rate = curr["earn"]["listen_per_second"]  # 1 IP/s
    listen_cap = curr["earn"]["listen_daily_cap"]
    already = _daily_earned_for_source(conn, "listen", today)
    rows = conn.execute("""
        SELECT ph.id, ph.duration_seconds
        FROM play_history ph
        LEFT JOIN currency_transactions ct ON ct.ref_id = 'play:' || ph.id AND ct.source = 'listen'
        WHERE ph.played_at >= ? AND ct.id IS NULL
    """, [today]).fetchall()
    for row in rows:
        if already >= listen_cap:
            break
        sec = row["duration_seconds"] or 0
        ip = max(1, int(sec * listen_rate))
        capped = min(ip, listen_cap - already)
        if capped <= 0:
            continue
        ref = f"play:{row['id']}"
        label = f"听了 {int(sec)} 秒音频"
        _add_tx(conn, "listen", ref, capped, label)
        already += capped
        total_earned += capped

    # ── 2. Word reviews ──
    review_rate = curr["earn"]["review_per_word"]
    review_threshold = curr["earn"]["review_bonus_threshold"]
    review_cap = curr["earn"]["review_daily_cap"]
    already_review = _daily_earned_for_source(conn, "review", today)
    rows = conn.execute("""
        SELECT rh.id, rh.score
        FROM review_history rh
        LEFT JOIN currency_transactions ct ON ct.ref_id = 'review:' || rh.id AND ct.source = 'review'
        WHERE rh.created_at >= ? AND ct.id IS NULL
    """, [today]).fetchall()
    for row in rows:
        if already_review >= review_cap:
            break
        ip = review_rate * (2 if row["score"] >= review_threshold else 1)
        capped = min(ip, review_cap - already_review)
        if capped <= 0:
            continue
        ref = f"review:{row['id']}"
        label = "高分复习" if row["score"] >= review_threshold else "复习"
        _add_tx(conn, "review", ref, capped, label)
        already_review += capped
        total_earned += capped

    # ── 3. Dictation ──
    dict_rate = curr["earn"]["dictation_per_sentence"]
    dict_threshold = curr["earn"]["review_bonus_threshold"]
    dict_cap = curr["earn"]["dictation_daily_cap"]
    already_dict = _daily_earned_for_source(conn, "dictation", today)
    rows = conn.execute("""
        SELECT dh.id, dh.score
        FROM dictation_history dh
        LEFT JOIN currency_transactions ct ON ct.ref_id = 'dict:' || dh.id AND ct.source = 'dictation'
        WHERE dh.created_at >= ? AND ct.id IS NULL
    """, [today]).fetchall()
    for row in rows:
        if already_dict >= dict_cap:
            break
        ip = dict_rate * (2 if row["score"] >= dict_threshold else 1)
        capped = min(ip, dict_cap - already_dict)
        if capped <= 0:
            continue
        ref = f"dict:{row['id']}"
        label = "高分听写" if row["score"] >= dict_threshold else "听写"
        _add_tx(conn, "dictation", ref, capped, label)
        already_dict += capped
        total_earned += capped

    # ── 4. Word mastery (words newly set to known=1 today) ──
    word_bonus = curr["earn"]["word_mastery_bonus"]
    already_word = _daily_earned_for_source(conn, "word_mastery", today)
    rows = conn.execute("""
        SELECT wp.word
        FROM word_progress wp
        LEFT JOIN currency_transactions ct ON ct.ref_id = 'word:' || wp.word AND ct.source = 'word_mastery'
        WHERE wp.known=1 AND wp.reviewed_at >= ? AND ct.id IS NULL
    """, [today]).fetchall()
    for row in rows:
        ref = f"word:{row['word']}"
        _add_tx(conn, "word_mastery", ref, word_bonus, f"掌握单词 '{row['word']}'")
        already_word += word_bonus
        total_earned += word_bonus

    # ── 5. Daily bonus (once per day) — ref_id is YYYY-MM-DD from the unix timestamp ──
    daily_bonus = curr["earn"]["daily_bonus"]
    today_date = datetime.fromtimestamp(today, tz=timezone.utc).strftime("%Y-%m-%d")
    if daily_bonus > 0 and not _tx_exists(conn, "daily_bonus", today_date):
        _add_tx(conn, "daily_bonus", today_date, daily_bonus, "今日首次活跃奖励")
        total_earned += daily_bonus

    if total_earned > 0:
        conn.commit()
    return total_earned


# ── Draw cost deduction ──

def deduct_for_draw(conn) -> int:
    """Deduct draw cost from balance. Returns the cost deducted.

    Caller MUST verify balance >= cost before calling.
    """
    cfg = get_config()
    cost = cfg["currency"]["draw"]["cost"]
    row = conn.execute("SELECT balance FROM currency WHERE id=1").fetchone()
    new_balance = row["balance"] - cost
    conn.execute(
        "UPDATE currency SET balance=?, spent=spent+? WHERE id=1",
        [new_balance, cost],
    )
    _add_tx(conn, "draw", f"draw:{int(datetime.now().timestamp())}", -cost, f"抽卡消耗")
    conn.commit()
    return cost


# ── Balance / queries ──

def get_balance(conn) -> dict[str, int]:
    row = conn.execute("SELECT balance, earned, spent FROM currency WHERE id=1").fetchone()
    return {
        "balance": row["balance"] if row else 0,
        "earned": row["earned"] if row else 0,
        "spent": row["spent"] if row else 0,
    }


def get_transactions(conn, source: str | None = None, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    q = "SELECT * FROM currency_transactions"
    params: list = []
    if source:
        q += " WHERE source=?"
        params.append(source)
    q += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


def get_today_earnings(conn) -> list[dict[str, Any]]:
    today = _today_start()
    rows = conn.execute(
        """SELECT source, SUM(amount) as total, COUNT(*) as count
           FROM currency_transactions
           WHERE created_at >= ? AND amount > 0
           GROUP BY source
           ORDER BY total DESC""",
        [today],
    ).fetchall()
    return [{"source": r["source"], "total": r["total"], "count": r["count"]} for r in rows]


# ── Internals ──

def _daily_earned_for_source(conn, source: str, since: int) -> int:
    row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM currency_transactions WHERE source=? AND created_at>=? AND amount>0",
        [source, since],
    ).fetchone()
    return row[0]


def _tx_exists(conn, source: str, ref_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM currency_transactions WHERE source=? AND ref_id=?",
        [source, ref_id],
    ).fetchone()
    return row is not None


def _add_tx(conn, source: str, ref_id: str, amount: int, summary: str):
    """Insert a transaction and update the currency row balance."""
    # Get current balance
    row = conn.execute("SELECT balance, earned, spent FROM currency WHERE id=1").fetchone()
    cur_balance = row["balance"] if row else 0
    new_balance = cur_balance + amount
    conn.execute(
        "INSERT OR IGNORE INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?, ?, ?, ?, ?)",
        [amount, new_balance, source, ref_id, summary],
    )
    if amount > 0:
        conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=1", [new_balance, amount])
    else:
        conn.execute("UPDATE currency SET balance=? WHERE id=1", [new_balance])
