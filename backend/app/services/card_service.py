"""Card system business logic — vocab signature extraction, match scoring, draw."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from config import get_config


# ── Helpers ──

_DECK_META: dict[str, object] | None = None
_STOP_WORDS: set[str] | None = None
_WORD_RE = re.compile(r"[a-zA-Z']+")


def _get_stop_words() -> set[str]:
    global _STOP_WORDS
    if _STOP_WORDS is None:
        cfg = get_config()
        _STOP_WORDS = set(cfg["cards"]["signature"]["stop_words"])
    return _STOP_WORDS


def _stem(word: str) -> str:
    """Simple stem merge: strip common suffixes if config.stem_merge is on."""
    cfg = get_config()
    if not cfg["cards"]["signature"]["stem_merge"]:
        return word.lower()
    w = word.lower().rstrip("s")
    for suf in ("ing", "ed", "ly", "tion", "sion", "ment", "ness", "able", "ible"):
        if w.endswith(suf) and len(w) > len(suf) + 2:
            w = w[: -len(suf)]
            break
    return w.rstrip("e") or w


def extract_keywords(text: str) -> list[str]:
    """Extract content words from a text: lowercase, de-stop, optional stem."""
    stop = _get_stop_words()
    words = _WORD_RE.findall(text.lower())
    result: list[str] = []
    for w in words:
        w = _stem(w)
        if w and w not in stop and len(w) > 1:
            result.append(w)
    return result


def build_vocab_signature(card: dict[str, Any]) -> list[str]:
    """Build a deduplicated vocab signature from a card's title + motto + lore."""
    texts = [card.get("title", "")]
    if card.get("motto"):
        texts.append(card["motto"])
    if card.get("lore") and isinstance(card["lore"], dict):
        texts.append(card["lore"].get("english", ""))
    keywords = []
    for t in texts:
        keywords.extend(extract_keywords(t))
    return list(dict.fromkeys(keywords))  # dedup, preserve order


def get_deck_meta() -> dict[str, Any]:
    """Return the deck-level metadata (season, title, subtitle, theme)."""
    global _DECK_META
    if _DECK_META is not None:
        return _DECK_META
    cfg = get_config()
    path = Path(cfg["cards"]["data_path"])
    if not path.exists():
        from config import resolve_path
        path = resolve_path(cfg["cards"]["data_path"])
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, dict):
        _DECK_META = {k: data[k] for k in ["season", "title", "subtitle", "theme"] if k in data}
    else:
        _DECK_META = {"season": 1, "title": "", "subtitle": "", "theme": ""}
    return _DECK_META

def load_card_data() -> list[dict[str, Any]]:
    """Load card data from the JSON file specified in config."""
    from config import resolve_path
    cfg = get_config()
    path = resolve_path(cfg["cards"]["data_path"])
    with open(path) as f:
        data = json.load(f)
        # fashion.json wraps cards in { season, title, subtitle, theme, cards: [...] }
        if isinstance(data, dict) and "cards" in data:
            return data["cards"]
        return data


# ── Draw logic ──

def compute_match_score(
    reviewed_words: set[str],
    card_signature: list[str],
) -> float:
    """Return the fraction of the card's signature words the user has reviewed."""
    if not card_signature:
        return 0.0
    hits = sum(1 for w in card_signature if w in reviewed_words)
    return hits / len(card_signature)


def get_qualified_draw_candidates(
    reviewed_words: set[str],
    all_cards: list[dict[str, Any]],
    card_signatures: dict[str, list[str]],
    obtained_card_ids: set[str],
) -> list[tuple[str, str, float, int, int]]:
    """Return (card_id, name, match_score, hits, total) for eligible draw cards."""
    cfg = get_config()
    threshold = cfg["cards"]["draw"]["coverage_threshold"]
    candidates: list[tuple[str, str, float, int, int]] = []
    for card in all_cards:
        cid = card["id"]
        if cid in obtained_card_ids:
            continue
        sig = card_signatures.get(cid, [])
        score = compute_match_score(reviewed_words, sig)
        hits = sum(1 for w in sig if w in reviewed_words)
        if score >= threshold:
            candidates.append((cid, card.get("name", cid), score, hits, len(sig)))
    candidates.sort(key=lambda x: -x[2])
    return candidates
