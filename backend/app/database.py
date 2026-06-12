"""SQLite database — single connection with thread-safe locking."""
from __future__ import annotations

import functools
import sqlite3
import threading
from pathlib import Path

def _resolve_db_path() -> Path:
    # Try to load from config; fall back to default
    try:
        from config import resolve_path, get_config
        cfg = get_config()
        return resolve_path(cfg["app"]["data"]["db_path"])
    except Exception:
        return Path(__file__).resolve().parent.parent.parent / "data" / "audio.db"

DB_PATH = _resolve_db_path()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

_conn: sqlite3.Connection | None = None
_lock = threading.Lock()


def get_conn() -> sqlite3.Connection:
    """Return the singleton connection (not thread-safe by itself — use the lock)."""
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
    return _conn


def locked(fn):
    """Decorator: acquire the DB lock before calling the endpoint."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        with _lock:
            return fn(*args, **kwargs)
    return wrapper


def _seed_card_data_if_needed(conn):
    """自动将 cards JSON 中的卡牌导入 card_collection 和 card_vocab_signatures。

    幂等安全：INSERT OR IGNORE 保证已存在的卡不会被重复插入；
    INSERT OR REPLACE 保证签名词始终与最新 JSON 一致。
    """
    try:
        # 延迟导入避免 startup 时的循环依赖
        import json
        from config import get_config
        from services.card_service import build_vocab_signature, load_card_data

        cards = load_card_data()
        if not cards:
            return

        # 取 season 信息
        from config import resolve_path
        data_path = resolve_path(get_config()["cards"]["data_path"])
        with open(data_path) as f:
            raw = json.load(f)
        season = raw.get("season", 1) if isinstance(raw, dict) else 1

        for card in cards:
            cid = card["id"]
            conn.execute(
                "INSERT OR IGNORE INTO card_collection (card_id, season) VALUES (?, ?)",
                [cid, season],
            )
            sig = build_vocab_signature(card)
            source_fields = []
            if card.get("title"):
                source_fields.append("title")
            if card.get("motto"):
                source_fields.append("motto")
            if card.get("lore"):
                source_fields.append("lore")
            conn.execute(
                "INSERT OR REPLACE INTO card_vocab_signatures (card_id, vocab_list, source) VALUES (?, ?, ?)",
                [cid, json.dumps(sig), ",".join(source_fields)],
            )
        conn.commit()
    except Exception as e:
        import logging
        logging.getLogger("english_app.database").warning("Card data seed skipped: %s", e)


def init_db():
    """Create tables if they don't exist. Called once at startup."""
    conn = get_conn()
    conn.executescript("""
        -- 片段收藏
        CREATE TABLE IF NOT EXISTS clips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            text TEXT NOT NULL,
            note TEXT DEFAULT '',
            color TEXT DEFAULT '#facc15',
            created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_clips_audio ON clips(audio_id);

        -- 播放历史
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            played_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_play_audio ON play_history(audio_id);

        -- 音频学习进度
        CREATE TABLE IF NOT EXISTS audio_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id TEXT NOT NULL UNIQUE,
            audio_title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            last_position REAL DEFAULT 0,
            total_seconds REAL DEFAULT 0,
            dictation_avg_score REAL DEFAULT 0,
            dictation_count INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT (unixepoch())
        );

        -- 听写记录
        CREATE TABLE IF NOT EXISTS dictation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            sentence_index INTEGER NOT NULL,
            score REAL NOT NULL,
            user_input TEXT DEFAULT '',
            expected_text TEXT DEFAULT '',
            created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_dict_audio ON dictation_history(audio_id);

        -- 单词学习进度
        CREATE TABLE IF NOT EXISTS word_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            known INTEGER DEFAULT 0,
            reviewed_count INTEGER DEFAULT 0,
            reviewed_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_word_p ON word_progress(word);

        -- 单词出现记录
        CREATE TABLE IF NOT EXISTS word_occurrences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            start_time REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wo_word ON word_occurrences(word);
        CREATE INDEX IF NOT EXISTS idx_wo_audio ON word_occurrences(audio_id);

        -- 实际听过的单词（前端按播放区间筛选后上报）
        CREATE TABLE IF NOT EXISTS listened_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            listened_date TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_lw_date ON listened_words(listened_date);
        CREATE INDEX IF NOT EXISTS idx_lw_word ON listened_words(word);
        CREATE INDEX IF NOT EXISTS idx_lw_audio ON listened_words(audio_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_lw_unique ON listened_words(word, audio_id, listened_date);

        -- 收藏
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            item_type TEXT NOT NULL CHECK(item_type IN ('audio','clip','word')),
            title TEXT NOT NULL DEFAULT '',
            subtitle TEXT DEFAULT '',
            extra_data TEXT DEFAULT '{}',
            created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_item ON favorites(item_id, item_type);
    """)
    # Migration: add color column if not exists (for existing databases)
    try:
        conn.execute("ALTER TABLE clips ADD COLUMN color TEXT DEFAULT '#facc15'")
    except sqlite3.OperationalError:
        pass  # column already exists

    # Migration: add last_score to word_progress (for review system)
    try:
        conn.execute("ALTER TABLE word_progress ADD COLUMN last_score REAL DEFAULT NULL")
    except sqlite3.OperationalError:
        pass  # column already exists

    # ── 合集 (Collections) ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'HiQueueList',
            color TEXT DEFAULT '#3b82f6',
            is_dynamic INTEGER DEFAULT 0,
            dynamic_type TEXT DEFAULT NULL,
            item_count INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS collection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            item_type TEXT NOT NULL CHECK(item_type IN ('audio','clip','sentence','word')),
            item_ref TEXT NOT NULL,
            lesson_id TEXT NOT NULL DEFAULT '',
            lesson_title TEXT DEFAULT '',
            title TEXT DEFAULT '',
            subtitle TEXT DEFAULT '',
            start_time REAL DEFAULT 0,
            end_time REAL DEFAULT 0,
            extra_data TEXT DEFAULT '{}',
            sort_order INTEGER DEFAULT 0,
            added_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_ci_collection ON collection_items(collection_id);
        CREATE INDEX IF NOT EXISTS idx_ci_ref ON collection_items(collection_id, item_ref);
    """)

    # Seed default dynamic collections (insert or ignore by dynamic_type)
    DEFAULTS = [
        ('我的收藏',      'HiHeart',       '#fa2d48', 1, 'favorites'),
        ('今日练习',      'HiClock',       '#f59e0b', 1, 'today_practice'),
        ('最近听写错句',   'HiPencil',     '#8b5cf6', 1, 'recent_dictation_errors'),
        ('最近播放',      'HiClock',       '#3b82f6', 1, 'recent_plays'),
        ('高频错词',      'HiTag',         '#10b981', 1, 'frequent_wrong_words'),
        ('全部音频',      'HiMusicalNote', '#fa2d48', 1, 'all_audio'),
        ('全部片段',      'HiBookmark',    '#f97316', 1, 'all_clips'),
        ('全部单词',      'HiBookOpen',    '#a855f7', 1, 'all_words'),
        ('今日单词',      'HiSun',         '#f59e0b', 1, 'today_words'),
        ('全部听写记录',  'HiPencilSquare','#06b6d4', 1, 'all_dictation'),
    ]
    for i, (name, icon, color, is_dynamic, dynamic_type) in enumerate(DEFAULTS):
        existing = conn.execute(
            "SELECT id FROM collections WHERE dynamic_type=?", [dynamic_type]
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO collections (name, icon, color, is_dynamic, dynamic_type, sort_order) VALUES (?,?,?,?,?,?)",
                [name, icon, color, is_dynamic, dynamic_type, i],
            )

    # ── 词典表 (CET-4, CET-6, TEM-4, TEM-8, IELTS, TOEFL 词库聚合) ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS dictionary (
            word TEXT PRIMARY KEY,
            pronunciation TEXT DEFAULT '',
            part_of_speech TEXT DEFAULT '',
            definition TEXT DEFAULT '',
            tags TEXT DEFAULT '[]'
        );
    """)

    # ── 复习历史 ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            session_id TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'review',
            mode TEXT NOT NULL DEFAULT 'fill-in',
            correct INTEGER NOT NULL DEFAULT 0,
            score REAL NOT NULL DEFAULT 0,
            session_index INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_rh_session ON review_history(session_id);
        CREATE INDEX IF NOT EXISTS idx_rh_word ON review_history(word);
        CREATE INDEX IF NOT EXISTS idx_rh_date ON review_history(created_at);
    """)

    # ── 翻译缓存 ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_hash TEXT NOT NULL UNIQUE,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            source_type TEXT NOT NULL DEFAULT 'sentence',
            extra_data TEXT DEFAULT NULL,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_translations_hash ON translations(source_hash);
    """)

    conn.commit()
    # ── 卡牌系统 ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS card_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL UNIQUE,
            season INTEGER NOT NULL DEFAULT 1,
            obtained INTEGER NOT NULL DEFAULT 0,
            obtained_at INTEGER DEFAULT NULL,
            obtained_by TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS card_vocab_signatures (
            card_id TEXT PRIMARY KEY,
            vocab_list TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS card_draw_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drawn_at INTEGER DEFAULT (unixepoch()),
            card_id TEXT NOT NULL,
            match_score REAL NOT NULL DEFAULT 0,
            reviewed_words_snapshot INTEGER NOT NULL DEFAULT 0
        );
    """)
    conn.commit()

    # ── 代币经济系统 (灵感值) ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS currency (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            balance   INTEGER NOT NULL DEFAULT 0,
            earned    INTEGER NOT NULL DEFAULT 0,
            spent     INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS currency_transactions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            amount        INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            source        TEXT NOT NULL,
            ref_id        TEXT DEFAULT '',
            ref_summary   TEXT DEFAULT '',
            created_at    INTEGER DEFAULT (unixepoch()),
            UNIQUE(source, ref_id)
        );
        CREATE INDEX IF NOT EXISTS idx_ct_source ON currency_transactions(source);
        CREATE INDEX IF NOT EXISTS idx_ct_date  ON currency_transactions(created_at);
    """)
    conn.commit()

    # Seed the single currency row if not exists
    conn.execute("INSERT OR IGNORE INTO currency (id, balance, earned, spent) VALUES (1, 0, 0, 0)")
    conn.commit()

    # ── 词牌对决 (Vocabulary Hold'em) ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS poker_games (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            status          TEXT NOT NULL DEFAULT 'waiting',
            pot             INTEGER NOT NULL DEFAULT 0,
            round           INTEGER NOT NULL DEFAULT 0,
            community_words TEXT NOT NULL DEFAULT '[]',
            revealed_mask   INTEGER NOT NULL DEFAULT 0,
            winner_player_id INTEGER DEFAULT NULL,
            winner_match_count INTEGER DEFAULT 0,
            created_at      INTEGER DEFAULT (unixepoch()),
            completed_at    INTEGER DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS poker_players (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id         INTEGER NOT NULL REFERENCES poker_games(id) ON DELETE CASCADE,
            player_type     TEXT NOT NULL DEFAULT 'human',
            card_id         TEXT NOT NULL,
            card_name       TEXT NOT NULL DEFAULT '',
            card_rarity     TEXT NOT NULL DEFAULT '',
            balance_before  INTEGER NOT NULL DEFAULT 0,
            total_bet       INTEGER NOT NULL DEFAULT 0,
            folded          INTEGER NOT NULL DEFAULT 0,
            is_winner       INTEGER NOT NULL DEFAULT 0,
            match_count     INTEGER DEFAULT NULL,
            created_at      INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_pp_game ON poker_players(game_id);

        CREATE TABLE IF NOT EXISTS poker_actions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id     INTEGER NOT NULL REFERENCES poker_games(id) ON DELETE CASCADE,
            player_id   INTEGER NOT NULL REFERENCES poker_players(id),
            action      TEXT NOT NULL,
            amount      INTEGER NOT NULL DEFAULT 0,
            round       INTEGER NOT NULL,
            created_at  INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_pa_game ON poker_actions(game_id);
    """)
    conn.commit()

    # ── 自动导入卡牌数据 (幂等: 已存在的跳过, 新加的自动补入) ──
    _seed_card_data_if_needed(conn)

