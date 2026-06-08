"""97 LISTENING - Desktop App Launcher
Starts the FastAPI backend and opens a native WebView window.
"""

import os
import sys
import threading
import uvicorn
import webview

# Ensure we can find the backend app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PORT = 8000


def start_backend():
    """Run the FastAPI backend in a background thread."""
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="error")


def main():
    # Start backend in background thread
    t = threading.Thread(target=start_backend, daemon=True)
    t.start()

    # Wait for backend to be ready
    import urllib.request
    import time
    for _ in range(30):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health")
            break
        except Exception:
            time.sleep(0.5)

    # Create native window using system WebView
    webview.create_window(
        title="97 LISTENING",
        url=f"http://127.0.0.1:{PORT}",
        width=1200,
        height=800,
        min_size=(900, 600),
        resizable=True,
        fullscreen=False,
    )
    webview.start()


if __name__ == "__main__":
    main()
