#!/bin/bash
# 97 LISTENING — Backend launcher (used by Tauri desktop app)
# Uses system Python with bundled dependencies
# Automatically finds python3 on various macOS versions

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Determine which python3 to use
PYTHON=""
# Prefer Homebrew Python (3.11+) over system Python 3.9 (Xcode — incompatible _sqlite3 on macOS 26)
for candidate in /opt/homebrew/bin/python3 /opt/homebrew/opt/python@3.11/bin/python3 /opt/homebrew/opt/python@3.12/bin/python3 /opt/homebrew/opt/python@3.13/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
    if [ -x "$candidate" ]; then
        # Skip Xcode Python 3.9 — its _sqlite3 C extension crashes on macOS 26
        ver=$("$candidate" --version 2>&1 | awk '{print $2}')
        if [ -n "$ver" ]; then
            minor="${ver#*.}"
            minor="${minor%.*}"
            if [ "$minor" -ge 10 ]; then
                PYTHON="$candidate"
                break
            fi
        fi
    fi
done

# Fallback to PATH
if [ -z "$PYTHON" ]; then
    PYTHON="$(command -v python3 2>/dev/null)"
fi

if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3 not found. Please install from https://www.python.org/downloads/" >&2
    osascript -e 'display dialog "Python 3 未找到。\n请从 python.org 安装 Python 3" buttons {"OK"} with title "97 LISTENING" with icon stop' 2>/dev/null || true
    exit 1
fi

echo "Starting backend with: $PYTHON" >&2

# Use bundled site-packages
export PYTHONPATH="$DIR/app:$DIR/site-packages${PYTHONPATH:+:$PYTHONPATH}"

exec "$PYTHON" -m uvicorn main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --log-level info \
    --loop asyncio
