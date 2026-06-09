#!/bin/bash
# build-mac.sh — Build macOS .app + .dmg for 97 LISTENING
# Usage: bash scripts/build-mac.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="97 LISTENING"
DMG_OUTPUT="$PROJECT_DIR/$APP_NAME.dmg"

cd "$PROJECT_DIR/frontend"

echo "========================================"
echo "🏗️  Building Tauri app..."
echo "========================================"
# Build only the .app (skip Tauri's broken bundle_dmg.sh for DMG)
npx tauri build --bundles app 2>&1

# Locate the built .app
APP_BUNDLE="$PROJECT_DIR/frontend/src-tauri/target/release/bundle/macos/$APP_NAME.app"
if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ .app not found at $APP_BUNDLE" >&2
    exit 1
fi

echo ""
echo "========================================"
echo "🔏 Ad-hoc signing .app (prevent Gatekeeper 'damaged' error)..."
echo "========================================"
codesign --force --deep --sign - "$APP_BUNDLE" 2>&1 || echo "⚠️  Signing skipped (not fatal)"

echo ""
echo "========================================"
echo "📀 Creating DMG..."
echo "========================================"

# Build DMG manually (macOS built-in hdiutil, no dependencies needed)
DMG_TEMP=$(mktemp -d)
cp -R "$APP_BUNDLE" "$DMG_TEMP/$APP_NAME.app"
ln -s /Applications "$DMG_TEMP/Applications"

# Remove quarantine attribute from the DMG source (avoids "damaged" on first open)
xattr -cr "$DMG_TEMP/$APP_NAME.app" 2>/dev/null || true

hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$DMG_TEMP" \
    -ov \
    -format UDZO \
    -imagekey zlib-level=9 \
    "$DMG_OUTPUT" 2>&1

rm -rf "$DMG_TEMP"

echo ""
echo "========================================"
SIZE=$(du -sh "$DMG_OUTPUT" | cut -f1)
echo "✅  Done: $DMG_OUTPUT ($SIZE)"
echo ""
echo "💡 发给别人后如果还提示'已损坏'，让对方终端运行:"
echo "    xattr -cr /Applications/$APP_NAME.app"
echo "========================================"
