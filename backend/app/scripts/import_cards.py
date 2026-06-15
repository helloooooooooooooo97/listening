"""One-time import: read fashion.json, extract vocab signatures, seed card_collection."""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend/app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import get_conn, locked, init_db
from services.card_service import build_vocab_signature, load_card_data


@locked
def import_cards():
    init_db()
    conn = get_conn()
    cards = load_card_data()
    # Load full data structure for season info
    import json as _json
    _data_path = __import__('config').get_config()['cards']['data_path']
    _full_path = Path(__file__).resolve().parent.parent.parent.parent / _data_path
    with open(_full_path) as _f:
        _full = _json.load(_f)
    _season = _full.get('season', 1) if isinstance(_full, dict) else 1

    # Seed card_collection (insert if not exists)
    for card in cards:
        cid = card["id"]
        season = _season
        conn.execute(
            "INSERT OR IGNORE INTO card_collection (card_id, season) VALUES (?, ?)",
            [cid, season],
        )

        # Extract and store vocab signature
        sig = build_vocab_signature(card)
        source_fields = []
        if card.get("title"):
            source_fields.append("title")
        if card.get("motto"):
            source_fields.append("motto")
        if card.get("lore"):
            source_fields.append("lore")
        conn.execute(
            """INSERT OR REPLACE INTO card_vocab_signatures (card_id, vocab_list, source)
               VALUES (?, ?, ?)""",
            [cid, json.dumps(sig), ",".join(source_fields)],
        )

    conn.commit()
    print(f"✅ Imported {len(cards)} cards with vocab signatures.")


if __name__ == "__main__":
    import_cards()
