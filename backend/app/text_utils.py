"""Shared text utilities — word cleaning, etc."""

import re

# Strip leading/trailing punctuation (keep internal apostrophes etc.)
_PUNCT_RE = re.compile(r"^[.,!?;:\-\"'`]+|[.,!?;:\-\"'`]+$")


def clean_word(word: str) -> str:
    """Lowercase and strip leading/trailing punctuation from a word."""
    return _PUNCT_RE.sub('', word.strip().lower())
