"""Poker game service — Vocabulary Hold'em core logic."""
from __future__ import annotations

import json
import random
from datetime import datetime

from database import get_conn
from log_config import get_logger
from services.card_service import load_card_data
from services.currency_service import get_balance

logger = get_logger("poker")

# ── Constants ──

ANTE = 10
MIN_BET = 5
MAX_BET = 1000
ROUNDS = 5


# ── Helpers ──

def _all_keywords() -> list[str]:
    """Return the union of all card keywords across all seasons."""
    cards = load_card_data()
    seen: set[str] = set()
    result: list[str] = []
    for card in cards:
        for kw in card.get("keywords", []):
            if kw.lower() not in seen:
                seen.add(kw.lower())
                result.append(kw.lower())
    return result


def _pick_community_words() -> list[str]:
    """Pick 5 unique keywords as the community word pool."""
    pool = _all_keywords()
    if len(pool) < 5:
        # Fallback: should never happen with real data
        pool = ["fashion", "elegance", "freedom", "art", "innovation"]
    return random.sample(pool, 5)


def _card_keywords(card_id: str) -> set[str]:
    """Return the keyword set for a given card."""
    cards = load_card_data()
    for card in cards:
        if card["id"] == card_id:
            return {kw.lower() for kw in card.get("keywords", [])}
    return set()


def _card_name(card_id: str) -> str:
    cards = load_card_data()
    for card in cards:
        if card["id"] == card_id:
            return card.get("name", card_id)
    return card_id


def _card_rarity(card_id: str) -> str:
    cards = load_card_data()
    for card in cards:
        if card["id"] == card_id:
            return card.get("rarity", "R")
    return "R"


def _card_png(card_id: str) -> str:
    """Return the PNG filename for a card (without extension)."""
    cards = load_card_data()
    for card in cards:
        if card["id"] == card_id:
            return card.get("png", "")
    return ""


RARITY_ORDER = {"UR": 4, "SSR": 3, "SR": 2, "R": 1}


def _rarity_score(rarity: str) -> int:
    return RARITY_ORDER.get(rarity, 0)


# ── AI decision engine ──

def _ai_decision(
    card_id: str,
    round_num: int,
    community_words: list[str],
    pot: int,
    current_bet: int,
) -> dict:
    """Decide AI action based on revealed words vs card keywords.

    AI can: check (pass), call (match bet), fold (quit).
    No raise to keep the game simple.
    """
    revealed = community_words[:round_num] if round_num <= len(community_words) else community_words
    my_kw = _card_keywords(card_id)
    matches = sum(1 for w in revealed if w in my_kw)

    # 0 matches → fold 70%, bluff 30%
    if matches == 0:
        if random.random() < 0.3:
            return {"action": "call", "amount": current_bet}
        return {"action": "fold", "amount": 0}

    # 1 match → cautious
    if matches == 1:
        if current_bet == 0:
            return {"action": "check", "amount": 0}
        if current_bet <= 10 or random.random() < 0.4:
            return {"action": "call", "amount": current_bet}
        return {"action": "fold", "amount": 0}

    # 2 matches → confident
    if matches == 2:
        if current_bet == 0:
            return {"action": "check", "amount": 0}
        return {"action": "call", "amount": current_bet}

    # 3+ matches → very confident, always call
    return {"action": "call", "amount": current_bet}


# ── Game state helpers ──

def _next_round_phase(game: dict) -> int:
    """Advance round by 1. Returns the new round number."""
    conn = get_conn()
    new_round = game["round"] + 1
    revealed = game["revealed_mask"]
    if new_round <= ROUNDS:
        revealed |= 1 << (new_round - 1)  # set bit for the new word
    conn.execute(
        "UPDATE poker_games SET round=?, revealed_mask=? WHERE id=?",
        [new_round, revealed, game["id"]],
    )
    conn.commit()
    return new_round


def _get_players(game_id: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM poker_players WHERE game_id=? ORDER BY id", [game_id]
    ).fetchall()
    return [dict(r) for r in rows]


def _get_actions(game_id: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM poker_actions WHERE game_id=? ORDER BY id", [game_id]
    ).fetchall()
    return [dict(r) for r in rows]


def _count_actions_this_round(game_id: int, round_num: int) -> int:
    conn = get_conn()
    return conn.execute(
        "SELECT COUNT(*) FROM poker_actions WHERE game_id=? AND round=?",
        [game_id, round_num],
    ).fetchone()[0]


def _record_action(game_id: int, player_id: int, action: str, amount: int, round_num: int):
    conn = get_conn()
    conn.execute(
        "INSERT INTO poker_actions (game_id, player_id, action, amount, round) VALUES (?,?,?,?,?)",
        [game_id, player_id, action, amount, round_num],
    )
    if action == "fold":
        conn.execute("UPDATE poker_players SET folded=1 WHERE id=?", [player_id])
    if amount > 0:
        conn.execute(
            "UPDATE poker_players SET total_bet=total_bet+? WHERE id=?",
            [amount, player_id],
        )
        conn.execute(
            "UPDATE poker_games SET pot=pot+? WHERE id=?",
            [amount, game_id],
        )
    conn.commit()


# ── Main service interface ──

def create_game(human_card_id: str) -> dict:
    """Create a new poker game with 1 human + 3 AI opponents.

    Returns the full game state.
    """
    conn = get_conn()
    bal = get_balance(conn)
    human_balance = bal["balance"]

    if human_balance < ANTE:
        raise ValueError(f"Insufficient IP: need {ANTE}, have {human_balance}")

    # Ensure human owns the card
    row = conn.execute(
        "SELECT obtained FROM card_collection WHERE card_id=? AND obtained=1",
        [human_card_id],
    ).fetchone()
    if not row:
        raise ValueError(f"Card '{human_card_id}' not obtained yet")

    # Choose community words
    words = _pick_community_words()

    # Select AI opponent cards (random from collection, excluding human's pick)
    all_cards = load_card_data()
    ai_pool = [c["id"] for c in all_cards if c["id"] != human_card_id]
    ai_picks = random.sample(ai_pool, min(3, len(ai_pool)))
    while len(ai_picks) < 3:
        ai_picks.append(random.choice(all_cards)["id"])

    # Deduct human ante from real balance
    total_ante = ANTE * 4
    human_bal_after = human_balance - ANTE
    conn.execute("UPDATE currency SET balance=?, spent=spent+? WHERE id=1", [human_bal_after, ANTE])
    conn.execute(
        "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
        [-ANTE, human_bal_after, "poker",
         f"poker_ante:{human_card_id}:{int(datetime.now().timestamp())}",
         "词牌对决底注"],
    )

    # Create game
    conn.execute(
        """INSERT INTO poker_games (status, pot, round, community_words, revealed_mask)
           VALUES ('active', ?, 1, ?, 1)""",
        [total_ante, json.dumps(words)],
    )
    game_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Create players
    players_data = [
        (game_id, "human", human_card_id, human_balance, 0),
        (game_id, "ai", ai_picks[0], 99999, 0),
        (game_id, "ai", ai_picks[1], 99999, 0),
        (game_id, "ai", ai_picks[2], 99999, 0),
    ]
    for pd in players_data:
        conn.execute(
            """INSERT INTO poker_players
               (game_id, player_type, card_id, card_name, card_rarity, balance_before, total_bet)
               VALUES (?,?,?,?,?,?,?)""",
            [pd[0], pd[1], pd[2], _card_name(pd[2]), _card_rarity(pd[2]), pd[3], pd[4]],
        )

    conn.commit()

    # Record ante action for each player
    ante_action_id = _count_actions_this_round(game_id, 0) + 1
    all_players = _get_players(game_id)
    for p in all_players:
        conn.execute(
            "INSERT INTO poker_actions (game_id, player_id, action, amount, round) VALUES (?,?,?,?,?)",
            [game_id, p["id"], "ante", ANTE, 0],
        )
    conn.execute("UPDATE poker_games SET pot=? WHERE id=?", [total_ante, game_id])
    conn.commit()

    logger.info("Game #%d created — human card=%s words=%s pot=%d",
                game_id, human_card_id, words, total_ante)

    return get_game_state(game_id)


def get_game_state(game_id: int) -> dict:
    """Return the current game state, hiding AI card details."""
    conn = get_conn()
    game = conn.execute("SELECT * FROM poker_games WHERE id=?", [game_id]).fetchone()
    if not game:
        return None
    game = dict(game)
    players = _get_players(game_id)
    actions = _get_actions(game_id)

    # Parse community words
    words = json.loads(game["community_words"])
    revealed = bin(game["revealed_mask"]).count("1")  # count of revealed words

    player_list = []
    for p in players:
        entry = {
            "id": p["id"],
            "player_type": p["player_type"],
            "total_bet": p["total_bet"],
            "folded": bool(p["folded"]),
            "is_winner": bool(p["is_winner"]),
            "match_count": p["match_count"],
        }
        if p["player_type"] == "human":
            entry["card_id"] = p["card_id"]
            entry["card_name"] = p["card_name"]
            entry["card_rarity"] = p["card_rarity"]
            entry["keywords"] = list(_card_keywords(p["card_id"]))
            entry["balance_before"] = p["balance_before"]
        else:
            # AI: hide card, show masked info
            entry["card_id"] = None
            entry["card_name"] = None
            entry["keywords"] = None
            entry["balance_before"] = None
        player_list.append(entry)

    # Determine whose turn it is
    round_num = game["round"]
    actions_this_round = [a for a in actions if a["round"] == round_num]
    acted_player_ids = {a["player_id"] for a in actions_this_round}
    active_players = [p for p in players if not p["folded"]]

    # Determine if player can act
    human = next((p for p in players if p["player_type"] == "human"), None)
    human_acted = human and human["id"] in acted_player_ids
    can_act = human and not human["folded"] and round_num <= ROUNDS and not human_acted

    active_count = len([p for p in active_players if not p["folded"]])
    phase = "completed" if game["status"] == "completed" else \
            "showdown" if round_num > ROUNDS else \
            "betting"

    # First non-folded player who hasn't acted this round
    acting_player_id = None
    if phase == "betting" and round_num <= ROUNDS:
        non_folded = [p for p in players if not p["folded"]]
        for p in non_folded:
            if p["id"] not in acted_player_ids:
                acting_player_id = p["id"]
                break

    # Current bet to match (highest bet this round excluding antes)
    round_actions = [a for a in actions if a["round"] == round_num]
    current_bet = max((a["amount"] for a in round_actions if a["action"] in ("bet", "raise")), default=0)

    result = {
        "game_id": game["id"],
        "status": game["status"],
        "phase": phase,
        "round": round_num,
        "pot": game["pot"],
        "community_words": [
            {
                "word": words[i] if (game["revealed_mask"] >> i) & 1 else None,
                "revealed": bool((game["revealed_mask"] >> i) & 1),
                "index": i,
            }
            for i in range(min(len(words), ROUNDS))
        ],
        "audio_words": words[:ROUNDS],
        "players": player_list,
        "human_player_id": human["id"] if human else None,
        "can_act": can_act,
        "acting_player_id": acting_player_id,
        "current_bet": current_bet,
        "total_actions": len(actions),
    }

    # Add showdown data for completed games
    if game["status"] == "completed":
        result["showdown"] = _compute_showdown(players, words)

    return result


def _compute_showdown(players: list[dict], words: list[str]) -> dict:
    """Compute showdown results — all players' potential score against ALL words."""
    all_results = []
    for p in players:
        kw = _card_keywords(p["card_id"])
        matches = sum(1 for w in words if w in kw)  # against ALL community words
        all_results.append({
            "player_id": p["id"],
            "player_type": p["player_type"],
            "card_name": _card_name(p["card_id"]),
            "card_rarity": p["card_rarity"],
            "card_png": _card_png(p["card_id"]),
            "keywords": list(kw),
            "matches": matches,
            "folded": bool(p["folded"]),
            "is_winner": bool(p["is_winner"]),
        })

    active = [r for r in all_results if not r["folded"]]
    if not active:
        return {"results": all_results, "tie": False, "winner_player_id": None}

    winner = next((r for r in all_results if r["is_winner"]), None)
    return {"results": all_results, "tie": False, "winner_player_id": winner["player_id"] if winner else None}


def player_action(game_id: int, action: str, amount: int = 0) -> dict:
    """Process a player action, run AI responses, advance round if needed."""
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

    logger.info("Game #%d round %d — human action=%s amount=%d",
                game_id, round_num, action, amount)

    # Validate action
    balance = get_balance(conn)
    bal_now = balance["balance"]
    if action in ("bet", "raise") and amount > 0:
        if amount < MIN_BET:
            amount = MIN_BET
        if amount > MAX_BET:
            amount = MAX_BET
        if amount > bal_now:
            amount = bal_now  # all-in
        # Deduct from currency balance
        new_bal = bal_now - amount
        conn.execute("UPDATE currency SET balance=?, spent=spent+? WHERE id=1", [new_bal, amount])
        conn.execute(
            "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
            [-amount, new_bal, "poker", f"poker_bet:{game_id}:{human['id']}:{round_num}", "词牌对决下注"],
        )

    # Record human action
    _record_action(game_id, human["id"], action, amount, round_num)

    # Run AI actions
    ai_players = [p for p in players if p["player_type"] == "ai" and not p["folded"]]
    current_bet = amount
    all_ai_folded = True

    for ai in ai_players:
        decision = _ai_decision(
            card_id=ai["card_id"],
            round_num=round_num,
            community_words=json.loads(game["community_words"]),
            pot=game["pot"],
            current_bet=current_bet,
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

    # Re-fetch players so fold state is up-to-date after AI loop
    players = _get_players(game_id)
    non_folded_ai = [p for p in players if p["player_type"] == "ai" and not p["folded"]]

    # If all AI folded (either in this call or in a previous round), human wins immediately
    if len(non_folded_ai) == 0:
        logger.info("Game #%d round %d — all AI folded, human wins pot=%d",
                    game_id, round_num, game["pot"])
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

    # Check if round is complete (all non-folded players acted)
    all_actions = _get_actions(game_id)
    round_actions = [a for a in all_actions if a["round"] == round_num]
    acted = {a["player_id"] for a in round_actions}

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
        logger.info("Game #%d round %d — not all acted yet (non_folded=%d acted=%d)",
                    game_id, round_num, len(non_folded), len(acted))
        result = get_game_state(game_id)

    # Re-fetch updated game for response
    return result


def _run_showdown(game_id: int) -> dict:
    """Compute winner, settle pot, mark game complete."""
    conn = get_conn()
    game = conn.execute("SELECT * FROM poker_games WHERE id=?", [game_id]).fetchone()
    game = dict(game)
    players = _get_players(game_id)
    words = json.loads(game["community_words"])
    active_players = [p for p in players if not p["folded"]]

    if not active_players:
        # Everyone folded? shouldn't happen with last-player-standing rule
        conn.execute("UPDATE poker_games SET status='completed' WHERE id=?", [game_id])
        conn.commit()
        return get_game_state(game_id)

    # Calculate match counts
    results = []
    for p in active_players:
        kw = _card_keywords(p["card_id"])
        matches = sum(1 for w in words if w in kw)
        rarity = _rarity_score(p["card_rarity"])
        results.append({"player": p, "matches": matches, "rarity": rarity})
        conn.execute("UPDATE poker_players SET match_count=? WHERE id=?", [matches, p["id"]])

    # Sort: most matches first, then highest rarity
    results.sort(key=lambda r: (r["matches"], r["rarity"]), reverse=True)

    winner = results[0]["player"]
    is_tie = len(results) > 1 and results[0]["matches"] == results[1]["matches"] and results[0]["rarity"] == results[1]["rarity"]

    logger.info("Game #%d showdown — %d active, winner=%s matches=%d tie=%s",
                game_id, len(active_players), winner["player_type"], results[0]["matches"], is_tie)

    if is_tie:
        # Split pot equally
        share = game["pot"] // len([r for r in results if r["matches"] == results[0]["matches"] and r["rarity"] == results[0]["rarity"]])
        for r in results:
            if r["matches"] == results[0]["matches"] and r["rarity"] == results[0]["rarity"]:
                conn.execute("UPDATE poker_players SET is_winner=1, match_count=? WHERE id=?", [r["matches"], r["player"]["id"]])
                if r["player"]["player_type"] == "human":
                    bal = get_balance(conn)
                    new_bal = bal["balance"] + share
                    conn.execute("UPDATE currency SET balance=?, earned=earned+? WHERE id=1", [new_bal, share])
                    conn.execute(
                        "INSERT INTO currency_transactions (amount, balance_after, source, ref_id, ref_summary) VALUES (?,?,?,?,?)",
                        [share, new_bal, "poker", f"poker_win:{game_id}:{r['player']['id']}", "词牌对决胜利"],
                    )
    else:
        # Winner takes all
        conn.execute("UPDATE poker_players SET is_winner=1 WHERE id=?", [winner["id"]])
        conn.execute(
            "UPDATE poker_games SET winner_player_id=?, winner_match_count=? WHERE id=?",
            [winner["id"], results[0]["matches"], game_id],
        )
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

    result_state = get_game_state(game_id)
    # Build full showdown: ALL players' potential against ALL community words
    all_players = _get_players(game_id)
    all_words = json.loads(game["community_words"])
    full_results = []
    for p in all_players:
        kw = _card_keywords(p["card_id"])
        matches = sum(1 for w in all_words if w in kw)
        full_results.append({
            "player_id": p["id"],
            "player_type": p["player_type"],
            "card_name": _card_name(p["card_id"]),
            "card_rarity": p["card_rarity"],
            "card_png": _card_png(p["card_id"]),
            "keywords": list(kw),
            "matches": matches,
            "folded": bool(p["folded"]),
            "is_winner": p["id"] == winner["id"],
        })
    result_state["showdown"] = {
        "results": full_results,
        "tie": is_tie,
        "winner_player_id": winner["id"],
    }
    return result_state


def get_game_history(limit: int = 20) -> list[dict]:
    """Return recent completed game summaries."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM poker_games WHERE status='completed' ORDER BY id DESC LIMIT ?",
        [limit],
    ).fetchall()
    history = []
    for game in rows:
        players = conn.execute(
            "SELECT * FROM poker_players WHERE game_id=?", [game["id"]]
        ).fetchall()
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
