#!/usr/bin/env python3
"""
ORBITAL Space Debris & Conjunction Intelligence Platform
Unified launcher script.
"""

import os
import sys
from pathlib import Path

# Add project directories to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import uvicorn

def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")

    print("\n" + "=" * 65)
    print(" ✦ ORBITAL — Space Situational Awareness & Conjunction Risk Engine")
    print("=" * 65)
    print(f" ▶ Command Center UI:  http://localhost:{port}/")
    print(f" ▶ REST API Docs:      http://localhost:{port}/docs")
    print(f" ▶ Telemetry Stream:   ws://localhost:{port}/ws/stream")
    print("=" * 65 + "\n")

    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    main()
