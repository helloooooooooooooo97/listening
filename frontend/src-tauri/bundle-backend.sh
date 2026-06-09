#!/bin/bash
# bundle-backend.sh — Prepare Python backend for Tauri .app bundle
# Lives at frontend/src-tauri/bundle-backend.sh
# Called from beforeBuildCommand (Tauri runs it from frontend/)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../backend" && pwd)"
DIST_DIR="$SCRIPT_DIR/backend-bundle"

# If up to date, skip
if [ -d "$DIST_DIR" ] && [ "$DIST_DIR/run.sh" -nt "$BACKEND_DIR/run.sh" ] 2>/dev/null; then
    echo "Backend bundle is up to date, skipping"
    exit 0
fi

echo "📦 Bundling backend into $DIST_DIR ..."

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "   - app/ (code + audio)"
cp -R "$BACKEND_DIR/app" "$DIST_DIR/app"

echo "   - data/ (SQLite DB)"
cp -R "$BACKEND_DIR/data" "$DIST_DIR/data"

cp "$BACKEND_DIR/run.sh" "$DIST_DIR/run.sh"
chmod +x "$DIST_DIR/run.sh"

echo "   - site-packages/"
PY_VER=$(ls "$BACKEND_DIR/.venv/lib/" | grep -E '^python3\.[0-9]+$' | head -1)
VENV_SP="$BACKEND_DIR/.venv/lib/$PY_VER/site-packages"
mkdir -p "$DIST_DIR/site-packages"

for srcdir in "$VENV_SP"/*/; do
    name="$(basename "$srcdir")"
    case "$name" in
        PyInstaller*|_pyinstaller*|pyinstaller*|altgraph*|macholib*) ;;
        *) cp -R "${srcdir%/}" "$DIST_DIR/site-packages/" ;;
    esac
done

for f in "$VENV_SP"/*; do
    [ -f "$f" ] && cp "$f" "$DIST_DIR/site-packages/"
done

# Remove packages that shadow stdlib
rm -rf "$DIST_DIR/site-packages/abc" "$DIST_DIR/site-packages/asyncio"
rm -rf "$DIST_DIR/site-packages/tests" "$DIST_DIR/site-packages/testing"

sed -i '' "s|\.venv/lib/$PY_VER/site-packages|site-packages|g" "$DIST_DIR/run.sh"

echo "✅ Backend bundled ($(du -sh "$DIST_DIR" | cut -f1))"
