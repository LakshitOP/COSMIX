"""FastAPI application entry point.

Startup:
  1. Validates that the XGBoost risk model exists.
  2. Initialises the database schema (SQLite dev / PostgreSQL prod).
  3. Fetches the initial TLE catalog from CelesTrak (stations + active).
  4. Launches a background auto-refresh task that re-fetches TLEs every 2 h.

Endpoints:
  REST API          → /api/...
  WebSocket stream → /ws/stream
"""

from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.api.websockets import router as ws_router
from app.database import initialize_database
from app.services.risk_scorer import is_model_loaded

# How often (seconds) the background task re-fetches TLEs from CelesTrak.
# CelesTrak updates its GP catalog several times per day; 2 h keeps data fresh.
CATALOG_REFRESH_INTERVAL_S: int = int(
    os.environ.get("CATALOG_REFRESH_INTERVAL_S", 7200)  # default 2 hours
)

# Which CelesTrak groups to load on startup and during auto-refresh.
# Azure App Service is memory-constrained, so a smaller default startup catalog
# avoids worker OOM kills during boot while still keeping a usable live dataset.
_DEFAULT_GROUPS = "active,stations,visual,last-30-days,fengyun-1c-debris,iridium-33-debris,cosmos-2251-debris"
_DEFAULT_AZURE_STARTUP_GROUPS = "active,stations"

azure_startup = os.environ.get("WEBSITE_SITE_NAME") or os.environ.get("WEBSITE_INSTANCE_ID")
if azure_startup:
    startup_groups = _DEFAULT_AZURE_STARTUP_GROUPS
else:
    startup_groups = _DEFAULT_GROUPS

CELESTRAK_GROUPS: list[str] = [
    g.strip()
    for g in os.environ.get("CELESTRAK_GROUPS", startup_groups).split(",")
    if g.strip()
]


# ---------------------------------------------------------------------------
# Background auto-refresh task
# ---------------------------------------------------------------------------

async def _auto_refresh_catalog() -> None:
    """Background asyncio task: re-fetch TLEs from CelesTrak every 2 hours.

    Runs every ``CATALOG_REFRESH_INTERVAL_S`` seconds (default: 7200s = 2h).
    Dynamically inspects the current active dataset group from application state
    and pulls fresh orbital element sets directly from CelesTrak, pushing the
    updated SGP4 coordinates through the real-time WebSocket telemetry stream.
    """
    from app.data.fetch_tles import (
        build_celestrak_url,
        fetch_active_catalog,
        fetch_multiple_groups,
    )
    from app.state import get_catalog_meta, set_catalog

    while True:
        await asyncio.sleep(CATALOG_REFRESH_INTERVAL_S)

        meta = get_catalog_meta()
        current_group = meta.get("group") or _DEFAULT_GROUPS
        groups = [g.strip() for g in current_group.split("+") if g.strip()] or [current_group]

        print(
            f"[AUTO-REFRESH] Scheduled 2-hour CelesTrak sync initiated "
            f"(dataset: {', '.join(groups)})..."
        )
        try:
            if len(groups) == 1:
                catalog = await asyncio.to_thread(fetch_active_catalog, groups[0])
            else:
                catalog = await asyncio.to_thread(fetch_multiple_groups, groups)

            if catalog:
                source_url = " + ".join(build_celestrak_url(g) for g in groups)
                set_catalog(catalog, group="+".join(groups), source_url=source_url)
                updated_meta = get_catalog_meta()
                print(
                    f"[AUTO-REFRESH] ✓ Live CelesTrak sync complete: {updated_meta['count']} objects "
                    f"in '{updated_meta['group']}' updated at {updated_meta['last_updated_utc']}."
                )
                # Re-run conjunction scan so alerts stay fresh after each TLE refresh
                try:
                    from app.api.routes import run_conjunction_scan  # noqa: PLC0415
                    alerts = await asyncio.to_thread(run_conjunction_scan)
                    print(f"[AUTO-REFRESH] ✓ Conjunction re-scan: {len(alerts)} alert(s) updated.")
                except Exception as scan_exc:
                    print(f"[AUTO-REFRESH] ⚠ Conjunction re-scan notice: {scan_exc}")
            else:
                print("[AUTO-REFRESH] ⚠ CelesTrak returned empty set; maintaining existing live telemetry.")
        except Exception as exc:
            print(f"[AUTO-REFRESH] ✗ Unexpected notice during scheduled refresh: {exc}")


# ---------------------------------------------------------------------------
# Lifespan (startup + shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup → serve → shutdown lifecycle manager."""

    # 1. Validate ML model (heuristic fallback always available)
    if not is_model_loaded():
        print(
            "[WARNING] XGBoost risk model unavailable. "
            "Physics-based heuristic fallback will be used for conjunction scoring."
        )

    # 2. Initialise database schema
    initialize_database()

    # 3. Initial CelesTrak fetch (runs in thread pool to keep startup non-blocking)
    print(f"[INIT] Fetching initial TLE catalog from CelesTrak (groups: {', '.join(CELESTRAK_GROUPS)})...")
    try:
        from app.data.fetch_tles import build_celestrak_url, fetch_multiple_groups
        from app.state import get_catalog_meta, set_catalog

        catalog = await asyncio.to_thread(fetch_multiple_groups, CELESTRAK_GROUPS)
        if catalog:
            source_url = " + ".join(build_celestrak_url(g) for g in CELESTRAK_GROUPS)
            set_catalog(catalog, group="+".join(CELESTRAK_GROUPS), source_url=source_url)
            meta = get_catalog_meta()
            print(f"[INIT] ✓ Catalog ready: {meta['count']} satellites loaded.")
        else:
            print("[INIT] ⚠  CelesTrak returned no data. WebSocket stream will be empty until refresh.")
    except Exception as exc:
        print(f"[INIT] ⚠  Could not fetch initial catalog: {exc}")

    # 4. Auto-run initial conjunction scan so the bus is populated on first load.
    # Keep this disabled by default on Azure to avoid worker timeouts/OOMs during boot.
    enable_startup_scan = os.environ.get("COSMIX_ENABLE_STARTUP_SCAN", "false").lower() in {"1", "true", "yes", "on"}
    if enable_startup_scan:
        async def _initial_conjunction_scan() -> None:
            """Run one conjunction scan shortly after startup so the bus is never empty."""
            await asyncio.sleep(5)  # Give catalog state a moment to settle
            try:
                from app.api.routes import run_conjunction_scan  # noqa: PLC0415
                alerts = await asyncio.to_thread(run_conjunction_scan)
                print(f"[INIT] ✓ Auto-scan complete: {len(alerts)} conjunction alert(s) stored.")
            except Exception as exc:
                print(f"[INIT] ⚠  Auto-scan notice: {exc}")

        asyncio.create_task(_initial_conjunction_scan(), name="initial-conjunction-scan")

    # 5. Launch background auto-refresh task
    refresh_task = asyncio.create_task(
        _auto_refresh_catalog(),
        name="celestrak-auto-refresh",
    )
    print(
        f"[INIT] Background catalog auto-refresh started "
        f"(interval: {CATALOG_REFRESH_INTERVAL_S // 60} min)."
    )

    yield  # ── Application serves requests here ──

    # 6. Shutdown: cancel the background task cleanly
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass
    print("[SHUTDOWN] Catalog auto-refresh task stopped.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Space Debris Tracking & Collision Risk Engine",
    description="Astrodynamics SGP4 propagation and conjunction assessment API",
    version="1.0.0",
    lifespan=lifespan,
)
@app.get("/health")
def health():
    return {"status": "ok"}
# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------

origins = [
    # Local development — common ports used by VS Code Live Server, Vite, etc.
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5000",
    "http://localhost:5500",
    "http://localhost:5501",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8080",
    # Production / staging
    "https://cosmix-uy6f.vercel.app",
    "https://cosmix.me",
    "https://pritlis-backend-8ifn.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_FRONTEND_DIR = _PROJECT_ROOT / "frontend"

app.include_router(api_router, prefix="/api")
app.include_router(ws_router, prefix="/ws")

# Serve frontend directly from FastAPI for zero-config single-port launch
@app.get("/", include_in_schema=False)
def root():
    home_index = _FRONTEND_DIR / "HOME" / "index.html"
    if home_index.exists():
        return FileResponse(str(home_index))
    return RedirectResponse(url="/HOME/index.html")

if _FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")