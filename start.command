#!/bin/bash
# 97 LISTENING - Desktop Launcher
# This script starts the backend server and opens the browser

DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$DIR/backend"
FRONTEND_DIR="$DIR/frontend"

# Check if Python is available
if ! command -v python3 &>/dev/null; then
    osascript -e 'display dialog "需要安装 Python 3 才能运行\nhttps://www.python.org/downloads/" buttons {"确定"} default button 1 with title "97 LISTENING" with icon stop'
    exit 1
fi

# Check if frontend is built
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
    cd "$FRONTEND_DIR"
    npm run build &>/dev/null || {
        osascript -e 'display dialog "前端构建失败，请确保已执行 npm install" buttons {"确定"} default button 1 with title "97 LISTENING" with icon stop'
        exit 1
    }
fi

# Start Python backend
cd "$BACKEND_DIR"
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open browser
open http://127.0.0.1:8000

# Wait for user to close
wait $BACKEND_PID
