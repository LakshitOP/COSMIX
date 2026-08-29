"""Service for managing and persisting satellite logs.

Handles:
1. Recently viewed satellites log (sliding window of last 10 unique satellites).
2. Saved/tracked satellites collective log (persistent watchlist with custom notes and telemetry).

Both logs are dual-persisted:
- To relational database tables (``recently_viewed_satellites`` and ``saved_satellites``)
- To structured JSON and formatted text ``.log`` files under ``backend/logs/``.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select

from app.database import SessionLocal, get_engine
from app.models.satellite import RecentlyViewedRecord, SavedSatelliteRecord

# Resolve backend logs directory relative to this file
_LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
_RECENTLY_VIEWED_JSON = _LOGS_DIR / "recently_viewed_satellites.json"
_RECENTLY_VIEWED_LOG = _LOGS_DIR / "recently_viewed_satellites.log"
_SAVED_SATELLITES_JSON = _LOGS_DIR / "saved_tracked_satellites.json"
_SAVED_SATELLITES_LOG = _LOGS_DIR / "saved_tracked_satellites.log"

MAX_RECENT_SATELLITES = 10


def _ensure_logs_dir() -> None:
    """Ensure the logs directory exists."""
    _LOGS_DIR.mkdir(parents=True, exist_ok=True)


def _ensure_db() -> None:
    """Ensure the database engine is initialized."""
    get_engine()


# ---------------------------------------------------------------------------
# Recently Viewed Satellites (Last 10)
# ---------------------------------------------------------------------------

def get_recently_viewed_satellites() -> List[Dict[str, Any]]:
    """Retrieve the last 10 recently viewed satellites from the JSON log file or DB."""
    _ensure_logs_dir()
    if not _RECENTLY_VIEWED_JSON.exists():
        return []

    try:
        with open(_RECENTLY_VIEWED_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data[:MAX_RECENT_SATELLITES]
            return []
    except Exception as exc:
        print(f"[LOG] Error reading {_RECENTLY_VIEWED_JSON.name}: {exc}")
        return []


def _format_recently_viewed_text_log(entries: List[Dict[str, Any]]) -> str:
    """Generate human-readable .log file content for recently viewed satellites."""
    lines = [
        "=" * 80,
        f"COSMIX - RECENTLY VIEWED SATELLITES LOG (LAST {MAX_RECENT_SATELLITES})",
        f"Log generated at (UTC): {datetime.now(timezone.utc).isoformat()}",
        f"Total entries: {len(entries)}",
        "=" * 80,
        f"{'#':<3} | {'NORAD ID':<9} | {'SATELLITE NAME':<24} | {'ALT (km)':<9} | {'LAT, LON':<18} | {'VIEWED AT (UTC)':<20}",
        "-" * 80,
    ]
    for idx, entry in enumerate(entries, 1):
        norad_id = entry.get("norad_id", "N/A")
        name = str(entry.get("name", "UNKNOWN"))[:24]
        alt = f"{entry.get('altitude_km', 0.0):.1f}" if entry.get("altitude_km") is not None else "-"
        lat = entry.get("latitude_deg")
        lon = entry.get("longitude_deg")
        coords = f"{lat:.1f}°, {lon:.1f}°" if lat is not None and lon is not None else "-"
        viewed_at = str(entry.get("viewed_at", ""))[:19].replace("T", " ")
        lines.append(
            f"{idx:<3} | {norad_id:<9} | {name:<24} | {alt:<9} | {coords:<18} | {viewed_at:<20}"
        )
    lines.append("=" * 80)
    return "\n".join(lines) + "\n"


def record_satellite_view(
    norad_id: int,
    name: str,
    altitude_km: Optional[float] = None,
    latitude_deg: Optional[float] = None,
    longitude_deg: Optional[float] = None,
    velocity_km_s: Optional[float] = None,
    risk_level: Optional[str] = None,
    notes: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Record a satellite as viewed.

    Updates the sliding window to maintain the last 10 unique satellites
    (most recently viewed first). Persists to relational DB, JSON, and text .log files.
    """
    _ensure_logs_dir()
    current_entries = get_recently_viewed_satellites()

    now_dt = datetime.now(timezone.utc)
    now_utc = now_dt.isoformat()
    new_entry = {
        "norad_id": norad_id,
        "name": name,
        "viewed_at": now_utc,
        "altitude_km": altitude_km,
        "latitude_deg": latitude_deg,
        "longitude_deg": longitude_deg,
        "velocity_km_s": velocity_km_s,
        "risk_level": risk_level,
        "notes": notes,
    }

    # Filter out existing entry with same norad_id to bump to top (MRU)
    filtered = [e for e in current_entries if e.get("norad_id") != norad_id]
    updated_entries = [new_entry] + filtered
    updated_entries = updated_entries[:MAX_RECENT_SATELLITES]

    # Write to JSON log
    try:
        with open(_RECENTLY_VIEWED_JSON, "w", encoding="utf-8") as f:
            json.dump(updated_entries, f, indent=2)
    except Exception as exc:
        print(f"[LOG] Error writing {_RECENTLY_VIEWED_JSON.name}: {exc}")

    # Write to formatted text .log file
    try:
        with open(_RECENTLY_VIEWED_LOG, "w", encoding="utf-8") as f:
            f.write(_format_recently_viewed_text_log(updated_entries))
    except Exception as exc:
        print(f"[LOG] Error writing {_RECENTLY_VIEWED_LOG.name}: {exc}")

    # Persist to relational DB table
    try:
        _ensure_db()
        with SessionLocal.begin() as session:
            session.add(
                RecentlyViewedRecord(
                    norad_id=norad_id,
                    name=name,
                    altitude_km=altitude_km,
                    latitude_deg=latitude_deg,
                    longitude_deg=longitude_deg,
                    velocity_km_s=velocity_km_s,
                    risk_level=risk_level or "NORMAL",
                    notes=notes,
                    viewed_at=now_dt,
                )
            )
    except Exception as exc:
        print(f"[LOG] Error recording view to database: {exc}")

    return updated_entries


def clear_recently_viewed_log() -> None:
    """Clear all recently viewed entries from files and relational DB."""
    _ensure_logs_dir()
    try:
        with open(_RECENTLY_VIEWED_JSON, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        with open(_RECENTLY_VIEWED_LOG, "w", encoding="utf-8") as f:
            f.write(_format_recently_viewed_text_log([]))
    except Exception as exc:
        print(f"[LOG] Error clearing recently viewed log: {exc}")

    try:
        _ensure_db()
        with SessionLocal.begin() as session:
            session.execute(delete(RecentlyViewedRecord))
    except Exception as exc:
        print(f"[LOG] Error clearing recently viewed from DB: {exc}")


# ---------------------------------------------------------------------------
# Saved / Collective Track Log
# ---------------------------------------------------------------------------

def get_saved_tracked_satellites() -> List[Dict[str, Any]]:
    """Retrieve all saved satellites from the collective track log JSON file."""
    _ensure_logs_dir()
    if not _SAVED_SATELLITES_JSON.exists():
        return []

    try:
        with open(_SAVED_SATELLITES_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception as exc:
        print(f"[LOG] Error reading {_SAVED_SATELLITES_JSON.name}: {exc}")
        return []


def _format_saved_tracked_text_log(entries: List[Dict[str, Any]]) -> str:
    """Generate human-readable .log file content for collective tracked satellites."""
    lines = [
        "=" * 90,
        "COSMIX - COLLECTIVE SAVED SATELLITES TRACK LOG",
        f"Log generated at (UTC): {datetime.now(timezone.utc).isoformat()}",
        f"Total tracked satellites: {len(entries)}",
        "=" * 90,
        f"{'#':<3} | {'NORAD ID':<9} | {'SATELLITE NAME':<22} | {'RISK':<8} | {'ALT (km)':<9} | {'ADDED (UTC)':<16} | {'NOTES':<20}",
        "-" * 90,
    ]
    for idx, entry in enumerate(entries, 1):
        norad_id = entry.get("norad_id", "N/A")
        name = str(entry.get("name", "UNKNOWN"))[:22]
        risk = str(entry.get("risk_level", "NORMAL"))[:8]
        alt = f"{entry.get('altitude_km', 0.0):.1f}" if entry.get("altitude_km") is not None else "-"
        added_at = str(entry.get("added_at", ""))[:16].replace("T", " ")
        notes = str(entry.get("notes") or "-")[:20]
        lines.append(
            f"{idx:<3} | {norad_id:<9} | {name:<22} | {risk:<8} | {alt:<9} | {added_at:<16} | {notes:<20}"
        )
    lines.append("=" * 90)
    return "\n".join(lines) + "\n"


def save_tracked_satellite(
    norad_id: int,
    name: str,
    notes: Optional[str] = "",
    tags: Optional[List[str]] = None,
    apogee_km: Optional[float] = None,
    perigee_km: Optional[float] = None,
    inclination_deg: Optional[float] = None,
    altitude_km: Optional[float] = None,
    latitude_deg: Optional[float] = None,
    longitude_deg: Optional[float] = None,
    risk_level: Optional[str] = None,
) -> Dict[str, Any]:
    """Save or update a satellite in the collective track log and relational table."""
    _ensure_logs_dir()
    current_entries = get_saved_tracked_satellites()

    now_dt = datetime.now(timezone.utc)
    now_utc = now_dt.isoformat()
    existing_entry = next((e for e in current_entries if e.get("norad_id") == norad_id), None)

    saved_entry = {
        "norad_id": norad_id,
        "name": name,
        "added_at": existing_entry.get("added_at") if existing_entry else now_utc,
        "updated_at": now_utc,
        "notes": notes if notes is not None else (existing_entry.get("notes") if existing_entry else ""),
        "tags": tags if tags is not None else (existing_entry.get("tags", []) if existing_entry else []),
        "apogee_km": apogee_km if apogee_km is not None else (existing_entry.get("apogee_km") if existing_entry else None),
        "perigee_km": perigee_km if perigee_km is not None else (existing_entry.get("perigee_km") if existing_entry else None),
        "inclination_deg": inclination_deg if inclination_deg is not None else (existing_entry.get("inclination_deg") if existing_entry else None),
        "altitude_km": altitude_km if altitude_km is not None else (existing_entry.get("altitude_km") if existing_entry else None),
        "latitude_deg": latitude_deg if latitude_deg is not None else (existing_entry.get("latitude_deg") if existing_entry else None),
        "longitude_deg": longitude_deg if longitude_deg is not None else (existing_entry.get("longitude_deg") if existing_entry else None),
        "risk_level": risk_level if risk_level is not None else (existing_entry.get("risk_level") if existing_entry else "NORMAL"),
    }

    # Replace or prepend
    updated_entries = [saved_entry] + [e for e in current_entries if e.get("norad_id") != norad_id]

    try:
        with open(_SAVED_SATELLITES_JSON, "w", encoding="utf-8") as f:
            json.dump(updated_entries, f, indent=2)
    except Exception as exc:
        print(f"[LOG] Error writing {_SAVED_SATELLITES_JSON.name}: {exc}")

    try:
        with open(_SAVED_SATELLITES_LOG, "w", encoding="utf-8") as f:
            f.write(_format_saved_tracked_text_log(updated_entries))
    except Exception as exc:
        print(f"[LOG] Error writing {_SAVED_SATELLITES_LOG.name}: {exc}")

    # Persist to relational DB
    try:
        _ensure_db()
        with SessionLocal.begin() as session:
            db_record = session.get(SavedSatelliteRecord, norad_id)
            if db_record:
                db_record.name = name
                db_record.notes = saved_entry["notes"]
                db_record.tags = json.dumps(saved_entry["tags"])
                db_record.apogee_km = saved_entry["apogee_km"]
                db_record.perigee_km = saved_entry["perigee_km"]
                db_record.inclination_deg = saved_entry["inclination_deg"]
                db_record.altitude_km = saved_entry["altitude_km"]
                db_record.latitude_deg = saved_entry["latitude_deg"]
                db_record.longitude_deg = saved_entry["longitude_deg"]
                db_record.risk_level = saved_entry["risk_level"]
                db_record.updated_at = now_dt
            else:
                session.add(
                    SavedSatelliteRecord(
                        norad_id=norad_id,
                        name=name,
                        notes=saved_entry["notes"],
                        tags=json.dumps(saved_entry["tags"]),
                        apogee_km=saved_entry["apogee_km"],
                        perigee_km=saved_entry["perigee_km"],
                        inclination_deg=saved_entry["inclination_deg"],
                        altitude_km=saved_entry["altitude_km"],
                        latitude_deg=saved_entry["latitude_deg"],
                        longitude_deg=saved_entry["longitude_deg"],
                        risk_level=saved_entry["risk_level"],
                        added_at=now_dt,
                        updated_at=now_dt,
                    )
                )
    except Exception as exc:
        print(f"[LOG] Error saving satellite to DB: {exc}")

    return saved_entry


def remove_saved_tracked_satellite(norad_id: int) -> bool:
    """Remove a satellite from the collective track log and relational table."""
    _ensure_logs_dir()
    current_entries = get_saved_tracked_satellites()
    updated_entries = [e for e in current_entries if e.get("norad_id") != norad_id]

    if len(updated_entries) == len(current_entries):
        return False

    try:
        with open(_SAVED_SATELLITES_JSON, "w", encoding="utf-8") as f:
            json.dump(updated_entries, f, indent=2)
    except Exception as exc:
        print(f"[LOG] Error writing {_SAVED_SATELLITES_JSON.name}: {exc}")

    try:
        with open(_SAVED_SATELLITES_LOG, "w", encoding="utf-8") as f:
            f.write(_format_saved_tracked_text_log(updated_entries))
    except Exception as exc:
        print(f"[LOG] Error writing {_SAVED_SATELLITES_LOG.name}: {exc}")

    # Remove from relational DB
    try:
        _ensure_db()
        with SessionLocal.begin() as session:
            session.execute(
                delete(SavedSatelliteRecord).where(SavedSatelliteRecord.norad_id == norad_id)
            )
    except Exception as exc:
        print(f"[LOG] Error removing satellite from DB: {exc}")

    return True


def get_log_file_path(log_type: str, format: str = "json") -> Optional[Path]:
    """Return the absolute path to the requested log file."""
    _ensure_logs_dir()
    if log_type == "recently_viewed":
        return _RECENTLY_VIEWED_LOG if format == "log" else _RECENTLY_VIEWED_JSON
    elif log_type == "saved_satellites":
        return _SAVED_SATELLITES_LOG if format == "log" else _SAVED_SATELLITES_JSON
    return None
