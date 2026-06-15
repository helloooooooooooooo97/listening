"""Configuration loader — reads config.yaml from backend/app/."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

_CONFIG: dict[str, Any] | None = None
_CONFIG_DIR: Path | None = None


def _find_config() -> Path:
    env = os.environ.get("CARDS_CONFIG_PATH")
    if env:
        p = Path(env)
        if p.exists():
            return p
    # Same directory as this file
    candidate = Path(__file__).resolve().parent / "config.yaml"
    if candidate.exists():
        return candidate
    raise FileNotFoundError("config.yaml not found at backend/app/config.yaml")


def load_config() -> dict[str, Any]:
    global _CONFIG, _CONFIG_DIR
    path = _find_config()
    _CONFIG_DIR = path.resolve().parent
    with open(path) as f:
        _CONFIG = yaml.safe_load(f)
    return _CONFIG


def get_config() -> dict[str, Any]:
    if _CONFIG is None:
        return load_config()
    return _CONFIG


def resolve_path(relative: str) -> Path:
    if _CONFIG_DIR is None:
        load_config()
    return (_CONFIG_DIR / relative).resolve()
