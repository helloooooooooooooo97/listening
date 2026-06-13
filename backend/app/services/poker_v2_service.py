"""Poker v2 — 每人5张卡, 5个公共词, 按牌型大小比胜负."""
from __future__ import annotations

import json
import random
from collections import Counter
from datetime import datetime

from database import get_conn
from log_config import get_logger
from services.card_service import load_card_data

logger = get_logger("poker_v2")

ROUND_COST = 5  # 每回合每人投入

# ── Card / keyword helpers (shared from v1) ──

def _all_keywords() -> list[str]:
    cards = load_card_data()
    seen: set[str] = set()
    result: list[str] = []
    for card in cards:
        for kw in card.get("keywords", []):
            if kw.lower() not in seen:
                seen.add(kw.lower())
                result.append(kw.lower())
    return result

def _card_keywords(card_id: str) -> set[str]:
    cards = load_card_data()
    for c in cards:
        if c["id"] == card_id:
            return {kw.lower() for kw in c.get("keywords", [])}
    return set()

def _card_data(card_id: str) -> dict:
    cards = load_card_data()
    for c in cards:
        if c["id"] == card_id:
            return c
    return {"id": card_id, "name": card_id, "rarity": "R", "png": ""}

# ── Sampling helpers ──

def _pick_ai_cards(count: int) -> list[str]:
    """AI: 从所有卡牌中随机抽 count 张 (可重复以填满)."""
    all_cards = load_card_data()
    pool = [c["id"] for c in all_cards]
    return random.choices(pool, k=count)

def _pick_human_cards(conn, count: int) -> list[str]:
    """Human: 从已拥有卡牌中随机抽 count 张."""
    rows = conn.execute(
        "SELECT card_id FROM card_collection WHERE obtained=1"
    ).fetchall()
    owned = [r["card_id"] for r in rows]
    if len(owned) >= count:
        return random.sample(owned, count)
    return owned + random.choices(owned, k=count - len(owned)) if owned else []

def _pick_community_words(human_cards: list[str], ai_cards_pool: list[str]) -> list[str]:
    """Pick 5 community words. 优先选与场上卡牌相关的词."""
    all_keywords = _all_keywords()
    random.shuffle(all_keywords)

    card_ids = human_cards + ai_cards_pool
    # 收集场上所有卡的 keywords
    in_play_kw: set[str] = set()
    for cid in card_ids:
        in_play_kw |= _card_keywords(cid)

    # 先选与场上卡牌相关的词 (命中至少1张)
    relevant = [kw for kw in all_keywords if kw in in_play_kw]
    # 再补充无关词
    irrelevant = [kw for kw in all_keywords if kw not in in_play_kw]

    chosen = relevant[:3] + irrelevant[:2]
    random.shuffle(chosen)
    while len(chosen) < 5:
        chosen.append(random.choice(all_keywords))
    return chosen[:5]

# ── Core logic ──

def count_hits(word: str, card_id: str) -> int:
    """返回词汇命中了该卡几次 (0或1, 未来可扩展为多级匹配)."""
    kw = _card_keywords(card_id)
    return 1 if word in kw else 0

def evaluate_hand(scores: list[int]) -> dict:
    """
    牌型评估引擎.
    scores = [4,4,2,2,1] → {rank: 6, name: '两对'}
    """
    freq = sorted(Counter(scores).values(), reverse=True)

    if freq == [5]:
        if all(s == 5 for s in scores):
            return {"rank": 1, "name": "五福临门"}
        return {"rank": 3, "name": "四喜临门"}

    if sorted(scores) in ([0, 1, 2, 3, 4], [1, 2, 3, 4, 5]):
        return {"rank": 2, "name": "一条龙"}

    if len(freq) > 0 and freq[0] == 4:
        return {"rank": 3, "name": "四喜临门"}

    if freq == [3, 2]:
        return {"rank": 4, "name": "葫芦"}

    if len(freq) > 0 and freq[0] == 3:
        return {"rank": 5, "name": "三花聚顶"}

    if freq == [2, 2, 1]:
        return {"rank": 6, "name": "两对"}

    if len(freq) > 0 and freq[0] == 2:
        return {"rank": 7, "name": "一对"}

    return {"rank": 8, "name": "散牌"}

def hand_sort_key(hand: dict, scores: list[int]) -> tuple:
    """用于比大小的排序 key."""
    return (hand["rank"], sum(scores), max(scores))

# ── Public API ──

def new_round(user_id: int = 1) -> dict:
    """执行一回合: 每人抽5张、选5词、计命中、评牌型、判胜负."""
    conn = get_conn()

    # 1. 扣费检查
    bal_row = conn.execute("SELECT balance FROM currency WHERE id=?", [user_id]).fetchone()
    if not bal_row or bal_row["balance"] < ROUND_COST:
        raise ValueError(f"灵感值不足, 需要 {ROUND_COST} IP")

    # 2. 抽卡
    human_cards = _pick_human_cards(conn, 5)
    ai_pool = _pick_ai_cards(5 * 3)  # 3 AI × 5 cards

    all_players = [
        {"id": 0, "type": "human", "name": "你", "card_ids": human_cards},
        {"id": 1, "type": "ai", "name": "对手A", "card_ids": ai_pool[0:5]},
        {"id": 2, "type": "ai", "name": "对手B", "card_ids": ai_pool[5:10]},
        {"id": 3, "type": "ai", "name": "对手C", "card_ids": ai_pool[10:15]},
    ]

    # 3. 选词
    words = _pick_community_words(human_cards, ai_pool)

    # 4. 每人算牌
    for p in all_players:
        p["card_details"] = [
            {**{"card_id": cid}, **_card_data(cid)}
            for cid in p["card_ids"]
        ]
        p["scores"] = [sum(count_hits(w, cid) for w in words) for cid in p["card_ids"]]
        p["hand"] = evaluate_hand(p["scores"])

    # 5. 比大小
    sorted_players = sorted(
        all_players,
        key=lambda p: hand_sort_key(p["hand"], p["scores"]),
        reverse=True,
    )
    winner = sorted_players[0]

    # 6. 结算
    pot = ROUND_COST * 4
    deducted = ROUND_COST
    if winner["type"] == "human":
        reward = pot
        new_bal = bal_row["balance"] - ROUND_COST + reward
        conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=?", [new_bal, reward, user_id])
        conn.execute(
            "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
            [reward - ROUND_COST, new_bal, "poker_v2",
             f"poker_v2_win:{int(datetime.now().timestamp())}",
             f"德州听词v2 - {winner['hand']['name']}"],
        )
        net = reward - ROUND_COST
    else:
        reward = 0
        new_bal = bal_row["balance"] - ROUND_COST
        conn.execute("UPDATE currency SET balance=?, spent=spent+? WHERE id=?", [new_bal, ROUND_COST, user_id])
        conn.execute(
            "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
            [-ROUND_COST, new_bal, "poker_v2",
             f"poker_v2_lose:{int(datetime.now().timestamp())}",
             f"德州听词v2 - 第{winner['hand']['name']}名"],
        )
        net = -ROUND_COST

    conn.commit()

    # 7. 构建响应
    def player_response(p: dict) -> dict:
        return {
            "type": p["type"],
            "name": p["name"],
            "cards": [
                {"card_id": c["card_id"], "name": c.get("name", c["card_id"]),
                 "rarity": c.get("rarity", "R"), "png": c.get("png", "")}
                for c in p["card_details"]
            ],
            "scores": p["scores"],
            "hand": p["hand"],
        }

    return {
        "words": words,
        "players": [player_response(p) for p in all_players],
        "winner_index": sorted_players.index(winner),
        "winner_name": winner["name"],
        "winner_hand": winner["hand"]["name"],
        "pot": pot,
        "cost": ROUND_COST,
        "reward": reward,
        "net": net,
        "balance_after": new_bal,
    }
