"""SQLite database — single connection with thread-safe locking."""
from __future__ import annotations

import functools
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "audio.db"
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
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_clips_audio ON clips(audio_id);

        -- 播放历史
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id TEXT NOT NULL,
            audio_title TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            played_at TEXT DEFAULT (datetime('now'))
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
            updated_at TEXT DEFAULT (datetime('now'))
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
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_dict_audio ON dictation_history(audio_id);

        -- 单词学习进度
        CREATE TABLE IF NOT EXISTS word_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            known INTEGER DEFAULT 0,
            reviewed_count INTEGER DEFAULT 0,
            reviewed_at TEXT DEFAULT (datetime('now'))
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

        -- 收藏
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            item_type TEXT NOT NULL CHECK(item_type IN ('audio','clip','word')),
            title TEXT NOT NULL DEFAULT '',
            subtitle TEXT DEFAULT '',
            extra_data TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_item ON favorites(item_id, item_type);
    """)
    # Migration: add color column if not exists (for existing databases)
    try:
        conn.execute("ALTER TABLE clips ADD COLUMN color TEXT DEFAULT '#facc15'")
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
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
            added_at TEXT DEFAULT (datetime('now'))
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

    # ── 翻译缓存 ──
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_hash TEXT NOT NULL UNIQUE,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            source_type TEXT NOT NULL DEFAULT 'sentence',
            extra_data TEXT DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_translations_hash ON translations(source_hash);
    """)

    conn.commit()
