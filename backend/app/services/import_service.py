"""Import service — handle audio file import with WhisperX transcription."""
from __future__ import annotations

import json
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Optional

from services import LESSONS_DIR

WHISPERX_BIN = Path(__file__).resolve().parent.parent.parent.parent / ".venv-whisperx" / "bin" / "whisperx"

# ── In-memory task store ──
_tasks: dict[str, dict] = {}


def _run_import(task_id: str, audio_path: Path, title: str, subtitle: str, level: str, source_url: str):
    """Background task: run WhisperX and generate lesson JSON."""
    try:
        _tasks[task_id]["status"] = "transcribing"
        _tasks[task_id]["progress"] = 10.0

        lesson_id = audio_path.stem
        json_path = LESSONS_DIR / f"{lesson_id}.json"

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

        generated = list(tmp_dir.glob("*.json"))
        if not generated:
            raise RuntimeError("WhisperX produced no output JSON")
        with open(generated[0]) as f:
            whisper_data = json.load(f)

        _tasks[task_id]["progress"] = 80.0

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

        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)

        _tasks[task_id]["status"] = "completed"
        _tasks[task_id]["progress"] = 100.0
        _tasks[task_id]["lesson_id"] = lesson_id

    except Exception as e:
        _tasks[task_id]["status"] = "failed"
        _tasks[task_id]["error"] = str(e)
        _tasks[task_id]["progress"] = 0


def start_import(audio_path: Path, title: str, subtitle: str, level: str, source_url: str) -> str:
    """Start async import process. Returns task_id."""
    task_id = str(uuid.uuid4())[:8]
    _tasks[task_id] = {"status": "pending", "progress": 0, "error": None, "lesson_id": None}
    thread = threading.Thread(
        target=_run_import,
        args=(task_id, audio_path, title, subtitle, level, source_url),
        daemon=True,
    )
    thread.start()
    return task_id


def get_task(task_id: str) -> Optional[dict]:
    return _tasks.get(task_id)
