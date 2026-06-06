#!/usr/bin/env python3
"""Generate iOS lesson JSON with WhisperX word timestamps.

Example:
    python tools/align_with_whisperx.py \
      --audio english/lessons/fox-grapes.mp3 \
      --output english/lessons/fox-grapes.json \
      --id fox-grapes \
      --title "The Fox and The Grapes" \
      --subtitle "Aesop's Fables, Volume 01"
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def run_whisperx(audio: Path, model: str, language: str, device: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="whisperx-") as tmp:
        output_dir = Path(tmp)
        command = [
            "whisperx",
            str(audio),
            "--model",
            model,
            "--language",
            language,
            "--device",
            device,
            "--output_format",
            "json",
            "--output_dir",
            str(output_dir),
            "--compute_type",
            "int8" if device == "cpu" else "float16",
        ]
        subprocess.run(command, check=True)

        output_json = output_dir / f"{audio.stem}.json"
        if not output_json.exists():
            raise FileNotFoundError(f"WhisperX did not create {output_json}")

        return json.loads(output_json.read_text(encoding="utf-8"))


def words_from_whisperx(result: dict) -> list[dict]:
    words: list[dict] = []
    index = 0

    for segment in result.get("segments", []):
        for word in segment.get("words", []):
            text = word.get("word", "").strip()
            start = word.get("start")
            end = word.get("end")
            if not text or start is None or end is None:
                continue

            words.append(
                {
                    "id": f"w-{index:04d}",
                    "text": text,
                    "start": round(float(start), 3),
                    "end": round(float(end), 3),
                }
            )
            index += 1

    return words


def transcript_from_whisperx(result: dict) -> list[dict]:
    lines: list[dict] = []
    for index, segment in enumerate(result.get("segments", [])):
        text = segment.get("text", "").strip()
        start = segment.get("start")
        end = segment.get("end")
        if not text or start is None or end is None:
            continue

        lines.append(
            {
                "id": f"line-{index:03d}",
                "start": round(float(start), 3),
                "end": round(float(end), 3),
                "text": text,
                "note": "",
            }
        )

    return lines


def build_lesson(args: argparse.Namespace, whisperx_result: dict) -> dict:
    words = words_from_whisperx(whisperx_result)
    transcript = transcript_from_whisperx(whisperx_result)
    duration = max((word["end"] for word in words), default=0)

    return {
        "id": args.id,
        "title": args.title,
        "subtitle": args.subtitle,
        "level": args.level,
        "duration": round(duration, 3),
        "audioFileName": args.audio.name,
        "sourceURL": args.source_url,
        "textSourceURL": args.text_source_url,
        "transcript": transcript,
        "words": words,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--subtitle", default="")
    parser.add_argument("--level", default="A2-B1")
    parser.add_argument("--source-url", default="https://librivox.org/aesops-fables-volume-1-fables-1-25/")
    parser.add_argument("--text-source-url", default="https://www.gutenberg.org/ebooks/11339")
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="cpu")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.audio = args.audio.resolve()
    args.output = args.output.resolve()

    whisperx_result = run_whisperx(args.audio, args.model, args.language, args.device)
    lesson = build_lesson(args, whisperx_result)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(lesson, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")
    print(f"Words: {len(lesson['words'])}")


if __name__ == "__main__":
    main()
