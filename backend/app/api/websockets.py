"""Real-time WebSocket endpoint for live satellite telemetry.

Connect to ``ws://host/ws/stream`` to receive a 1 Hz stream of satellite
positions propagated via SGP4 from the latest CelesTrak TLEs.

Frame types emitted:
  ``telemetry_update``   — Sent every second. Contains current geodetic +
                            ECI positions for all satellites in the catalog.
  ``catalog_refreshed``  — Sent once whenever the background auto-refresh
                            task loads a new CelesTrak catalog mid-stream,
                            so the client knows positions now reflect
                            fresher TLEs.

Frame schema (telemetry_update)::

    {
        "type": "telemetry_update",
        "timestamp": "<ISO-8601 UTC>",
        "catalog_group": "<group name>",
        "catalog_last_updated_utc": "<ISO-8601 UTC | null>",
        "count": <int>,
        "data": [
            {
                "norad_id": 25544,
                "name": "ISS (ZARYA)",
                "timestamp": "<ISO-8601 UTC>",
                "latitude_deg":  51.6,
                "longitude_deg": -10.3,
                "altitude_km":   420.1,
                "x_km": ..., "y_km": ..., "z_km": ...,
                "vx_km_s": ..., "vy_km_s": ..., "vz_km_s": ...
            },
            ...
        ]
    }
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.state import get_catalog, get_catalog_meta

router = APIRouter()


# ---------------------------------------------------------------------------
# Thread-pool worker — SGP4-propagates all satellites at a given timestamp
# ---------------------------------------------------------------------------

def _propagate_catalog_snapshot(now: datetime) -> list[dict[str, Any]]:
    """Propagate every satellite in the current catalog to *now*.

    Uses cached EarthSatellite C-structures and single-evaluation timescale
    for near-zero CPU overhead.
    """
    from app.core.sgp4_engine import ts, wgs84, get_or_create_satellite_obj

    catalog = get_catalog()
    positions: list[dict[str, Any]] = []
    t = ts.from_datetime(now)
    now_iso = now.isoformat()

    for sat in catalog:
        try:
            sat_obj = get_or_create_satellite_obj(sat)
            geocentric = sat_obj.at(t)
            subpoint = wgs84.subpoint_of(geocentric)

            positions.append(
                {
                    "norad_id": sat.norad_id,
                    "name": sat.name,
                    "timestamp": now_iso,
                    "latitude_deg":  round(float(subpoint.latitude.degrees), 5),
                    "longitude_deg": round(float(subpoint.longitude.degrees), 5),
                    "altitude_km":   round(float(wgs84.height_of(geocentric).km), 2),
                    "x_km":  round(float(geocentric.position.km[0]), 2),
                    "y_km":  round(float(geocentric.position.km[1]), 2),
                    "z_km":  round(float(geocentric.position.km[2]), 2),
                }
            )
        except Exception:
            continue

    return positions


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/stream")
async def coordinate_stream(websocket: WebSocket) -> None:
    """Stream live satellite positions to connected clients at 1 Hz."""
    await websocket.accept()
    client = websocket.client
    print(f"[WS] Client connected: {client.host}:{client.port}")

    # Track the catalog version so we can emit a catalog_refreshed notice
    # when the background auto-refresh task loads a new CelesTrak snapshot.
    last_seen_updated: str | None = get_catalog_meta()["last_updated_utc"]

    try:
        while True:
            now = datetime.now(timezone.utc)
            meta = get_catalog_meta()

            # Detect a catalog swap by the background refresh task.
            current_updated = meta["last_updated_utc"]
            if current_updated != last_seen_updated and last_seen_updated is not None:
                notice = {
                    "type": "catalog_refreshed",
                    "timestamp": now.isoformat(),
                    "catalog_group": meta["group"],
                    "catalog_last_updated_utc": current_updated,
                    "count": meta["count"],
                    "message": (
                        f"TLE catalog updated from CelesTrak "
                        f"({meta['count']} satellites, group: {meta['group']})"
                    ),
                }
                await websocket.send_text(json.dumps(notice))
                print(
                    f"[WS] Notified {client.host}:{client.port} of catalog refresh "
                    f"({meta['count']} satellites)."
                )

            last_seen_updated = current_updated

            # Offload CPU-bound SGP4 propagation to the thread pool.
            positions = await asyncio.to_thread(_propagate_catalog_snapshot, now)

            payload = {
                "type": "telemetry_update",
                "timestamp": now.isoformat(),
                "catalog_group": meta["group"],
                "catalog_last_updated_utc": meta["last_updated_utc"],
                "count": len(positions),
                "data": positions,
            }

            await websocket.send_text(json.dumps(payload))

            # 1 frame per second
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {client.host}:{client.port}")
    except Exception as exc:  # noqa: BLE001
        print(f"[WS] Stream error for {client.host}:{client.port}: {exc}")
        try:
            await websocket.close(code=1011, reason=str(exc))
        except Exception:
            pass