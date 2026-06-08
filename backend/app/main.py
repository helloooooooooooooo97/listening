from __future__ import annotations

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from database import init_db

init_db()

app = FastAPI(title="英语听力 API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


from routers import router as lessons_router
from routers.words import router as words_router
from routers.clips_api import router as clips_router
from routers.progress_api import router as progress_router
from routers.stats_api import router as stats_router
from routers.favorites_api import router as favorites_router
from routers.import_api import router as import_router
from routers.collections_api import router as collections_router

app.include_router(lessons_router)
app.include_router(words_router)
app.include_router(clips_router)
app.include_router(progress_router)
app.include_router(stats_router)
app.include_router(favorites_router)
app.include_router(import_router)
app.include_router(collections_router)


# ── 翻译/单词解析 缓存 API ──

def _hash_text(text: str) -> str:
    h = 0
    for ch in text:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF
    return f"{h}"

@app.get("/api/translations/{source_type}/{source_text}")
def get_translation(source_type: str, source_text: str):
    h = _hash_text(source_text)
    row = get_db().execute(
        "SELECT id, source_text, translated_text, source_type, extra_data FROM translations WHERE source_hash=? AND source_type=?",
        [h, source_type]
    ).fetchone()
    if not row:
        return None
    return {
        "id": row[0], "source_text": row[1], "translated_text": row[2],
        "source_type": row[3], "extra_data": row[4],
    }

@app.post("/api/translations")
def save_translation(data: dict):
    h = _hash_text(data["source_text"])
    db = get_db()
    existing = db.execute(
        "SELECT id FROM translations WHERE source_hash=? AND source_type=?",
        [h, data["source_type"]]
    ).fetchone()
    if existing:
        db.execute(
            "UPDATE translations SET translated_text=?, extra_data=?, updated_at=datetime('now') WHERE id=?",
            [data["translated_text"], data.get("extra_data"), existing[0]]
        )
        row_id = existing[0]
    else:
        cur = db.execute(
            "INSERT INTO translations (source_hash, source_text, translated_text, source_type, extra_data) VALUES (?,?,?,?,?)",
            [h, data["source_text"], data["translated_text"], data["source_type"], data.get("extra_data")]
        )
        row_id = cur.lastrowid
    db.commit()
    row = db.execute("SELECT id, source_text, translated_text, source_type, extra_data FROM translations WHERE id=?", [row_id]).fetchone()
    return {
        "id": row[0], "source_text": row[1], "translated_text": row[2],
        "source_type": row[3], "extra_data": row[4],
    }


# Serve frontend static files for desktop production mode
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '../../frontend/dist')
if os.path.isdir(FRONTEND_DIR) and os.path.exists(os.path.join(FRONTEND_DIR, 'index.html')):
    app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')

@app.get("/api/health")
def health():
    return {"status": "ok"}
