"""Poker game service — 每人5张卡, 配5个公共词, 按牌型比大小."""
from __future__ import annotations

import json
import random
from collections import Counter
from datetime import datetime

from database import get_conn
from log_config import get_logger
from pathlib import Path
from services.card_service import load_card_data
from services.currency_service import get_balance
from text_utils import clean_word

logger = get_logger("poker")

# ── Constants ──

ANTE = 10
MIN_BET = 5
MAX_BET = 1000
ROUNDS = 5
CARDS_PER_PLAYER = 5

RARITY_ORDER = {"UR": 4, "SSR": 3, "SR": 2, "R": 1}

# ── Helpers ──

def _audio_words_set() -> set[str]:
    """Return the set of all words that appear in at least one lesson (have audio)."""
    from services import LESSONS_DIR, _load_lesson
    words: set[str] = set()
    if LESSONS_DIR.exists():
        for json_file in sorted(LESSONS_DIR.glob("*.json")):
            try:
                lesson = _load_lesson(json_file)
                for w in lesson.words:
                    cleaned = clean_word(w.text)
                    if cleaned:
                        words.add(cleaned)
            except Exception:
                continue
    return words

# Cache the audio words set (refreshed on each game create)
_AUDIO_WORDS_CACHE: set[str] | None = None

def _get_audio_words() -> set[str]:
    global _AUDIO_WORDS_CACHE
    if _AUDIO_WORDS_CACHE is None:
        _AUDIO_WORDS_CACHE = _audio_words_set()
    return _AUDIO_WORDS_CACHE

def _all_keywords_with_audio() -> list[str]:
    """Return card keywords that also have lesson audio."""
    cards = load_card_data()
    audio = _get_audio_words()
    seen: set[str] = set()
    result: list[str] = []
    for card in cards:
        for kw in card.get("keywords", []):
            kwl = kw.lower()
            if kwl in audio and kwl not in seen:
                seen.add(kwl)
                result.append(kwl)
    return result

def _pick_community_words() -> list[str]:
    pool = _all_keywords_with_audio()
    if len(pool) < 5:
        pool = ["fashion", "elegance", "freedom", "art", "innovation"]
    return random.sample(pool, 5)

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
            return {"card_id": c["id"], "name": c.get("name", c["id"]),
                    "rarity": c.get("rarity", "R"), "png": c.get("png", ""),
                    "keywords": [kw.lower() for kw in c.get("keywords", [])]}
    return {"card_id": card_id, "name": card_id, "rarity": "R", "png": "", "keywords": []}

def _pick_human_cards(conn) -> list[str]:
    rows = conn.execute("SELECT card_id FROM card_collection WHERE obtained=1").fetchall()
    owned = [r["card_id"] for r in rows]
    if not owned:
        return []
    return random.choices(owned, k=CARDS_PER_PLAYER)

def _pick_ai_cards() -> list[str]:
    all_cards = load_card_data()
    pool = [c["id"] for c in all_cards]
    return random.choices(pool, k=CARDS_PER_PLAYER)

# ── Hand evaluation (v2 engine) ──

def evaluate_hand(scores: list[int]) -> dict:
    """scores = [4,4,2,2,1] → {rank: 6, name: '两对'}"""
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
    return (hand["rank"], sum(scores), max(scores))

def calc_scores(words: list[str], card_ids: list[str]) -> list[int]:
    """返回每张卡的命中数列表"""
    return [sum(1 for w in words if w in _card_keywords(cid)) for cid in card_ids]

# ── AI decision engine ──

def _ai_decision(
    card_ids: list[str],
    round_num: int,
    community_words: list[str],
    pot: int,
    current_bet: int,
) -> dict:
    """AI 基于当前手牌质量做决定."""
    revealed = community_words[:round_num] if round_num <= len(community_words) else community_words
    scores = calc_scores(revealed, card_ids)
    hand = evaluate_hand(scores)
    quality = hand["rank"]

    # rank=1~3 → strong, 4~5 → medium, 6~8 → weak
    if quality <= 3:
        # Strong hand → always call/check
        if current_bet == 0:
            return {"action": "check", "amount": 0}
        return {"action": "call", "amount": current_bet}
    if quality <= 5:
        # Medium → call small, fold big
        if current_bet == 0:
            return {"action": "check", "amount": 0}
        if current_bet <= 50 or random.random() < 0.4:
            return {"action": "call", "amount": current_bet}
        return {"action": "fold", "amount": 0}
    # Weak → fold 60%, bluff 40%
    if random.random() < 0.4:
        return {"action": "call", "amount": current_bet}
    return {"action": "fold", "amount": 0}

# ── Game state helpers ──

def _next_round_phase(game: dict) -> int:
    conn = get_conn()
    new_round = game["round"] + 1
    revealed = game["revealed_mask"]
    if new_round <= ROUNDS:
        revealed |= 1 << (new_round - 1)
    conn.execute("UPDATE poker_games SET round=?, revealed_mask=? WHERE id=?", [new_round, revealed, game["id"]])
    conn.commit()
    return new_round

def _get_players(game_id: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM poker_players WHERE game_id=? ORDER BY id", [game_id]).fetchall()
    return [dict(r) for r in rows]

def _get_actions(game_id: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM poker_actions WHERE game_id=? ORDER BY id", [game_id]).fetchall()
    return [dict(r) for r in rows]

def _record_action(game_id: int, player_id: int, action: str, amount: int, round_num: int):
    conn = get_conn()
    conn.execute("INSERT INTO poker_actions (game_id, player_id, action, amount, round) VALUES (?,?,?,?,?)",
                 [game_id, player_id, action, amount, round_num])
    if action == "fold":
        conn.execute("UPDATE poker_players SET folded=1 WHERE id=?", [player_id])
    if amount > 0:
        conn.execute("UPDATE poker_players SET total_bet=total_bet+? WHERE id=?", [amount, player_id])
        conn.execute("UPDATE poker_games SET pot=pot+? WHERE id=?", [amount, game_id])
    conn.commit()

# ── Main service ──

def create_game() -> dict:
    """创建一局5卡扑克."""
    conn = get_conn()
    bal = get_balance(conn)
    human_balance = bal["balance"]

    if human_balance < ANTE:
        raise ValueError(f"Insufficient IP: need {ANTE}, have {human_balance}")

    # 每人抽5张
    human_cards = _pick_human_cards(conn)
    cardsets = [human_cards] + [_pick_ai_cards() for _ in range(1)]

    words = _pick_community_words()

    # 扣人类底注
    total_ante = ANTE * 2
    human_bal_after = human_balance - ANTE
    conn.execute("UPDATE currency SET balance=?, spent=spent+? WHERE id=1", [human_bal_after, ANTE])
    conn.execute(
        "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
        [-ANTE, human_bal_after, "poker",
         f"poker_ante:{int(datetime.now().timestamp())}",
         "词牌对决底注"],
    )

    # 建游戏
    conn.execute("INSERT INTO poker_games (status, pot, round, community_words, revealed_mask) VALUES ('active', ?, 1, ?, 1)",
                 [total_ante, json.dumps(words)])
    game_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    # 建玩家 (card_id存JSON数组, card_name/card_rarity存第一个卡的用于显示)
    for i, cids in enumerate(cardsets):
        first = _card_data(cids[0])
        conn.execute(
            """INSERT INTO poker_players
               (game_id, player_type, card_id, card_name, card_rarity, balance_before, total_bet)
               VALUES (?,?,?,?,?,?,?)""",
            [game_id, "human" if i == 0 else "ai",
             json.dumps(cids), first["name"], first["rarity"],
             human_balance if i == 0 else 99999, 0],
        )

    conn.commit()

    # 记录底注
    for p in _get_players(game_id):
        conn.execute("INSERT INTO poker_actions (game_id, player_id, action, amount, round) VALUES (?,?,?,?,?)",
                     [game_id, p["id"], "ante", ANTE, 0])
    conn.execute("UPDATE poker_games SET pot=? WHERE id=?", [total_ante, game_id])
    conn.commit()

    logger.info("Game #%d created — human=%s words=%s", game_id, human_cards, words)
    return get_game_state(game_id)

def get_game_state(game_id: int) -> dict:
    conn = get_conn()
    game = conn.execute("SELECT * FROM poker_games WHERE id=?", [game_id]).fetchone()
    if not game:
        return None
    game = dict(game)
    players = _get_players(game_id)
    actions = _get_actions(game_id)
    words = json.loads(game["community_words"])

    # Only count revealed words for progressive scoring
    revealed_words = [w for i, w in enumerate(words) if (game["revealed_mask"] >> i) & 1]
    # Per-round bet amounts
    round_bets_map: dict[int, list[int]] = {}
    for p in players:
        round_bets_map[p["id"]] = [0] * ROUNDS
    for a in actions:
        if a["action"] in ("bet", "call", "raise") and a["round"] >= 1 and a["round"] <= ROUNDS:
            round_bets_map[a["player_id"]][a["round"] - 1] += a["amount"]
    player_list = []
    for p in players:
        card_ids = json.loads(p["card_id"])
        scores = calc_scores(revealed_words, card_ids)
        hand = evaluate_hand(scores)
        entry = {
            "id": p["id"],
            "player_type": p["player_type"],
            "total_bet": p["total_bet"],
            "round_bets": round_bets_map.get(p["id"], [0] * ROUNDS),
            "folded": bool(p["folded"]),
            "is_winner": bool(p["is_winner"]),
            "match_count": p["match_count"],
            "cards": [_card_data(cid) for cid in card_ids],
            "scores": scores,
            "hand": hand,
        }
        if p["player_type"] == "human":
            entry["balance_before"] = p["balance_before"]
        player_list.append(entry)

    round_num = game["round"]
    actions_this_round = [a for a in actions if a["round"] == round_num]
    acted_ids = {a["player_id"] for a in actions_this_round}
    human = next((p for p in players if p["player_type"] == "human"), None)
    human_acted = human and human["id"] in acted_ids
    can_act = human and not human["folded"] and round_num <= ROUNDS and not human_acted

    non_folded_ids = {p["id"] for p in players if not p["folded"]}
    phase = "completed" if game["status"] == "completed" else \
            "showdown" if round_num > ROUNDS else "betting"

    acting_player_id = None
    if phase == "betting" and round_num <= ROUNDS:
        for p in players:
            if not p["folded"] and p["id"] not in acted_ids:
                acting_player_id = p["id"]
                break

    round_actions = [a for a in actions if a["round"] == round_num]
    current_bet = max((a["amount"] for a in round_actions if a["action"] in ("bet", "raise")), default=0)

    result = {
        "game_id": game["id"],
        "status": game["status"],
        "phase": phase,
        "round": round_num,
        "pot": game["pot"],
        "community_words": [
            {"word": words[i] if (game["revealed_mask"] >> i) & 1 else None,
             "revealed": bool((game["revealed_mask"] >> i) & 1), "index": i}
            for i in range(min(len(words), ROUNDS))
        ],
        "audio_words": words[:ROUNDS],
        "players": player_list,
        "human_player_id": human["id"] if human else None,
        "can_act": can_act,
        "acting_player_id": acting_player_id,
        "current_bet": current_bet,
    }

    if game["status"] == "completed":
        result["showdown"] = _compute_showdown(players, words)

    return result

def _compute_showdown(players: list[dict], words: list[str]) -> dict:
    all_results = []
    for p in players:
        card_ids = json.loads(p["card_id"])
        scores = calc_scores(words, card_ids)
        hand = evaluate_hand(scores)
        cards_data = [_card_data(cid) for cid in card_ids]
        all_results.append({
            "player_id": p["id"],
            "player_type": p["player_type"],
            "cards": cards_data,
            "scores": scores,
            "hand": hand,
            "folded": bool(p["folded"]),
            "is_winner": bool(p["is_winner"]),
        })

    active = [r for r in all_results if not r["folded"]]
    active.sort(key=lambda r: hand_sort_key(r["hand"], r["scores"]), reverse=True)
    winner = active[0] if active else None

    return {
        "results": all_results,
        "winner_player_id": winner["player_id"] if winner else None,
    }

def player_action(game_id: int, action: str, amount: int = 0) -> dict:
    conn = get_conn()
    game = conn.execute("SELECT * FROM poker_games WHERE id=?", [game_id]).fetchone()
    if not game or game["status"] != "active":
        raise ValueError("Game not active")
    game = dict(game)
    players = _get_players(game_id)
    human = next((p for p in players if p["player_type"] == "human"), None)
    if not human or human["folded"]:
        raise ValueError("Human player folded")

    round_num = game["round"]
    if round_num > ROUNDS:
        raise ValueError("Game already at showdown")

    logger.info("Game #%d round %d — human action=%s amount=%d", game_id, round_num, action, amount)

    balance = get_balance(conn)
    bal_now = balance["balance"]
    if action in ("bet", "raise") and amount > 0:
        if amount < MIN_BET:
            amount = MIN_BET
        if amount > MAX_BET:
            amount = MAX_BET
        if amount > bal_now:
            amount = bal_now
        new_bal = bal_now - amount
        conn.execute("UPDATE currency SET balance=?, spent=spent+? WHERE id=1", [new_bal, amount])
        conn.execute(
            "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
            [-amount, new_bal, "poker", f"poker_bet:{game_id}:{human['id']}:{round_num}", "词牌对决下注"],
        )

    _record_action(game_id, human["id"], action, amount, round_num)

    words = json.loads(game["community_words"])
    ai_players = [p for p in players if p["player_type"] == "ai" and not p["folded"]]
    current_bet = amount
    all_ai_folded = True

    for ai in ai_players:
        card_ids = json.loads(ai["card_id"])
        decision = _ai_decision(
            card_ids=card_ids, round_num=round_num,
            community_words=words, pot=game["pot"], current_bet=current_bet,
        )
        ai_action = decision["action"]
        if ai_action == "fold":
            conn.execute("UPDATE poker_players SET folded=1 WHERE id=?", [ai["id"]])
            _record_action(game_id, ai["id"], "fold", 0, round_num)
        else:
            all_ai_folded = False
            if current_bet == 0:
                _record_action(game_id, ai["id"], "check", 0, round_num)
            else:
                _record_action(game_id, ai["id"], "call", current_bet, round_num)

    players = _get_players(game_id)
    non_folded_ai = [p for p in players if p["player_type"] == "ai" and not p["folded"]]

    if len(non_folded_ai) == 0:
        logger.info("Game #%d round %d — all AI folded, human wins pot=%d", game_id, round_num, game["pot"])
        conn.execute("UPDATE poker_players SET is_winner=1 WHERE id=?", [human["id"]])
        bal = get_balance(conn)
        new_bal = bal["balance"] + game["pot"]
        conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=1", [new_bal, game["pot"]])
        conn.execute(
            "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
            [game["pot"], new_bal, "poker", f"poker_win:{game_id}:{human['id']}", "词牌对决胜利（AI全弃）"],
        )
        conn.execute("UPDATE poker_games SET status='completed', winner_player_id=?, winner_match_count=0, completed_at=unixepoch() WHERE id=?",
                     [human["id"], game_id])
        conn.commit()
        return get_game_state(game_id)

    all_actions = _get_actions(game_id)
    round_actions_list = [a for a in all_actions if a["round"] == round_num]
    acted = {a["player_id"] for a in round_actions_list}
    non_folded = [p for p in players if not p["folded"]]
    all_acted = all(p["id"] in acted for p in non_folded)

    result = None
    if all_acted:
        if round_num >= ROUNDS:
            logger.info("Game #%d round %d — all acted, going to showdown", game_id, round_num)
            result = _run_showdown(game_id)
        else:
            logger.info("Game #%d round %d → %d", game_id, round_num, round_num + 1)
            _next_round_phase(game)
            result = get_game_state(game_id)
    else:
        result = get_game_state(game_id)

    return result

def _run_showdown(game_id: int) -> dict:
    conn = get_conn()
    game = conn.execute("SELECT * FROM poker_games WHERE id=?", [game_id]).fetchone()
    game = dict(game)
    players = _get_players(game_id)
    words = json.loads(game["community_words"])
    active_players = [p for p in players if not p["folded"]]

    if not active_players:
        conn.execute("UPDATE poker_games SET status='completed' WHERE id=?", [game_id])
        conn.commit()
        return get_game_state(game_id)

    results = []
    for p in active_players:
        card_ids = json.loads(p["card_id"])
        scores = calc_scores(words, card_ids)
        hand = evaluate_hand(scores)
        results.append({"player": p, "scores": scores, "hand": hand})

    results.sort(key=lambda r: hand_sort_key(r["hand"], r["scores"]), reverse=True)

    winner = results[0]["player"]
    is_tie = len(results) > 1 and hand_sort_key(results[0]["hand"], results[0]["scores"]) == hand_sort_key(results[1]["hand"], results[1]["scores"])

    logger.info("Game #%d showdown — winner=%s hand=%s tie=%s",
                game_id, winner["player_type"], results[0]["hand"]["name"], is_tie)

    if is_tie:
        tied = [r for r in results if hand_sort_key(r["hand"], r["scores"]) == hand_sort_key(results[0]["hand"], results[0]["scores"])]
        share = game["pot"] // len(tied)
        for r in tied:
            conn.execute("UPDATE poker_players SET is_winner=1 WHERE id=?", [r["player"]["id"]])
            if r["player"]["player_type"] == "human":
                bal = get_balance(conn)
                new_bal = bal["balance"] + share
                conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=1", [new_bal, share])
                conn.execute(
                    "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
                    [share, new_bal, "poker", f"poker_win:{game_id}:{r['player']['id']}", "词牌对决胜利"],
                )
    else:
        conn.execute("UPDATE poker_players SET is_winner=1 WHERE id=?", [winner["id"]])
        conn.execute("UPDATE poker_games SET winner_player_id=? WHERE id=?", [winner["id"], game_id])
        if winner["player_type"] == "human":
            bal = get_balance(conn)
            new_bal = bal["balance"] + game["pot"]
            conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=1", [new_bal, game["pot"]])
            conn.execute(
                "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
                [game["pot"], new_bal, "poker", f"poker_win:{game_id}:{winner['id']}", "词牌对决胜利"],
            )

    conn.execute("UPDATE poker_games SET status='completed', completed_at=unixepoch() WHERE id=?", [game_id])
    conn.commit()
    return get_game_state(game_id)

def get_game_history(limit: int = 20) -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM poker_games WHERE status='completed' ORDER BY id DESC LIMIT ?", [limit]).fetchall()
    history = []
    for game in rows:
        players = conn.execute("SELECT * FROM poker_players WHERE game_id=?", [game["id"]]).fetchall()
        human = next((dict(p) for p in players if p["player_type"] == "human"), None)
        winner = next((dict(p) for p in players if p["is_winner"]), None)
        history.append({
            "game_id": game["id"],
            "pot": game["pot"],
            "human_card": human["card_name"] if human else None,
            "is_win": winner and winner["player_type"] == "human",
            "rounds": game["round"],
            "completed_at": game["completed_at"],
        })
    return history
