"""Cards API — card list, collection status, draw system."""
from __future__ import annotations

import json
import random
from datetime import datetime

from fastapi import APIRouter, HTTPException
from database import get_conn, locked
from services.card_service import (
    compute_match_score,
    get_qualified_draw_candidates,
    load_card_data,
    get_deck_meta,
)
from config import get_config

router = APIRouter(prefix="/api/cards", tags=["cards"])

# ── In-memory draw session (single-user, lost on restart) ──
_draw_session: dict[str, dict[str, str]] = {}

def _get_card_signatures(conn) -> dict[str, list[str]]:
    rows = conn.execute("SELECT card_id, vocab_list FROM card_vocab_signatures").fetchall()
    return {r["card_id"]: json.loads(r["vocab_list"]) for r in rows}

def _get_obtained_ids(conn) -> set[str]:
    rows = conn.execute("SELECT card_id FROM card_collection WHERE obtained=1").fetchall()
    return {r["card_id"] for r in rows}

def _get_reviewed_words_since(conn, since: str | None) -> set[str]:
    if since:
        rows = conn.execute(
            "SELECT DISTINCT word FROM review_history WHERE created_at > ?", [since]
        ).fetchall()
    else:
        rows = conn.execute("SELECT DISTINCT word FROM review_history").fetchall()
    wp_rows = conn.execute("SELECT DISTINCT word FROM word_progress WHERE reviewed_count > 0").fetchall()
    words = {r["word"] for r in rows}
    words.update(r["word"] for r in wp_rows)
    return words

def _get_last_draw_time(conn) -> str | None:
    row = conn.execute("SELECT drawn_at FROM card_draw_log ORDER BY drawn_at DESC LIMIT 1").fetchone()
    return row["drawn_at"] if row else None

def _pick_unique_words(
    candidates: list[tuple],
    cards_data: list[dict],
) -> list[tuple[str, str, str]]:
    """For each candidate card, pick a word unique to that card from its keywords."""
    result: list[tuple[str, str, str]] = []
    card_words: dict[str, set[str]] = {}
    for c in candidates[:3]:
        card = next((x for x in cards_data if x["id"] == c[0]), {})
        kw = [w.lower() for w in card.get("keywords", [])]
        card_words[c[0]] = set(kw)
    for c in candidates[:3]:
        cid, name = c[0], c[1]
        my_words = card_words[cid]
        other_words = set()
        for other_cid, ws in card_words.items():
            if other_cid != cid:
                other_words |= ws
        unique = my_words - other_words
        if not unique:
            unique = my_words
        word = random.choice(list(unique))
        result.append((cid, name, word))
    return result

# ── Endpoints ──

@router.get("/list")
@locked
def list_cards():
    conn = get_conn()
    cards = load_card_data()
    obtained = _get_obtained_ids(conn)
    signatures = _get_card_signatures(conn)
    result = []
    for card in cards:
        cid = card["id"]
        sig = signatures.get(cid, [])
        result.append({
            "id": cid,
            "name": card.get("name", ""),
            "title": card.get("title", ""),
            "motto": card.get("motto", ""),
            "rarity": card.get("rarity", ""),
            "png": card.get("png", ""),
            "keywords": card.get("keywords", []),
            "vocab_signature": sig,
            "obtained": cid in obtained,
            "season": card.get("season", 1),
        })
    deck = get_deck_meta()
    return {
        "deck": deck,
        "cards": result,
        "total": len(result),
        "obtained": len(obtained),
    }

@router.get("/draw/status")
@locked
def draw_status():
    cfg = get_config()
    conn = get_conn()
    cards = load_card_data()
    obtained = _get_obtained_ids(conn)
    signatures = _get_card_signatures(conn)
    last_draw = _get_last_draw_time(conn)
    reviewed = _get_reviewed_words_since(conn, last_draw)
    min_words = cfg["cards"]["draw"]["min_new_words"]
    candidates = get_qualified_draw_candidates(reviewed, cards, signatures, obtained)
    min_qualified = cfg["cards"]["draw"]["min_qualified_cards"]
    unobtained = len(cards) - len(obtained)
    effective_min = min(min_qualified, unobtained) if unobtained > 0 else min_qualified
    can_draw = len(reviewed) >= min_words and len(candidates) >= effective_min
    return {
        "can_draw": can_draw,
        "new_words_since_last_draw": len(reviewed),
        "min_new_words": min_words,
        "qualified_candidates": len(candidates),
        "min_qualified_cards": min_qualified,
    }

@router.post("/draw")
@locked
def perform_draw():
    cfg = get_config()
    conn = get_conn()
    cards = load_card_data()
    obtained = _get_obtained_ids(conn)
    signatures = _get_card_signatures(conn)
    last_draw = _get_last_draw_time(conn)
    reviewed = _get_reviewed_words_since(conn, last_draw)
    min_words = cfg["cards"]["draw"]["min_new_words"]
    candidates = get_qualified_draw_candidates(reviewed, cards, signatures, obtained)
    if len(reviewed) < min_words:
        raise HTTPException(status_code=400, detail=f"Need {min_words} new words, got {len(reviewed)}")
    min_qualified = cfg["cards"]["draw"]["min_qualified_cards"]
    unobtained = len(cards) - len(obtained)
    effective_min = min(min_qualified, unobtained) if unobtained > 0 else min_qualified
    if len(candidates) < effective_min:
        raise HTTPException(status_code=400, detail=f"Need {effective_min} qualified cards, got {len(candidates)}")
    picks = _pick_unique_words(candidates[:3], cards)
    deck = get_deck_meta()
    deck_title = deck.get("title", "")
    draw_id = datetime.now().isoformat()
    mapping: dict[str, str] = {}
    words_info: list[dict] = []
    for cid, name, word in picks:
        mapping[word] = cid
        words_info.append({"word": word, "deck": deck_title})
    _draw_session[draw_id] = mapping
    random.shuffle(words_info)
    return {"draw_id": draw_id, "words": words_info, "new_words_since_last_draw": len(reviewed)}

@router.post("/draw/pick")
@locked
def pick_word(data: dict):
    draw_id = data.get("draw_id")
    word = data.get("word")
    if not draw_id or not word:
        raise HTTPException(status_code=400, detail="draw_id and word required")
    mapping = _draw_session.get(draw_id)
    if not mapping:
        raise HTTPException(status_code=400, detail="Draw session expired or invalid")
    card_id = mapping.get(word)
    if not card_id:
        raise HTTPException(status_code=400, detail="Word not found in this draw session")
    del _draw_session[draw_id]
    cards = load_card_data()
    card = next((c for c in cards if c["id"] == card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    conn = get_conn()
    row = conn.execute("SELECT obtained FROM card_collection WHERE card_id=?", [card_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Card '{card_id}' not found")
    if row["obtained"]:
        raise HTTPException(status_code=400, detail="Card already obtained")
    signatures = _get_card_signatures(conn)
    last_draw = _get_last_draw_time(conn)
    reviewed = _get_reviewed_words_since(conn, last_draw)
    sig = signatures.get(card_id, [])
    score = compute_match_score(reviewed, sig)
    conn.execute(
        "UPDATE card_collection SET obtained=1, obtained_at=datetime('now'), obtained_by='draw' WHERE card_id=?",
        [card_id],
    )
    conn.execute(
        "INSERT INTO card_draw_log (card_id, match_score, reviewed_words_snapshot) VALUES (?, ?, ?)",
        [card_id, score, len(reviewed)],
    )
    conn.commit()
    return {
        "success": True,
        "card": {
            "id": card_id,
            "name": card.get("name", ""),
            "title": card.get("title", ""),
            "motto": card.get("motto", ""),
            "rarity": card.get("rarity", ""),
            "png": card.get("png", ""),
            "keywords": card.get("keywords", []),
            "match_score": round(score * 100, 1),
        },
    }
