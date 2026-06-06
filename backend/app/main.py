from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

app.include_router(lessons_router)
app.include_router(words_router)
app.include_router(clips_router)
app.include_router(progress_router)
app.include_router(stats_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
