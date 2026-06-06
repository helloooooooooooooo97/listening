"""SQLite database using Python's built-in sqlite3 module."""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "audio.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
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
    """)
    conn.commit()
    conn.close()
