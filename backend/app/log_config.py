"""Centralized logging — writes to file under data/logs/ and stdout.

Usage:
    from log_config import logger
    logger.info("Processing request")
    logger.error("Something broke", exc_info=True)

The log directory is <project_root>/data/logs/.  Log files rotate daily,
retained for 30 days.  The log level is read from config.yaml → app.logging.level
(default: "INFO").
"""
from __future__ import annotations

import logging
import logging.handlers
import sys
from pathlib import Path
from datetime import datetime


_LOG_DIR: Path | None = None
_LEVEL: str = "INFO"
_LOGGER: logging.Logger | None = None


def configure_logging(log_dir: str | Path | None = None,
                      level: str = "INFO",
                      logger_name: str = "english_app") -> logging.Logger:
    """Configure root logger with file + console handlers.

    Also attaches the file handler to uvicorn.access and uvicorn.error
    so HTTP request logs and server logs go to the same file.

    Args:
        log_dir:  Directory for log files.  If None, defaults to
                  <project_root>/data/logs/.
        level:    Log level string (DEBUG, INFO, WARNING, ERROR).
        logger_name: Logger name to configure.

    Returns:
        The configured logger instance.
    """
    global _LOG_DIR, _LEVEL, _LOGGER

    _LEVEL = level.upper()

    # Resolve log directory
    if log_dir is None:
        # Default: backend/app/../../data/logs/  →  project root / data / logs
        _LOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "logs"
    else:
        _LOG_DIR = Path(log_dir)
    _LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(logger_name)
    logger.setLevel(getattr(logging, _LEVEL, logging.INFO))

    # Remove existing handlers so re-config is idempotent
    logger.handlers.clear()

    log_level = getattr(logging, _LEVEL, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ── File handler (rotating, 10 MB per file, keep 30) ──
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = _LOG_DIR / f"app-{today}.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=30, encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # ── Console handler (stdout) ──
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # ── Also wire uvicorn loggers to the same file + console ──
    for uvi_name in ("uvicorn.access", "uvicorn.error"):
        uvi_logger = logging.getLogger(uvi_name)
        uvi_logger.setLevel(log_level)
        # Remove default handlers and add ours
        uvi_logger.handlers.clear()
        uvi_logger.addHandler(file_handler)
        uvi_logger.addHandler(console_handler)
        uvi_logger.propagate = False  # don't double-log

    _LOGGER = logger
    logger.info("Logging initialized → %s (level=%s)", _LOG_DIR, _LEVEL)
    return logger


def get_logger(name: str | None = None) -> logging.Logger:
    """Return the app logger, or a child logger if *name* is given.

    Call configure_logging() once at startup before using get_logger().
    """
    if name:
        base = _LOGGER or logging.getLogger("english_app")
        return base.getChild(name)
    return _LOGGER or logging.getLogger("english_app")
