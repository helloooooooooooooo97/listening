"""Poker game API — Vocabulary Hold'em endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from database import get_conn, locked
from services.poker_service import create_game, get_game_state, player_action, get_game_history
from services.card_service import load_card_data

router = APIRouter(prefix="/api/game/poker", tags=["poker"])


@router.get("/status")
@locked
def status():
    """Return whether the player can start a game (has cards, has IP)."""
    conn = get_conn()
    row = conn.execute("SELECT balance FROM currency WHERE id=1").fetchone()
    balance = row["balance"] if row else 0

    cards = conn.execute(
        "SELECT card_id FROM card_collection WHERE obtained=1"
    ).fetchall()
    owned_cards = [dict(r) for r in cards]

    return {
        "can_play": len(owned_cards) >= 1 and balance >= 10,
        "owned_cards_count": len(owned_cards),
        "balance": balance,
    }


@router.get("/cards")
@locked
def list_playable_cards():
    """Return the user's obtained cards with their keywords for selection."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT card_id FROM card_collection WHERE obtained=1"
    ).fetchall()
    owned_ids = {r["card_id"] for r in rows}
    all_cards = load_card_data()
    result = []
    for card in all_cards:
        if card["id"] in owned_ids:
            result.append({
                "id": card["id"],
                "name": card.get("name", ""),
                "title": card.get("title", ""),
                "rarity": card.get("rarity", ""),
                "png": card.get("png", ""),
                "keywords": card.get("keywords", []),
            })
    return {"cards": result}


@router.post("/create")
@locked
def start_game():
    """Create a new poker game. 每人自动抽5张卡."""
    try:
        state = create_game()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return state


@router.get("/{game_id}")
@locked
def game_state(game_id: int):
    state = get_game_state(game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return state


@router.post("/{game_id}/action")
@locked
def perform_action(game_id: int, data: dict):
    action = data.get("action", "")
    if action not in ("check", "bet", "fold"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
    amount = data.get("amount", 0)
    try:
        state = player_action(game_id, action, amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return state


@router.get("/{game_id}/result")
@locked
def game_result(game_id: int):
    """Return showdown result if game is completed."""
    state = get_game_state(game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Game not found")
    if state["status"] != "completed":
        raise HTTPException(status_code=400, detail="Game not completed yet")
    return state


@router.get("/history/all")
@locked
def history(limit: int = Query(default=20, ge=1, le=50)):
    return {"games": get_game_history(limit)}
