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
    conn.commit()
