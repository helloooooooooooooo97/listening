"""Import exam word lists into the dictionary table.

Downloads from GitHub, parses each format, merges by word, and writes to DB.

Usage:
    cd backend && python3 -m app.import_word_tags
"""
from __future__ import annotations

import json
import re
import sqlite3
import urllib.request
import urllib.parse
from collections import defaultdict
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "audio.db"

# Root-level data dir for static resources (lessons, wordlists, etc.)
ROOT = Path(__file__).resolve().parent.parent.parent
WORDLISTS_DIR = ROOT / "data" / "wordlists"

# ── Source word lists ──
# Each entry: (url, local_filename, tag_name)
# Parser priority: first source listed wins for pronunciation/POS/definition.

WORD_LISTS: list[tuple[str, str, str]] = [
    # CET-4 full list (best quality for pronunciation + definition)
    (
        "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET4_edited.txt",
        "CET4_edited.txt",
        "CET-4",
    ),
    # CET-6 supplementary (beyond CET-4, also detailed)
    (
        "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_edited.txt",
        "CET6_edited.txt",
        "CET-6",
    ),
    # TEM-8 (英语专业星标八级)
    (
        "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E6%98%9F%E6%A0%87%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87.txt",
        "TEM8_星标八级词汇.txt",
        "TEM-8",
    ),
    # TEM-4/8 combined (for extracting TEM-4 after subtracting TEM-8)
    (
        "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt",
        "TEM4_8_四八级词汇表.txt",
        "_TEM_ALL",
    ),
    # TOEFL
    (
        "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/TOEFL.txt",
        "TOEFL.txt",
        "TOEFL",
    ),
    # IELTS
    (
        "https://raw.githubusercontent.com/fanhongtao/IELTS/master/IELTS%20Word%20List.txt",
        "IELTS_Word_List.txt",
        "IELTS",
    ),
]

# ── Parsing utilities ──

# Line that starts with a letter or accent character (possible word entry)
_WORD_LINE_RE = re.compile(r"^[\*•●]?([A-Za-zÀ-ÿ]+(?:[ -][A-Za-zÀ-ÿ]+)*)")
# Phonetic in [] or //
_PHONETIC_RE = re.compile(r"[\[/]([^\]/]+)[\]/]")
# Part of speech abbreviation at start of definition
_POS_RE = re.compile(r"^([a-z]+\.[ ,;])")

_HEADER_RE = re.compile(
    r"^(#|//|[一-鿿]|$|\d+\s*$|共.*词|第.*章|Word\s+List|README)"
)

# Words to skip (common noise entries)
_SKIP_WORDS: set[str] = {"a", "an", "the"}


def get_text(url: str, local_path: Path) -> str:
    """Read from local cache or download, caching to disk.

    Downloads from URL, saves to local_path, then returns the text.
    On subsequent runs, reads local_path directly.
    """
    if local_path.exists():
        raw = local_path.read_bytes()
        print(f"✓ (cached)", end=" ", flush=True)
    else:
        print(f"\n    ↓ downloading...", end=" ", flush=True)
        # Ensure URL path is properly encoded
        parsed = urllib.parse.urlparse(url)
        path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe='/:@!$&\'()*+,;=-._~')
        safe_url = urllib.parse.urlunparse(parsed._replace(path=path))
        with urllib.request.urlopen(safe_url, timeout=30) as resp:
            raw = resp.read()
        WORDLISTS_DIR.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(raw)
        print(f"saved to {local_path.name}", end=" ", flush=True)

    # Try all encodings
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030", "latin-1"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="ignore")


def extract_word(line: str) -> str | None:
    """Extract the word from a line. Returns lowercased word or None."""
    line = line.strip()
    if not line or _HEADER_RE.match(line):
        return None
    m = _WORD_LINE_RE.match(line)
    if m:
        word = m.group(1).strip().lower().rstrip("*")
        if word in _SKIP_WORDS:
            return None
        return word
    return None


def extract_phonetic(line: str) -> str:
    """Extract phonetic transcription from [] or //."""
    m = _PHONETIC_RE.search(line)
    if m:
        return m.group(1).strip()
    return ""


def extract_definition(line: str, word: str) -> tuple[str, str]:
    """Extract (part_of_speech, definition) from a word-list line.

    Handles patterns like:
      vt.丢弃；放弃，抛弃
      n. (usu pl) 住宿等条件，设施
      adj. 光明磊落的，光明正大的
      vt.  放弃,沉溺n.  放任
      n. 皇帝；君主
    """
    rest = line
    # Remove the word itself (case-insensitive)
    word_escaped = re.escape(word)
    rest = re.sub(rf"^{word_escaped}\**", "", rest, flags=re.IGNORECASE).strip()
    # Remove phonetic ([] or //)
    rest = _PHONETIC_RE.sub("", rest).strip()
    if not rest:
        return ("", "")

    # Extract POS: find first occurrence of pattern like n. vt. adj. adv.
    pos = ""
    m = re.search(r"(?<!\w)([a-z]+\.[,; ])", rest)
    if m:
        pos = m.group(1).rstrip(" ,;") + "."
        # Remove POS from the rest
        rest = rest[m.end():].strip()

    # Clean up: remove leading punctuation/whitespace
    rest = re.sub(r"^[\s,;：]+", "", rest)
    # Remove numbered items like "1." "2."
    rest = re.sub(r"^\d+\.\s*", "", rest)
    # For TOEFL format: split on POS markers (e.g. "vt.放弃;n. 放任")
    rest = re.sub(r"\s+(?=[a-z]+\.)", "；", rest)

    return (pos, rest.strip())


def parse_word_list(text: str) -> dict[str, dict]:
    """Parse a word list text file into {word: {pronunciation, pos, definition}}.

    Returns empty dict if the file format doesn't match (e.g. CET_4+6 plain-word
    format which has no phonetic/POS/definition info).
    """
    result: dict[str, dict] = {}
    has_phonetic = 0
    total_valid = 0

    for line in text.splitlines():
        word = extract_word(line)
        if not word:
            continue
        total_valid += 1
        phonetic = extract_phonetic(line)
        if phonetic:
            has_phonetic += 1
        pos, definition = extract_definition(line, word)
        result[word] = {
            "pronunciation": phonetic,
            "part_of_speech": pos,
            "definition": definition,
        }

    # If very few lines had phonetics (<10%), this is a plain-word list
    # (like CET_4+6_edited.txt which is just word per line).
    # Return empty to indicate "tags only, no lexical data."
    if total_valid > 50 and has_phonetic / total_valid < 0.1:
        return {}
    return result


# ── Download & import ──


def main():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    # Ensure table exists
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS dictionary (
            word TEXT PRIMARY KEY,
            pronunciation TEXT DEFAULT '',
            part_of_speech TEXT DEFAULT '',
            definition TEXT DEFAULT '',
            tags TEXT DEFAULT '[]'
        );
    """)
    conn.execute("DELETE FROM dictionary")
    conn.commit()
    print("Cleared dictionary table.\n")

    # Stage 1: download & parse all lists
    # per_word: {word: {tags: set, pronunciation, part_of_speech, definition}}
    per_word: dict[str, dict] = defaultdict(
        lambda: {"tags": set(), "pronunciation": "", "part_of_speech": "", "definition": ""}
    )

    tem8_words: set[str] = set()  # known TEM-8 words for TEM-4 extraction

    for url, local_name, tag_name in WORD_LISTS:
        local_path = WORDLISTS_DIR / local_name
        print(f"  [{tag_name}] {local_name}", end=" ", flush=True)
        try:
            text = get_text(url, local_path)
        except Exception as e:
            print(f"\n    FAILED: {e}")
            continue

        # First, check the plain-word format (CET_4+6 = just words)
        is_plain_word = False
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        # Count lines that are single words vs have phonetic content
        word_only = sum(1 for l in lines if extract_word(l) is not None and not extract_phonetic(l))
        with_phonetic = sum(1 for l in lines if extract_word(l) is not None and extract_phonetic(l))
        if word_only > 100 and with_phonetic / max(word_only + with_phonetic, 1) < 0.05:
            is_plain_word = True

        if is_plain_word:
            # Plain word-per-line format — just collect tags
            count = 0
            for line in lines:
                word = extract_word(line)
                if word:
                    per_word[word]["tags"].add(tag_name)
                    count += 1
            print(f"{count} words tagged (plain-word format, no lexical data).")
        else:
            # Full format with phonetics
            entries = parse_word_list(text)
            if not entries:
                # Fallback: try plain-word extraction
                count = 0
                for line in lines:
                    word = extract_word(line)
                    if word:
                        per_word[word]["tags"].add(tag_name)
                        count += 1
                print(f"{count} words tagged (fallback, no lexical data).")
            else:
                count = 0
                lexical = 0
                for word, data in entries.items():
                    entry = per_word[word]
                    entry["tags"].add(tag_name)
                    # Only set lexical data if not already set (first source wins)
                    if data["pronunciation"] and not entry["pronunciation"]:
                        entry["pronunciation"] = data["pronunciation"]
                        lexical += 1
                    if data["part_of_speech"] and not entry["part_of_speech"]:
                        entry["part_of_speech"] = data["part_of_speech"]
                    if data["definition"] and not entry["definition"]:
                        entry["definition"] = data["definition"]
                    count += 1
                print(f"{count} words parsed ({lexical} with pronunciation).")

        if tag_name == "TEM-8":
            tem8_words = {w for w, d in per_word.items() if "TEM-8" in d["tags"]}

    # Stage 2: handle TEM-4 (from TEM-ALL minus TEM-8)
    tem_all = {w for w, d in per_word.items() if "_TEM_ALL" in d["tags"]}
    tem4 = tem_all - tem8_words
    for word in tem4:
        per_word[word]["tags"].add("TEM-4")
    # Clean up internal tag
    for d in per_word.values():
        d["tags"].discard("_TEM_ALL")
    print(f"\n  TEM-4: {len(tem4)} words (from TEM-ALL minus TEM-8).")

    # Stage 3: write to database
    count = 0
    for word, data in per_word.items():
        if not data["tags"]:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO dictionary (word, pronunciation, part_of_speech, definition, tags) VALUES (?,?,?,?,?)",
            [
                word,
                data["pronunciation"],
                data["part_of_speech"],
                data["definition"],
                json.dumps(sorted(data["tags"]), ensure_ascii=False),
            ],
        )
        count += 1
    conn.commit()

    # Stats
    tag_counts: dict[str, int] = {}
    rows = conn.execute("SELECT tags FROM dictionary").fetchall()
    for r in rows:
        for t in json.loads(r["tags"]):
            tag_counts[t] = tag_counts.get(t, 0) + 1

    print(f"\n✅ Done! {count} unique words in dictionary table.")
    print("By tag:")
    for tag in sorted(tag_counts):
        print(f"  {tag}: {tag_counts[tag]}")
    print()

    lexical = conn.execute(
        "SELECT COUNT(*) FROM dictionary WHERE pronunciation != ''"
    ).fetchone()[0]
    print(f"  {lexical} words have pronunciation data.")

    conn.close()


if __name__ == "__main__":
    main()
