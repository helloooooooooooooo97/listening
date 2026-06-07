"""Lesson import API — upload audio, run WhisperX, generate lesson JSON."""
from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from services import LESSONS_DIR

router = APIRouter(prefix="/api/lessons", tags=["import"])

# ── In-memory task store ──
_tasks: dict[str, dict] = {}
WHISPERX_BIN = Path(__file__).resolve().parent.parent.parent.parent / ".venv-whisperx" / "bin" / "whisperx"


class ImportStatus(BaseModel):
    task_id: str
    status: str  # pending | transcribing | aligning | completed | failed
    progress: float  # 0-100
    error: Optional[str] = None
    lesson_id: Optional[str] = None


def _run_import(task_id: str, audio_path: Path, title: str, subtitle: str, level: str, source_url: str):
    """Background task: run WhisperX and generate lesson JSON."""
    try:
        _tasks[task_id]["status"] = "transcribing"
        _tasks[task_id]["progress"] = 10.0

        lesson_id = audio_path.stem
        json_path = LESSONS_DIR / f"{lesson_id}.json"

        # ── Run WhisperX ──
        import subprocess
        tmp_dir = Path(f"/tmp/whisperx-{task_id}")
        tmp_dir.mkdir(parents=True, exist_ok=True)

        _tasks[task_id]["progress"] = 20.0
        result = subprocess.run(
            [
                str(WHISPERX_BIN),
                str(audio_path),
                "--model", "base",
                "--language", "en",
                "--output_dir", str(tmp_dir),
                "--align_output",
                "--compute_type", "float32",
            ],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            raise RuntimeError(f"WhisperX failed: {result.stderr[:500]}")

        _tasks[task_id]["status"] = "aligning"
        _tasks[task_id]["progress"] = 60.0

        # ── Find generated JSON ──
        generated = list(tmp_dir.glob("*.json"))
        if not generated:
            raise RuntimeError("WhisperX produced no output JSON")
        with open(generated[0]) as f:
            whisper_data = json.load(f)

        _tasks[task_id]["progress"] = 80.0

        # ── Convert to our format ──
        segments = whisper_data.get("segments", [])
        transcript = []
        words_out = []
        word_id = 0

        for seg in segments:
            seg_words = seg.get("words", [])
            line_text = " ".join(w.get("word", "").strip() for w in seg_words)
            if not line_text:
                continue
            line_id = f"s{len(transcript)}"
            transcript.append({
                "id": line_id,
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": line_text,
                "note": "",
            })
            for w in seg_words:
                w_text = w.get("word", "").strip()
                if not w_text:
                    continue
                words_out.append({
                    "id": f"w{word_id}",
                    "text": w_text,
                    "start": w.get("start", 0),
                    "end": w.get("end", 0),
                })
                word_id += 1

        duration = segments[-1]["end"] if segments else 0
        lesson_data = {
            "id": lesson_id,
            "title": title,
            "subtitle": subtitle,
            "level": level,
            "duration": round(duration, 2),
            "audioFileName": audio_path.name,
            "sourceURL": source_url,
            "textSourceURL": "",
            "transcript": transcript,
            "words": words_out,
        }

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(lesson_data, f, ensure_ascii=False, indent=2)

        # Cleanup temp
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)

        _tasks[task_id]["status"] = "completed"
        _tasks[task_id]["progress"] = 100.0
        _tasks[task_id]["lesson_id"] = lesson_id

    except Exception as e:
        _tasks[task_id]["status"] = "failed"
        _tasks[task_id]["error"] = str(e)
        _tasks[task_id]["progress"] = 0


@router.post("/import", status_code=201)
async def import_lesson(
    file: UploadFile = File(...),
    title: str = Form(...),
    subtitle: str = Form(""),
    level: str = Form("A2"),
    source_url: str = Form(""),
):
    """Upload audio file and start import process."""
    if not file.filename or not file.filename.endswith((".mp3", ".wav", ".m4a", ".ogg")):
        raise HTTPException(400, "Unsupported audio format")

    task_id = str(uuid.uuid4())[:8]
    audio_id = title.lower().replace(" ", "-").replace("'", "").replace("--", "-")
    audio_filename = f"{audio_id}.mp3"

    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    audio_path = LESSONS_DIR / audio_filename

    content = await file.read()
    audio_path.write_bytes(content)

    _tasks[task_id] = {"status": "pending", "progress": 0, "error": None, "lesson_id": None}

    thread = threading.Thread(
        target=_run_import,
        args=(task_id, audio_path, title, subtitle, level, source_url),
        daemon=True,
    )
    thread.start()

    return {"task_id": task_id, "status": "pending"}


@router.get("/import/{task_id}")
def get_import_status(task_id: str) -> ImportStatus:
    """Poll import progress."""
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return ImportStatus(**task)
