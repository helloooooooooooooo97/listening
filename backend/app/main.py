"""97 LISTENING — FastAPI application entry point."""
from __future__ import annotations

import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from config import load_config, get_config

# Load config first (so db path comes from config)
cfg = load_config()
init_db()

app = FastAPI(title="英语听力 API", version="0.3.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg["app"]["cors"]["allow_origins"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


# ── Register all routers (centralized) ──
from routers import routers as router_list
for r in router_list:
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Mount card images ──
from config import get_config
_cfg = get_config()
_img_rel = _cfg["cards"]["image_path"]
from config import resolve_path
_img_path = resolve_path(_img_rel)
if _img_path.is_dir():
    app.mount(_cfg["cards"]["image_url_prefix"], StaticFiles(directory=str(_img_path)), name="card_images")
    print(f"  📁 Card images mounted: {_img_path}")
else:
    print(f"  ⚠️  Card image dir not found: {_img_path}")

# Serve frontend static files (must be last — mount at `/` catches everything)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '../..', cfg["app"]["frontend"]["dist_dir"])
if os.path.isdir(FRONTEND_DIR) and os.path.exists(os.path.join(FRONTEND_DIR, 'index.html')):
    app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')


# ── Direct server entry (used by PyInstaller bundles) ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, log_level="info")
