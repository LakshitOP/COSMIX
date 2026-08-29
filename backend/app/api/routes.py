"""REST API routes for the Space Debris Tracking backend."""

from __future__ import annotations

import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path as SysPath
from typing import Any, Dict, List, Optional, Tuple

# Ensure backend directory is in sys.path
_BACKEND_DIR = SysPath(__file__).resolve().parent.parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import FileResponse

from app.core.filters import filter_apogee_perigee
from app.core.sgp4_engine import propagate_orbit_track, propagate_satellite_state
from app.core.tca_solver import create_earth_satellite, find_tca_between_pair
from app.data.fetch_tles import (
    SUPPORTED_GROUPS,
    build_celestrak_url,
    fetch_active_catalog,
    fetch_multiple_groups,
)
from app.models.schemas import (
    ConjunctionAlert,
    OrbitTracksResponse,
    RecentlyViewedSatellite,
    RecordViewRequest,
    SatelliteOrbitTrack,
    SatelliteRecord,
    SavedSatellite,
    SaveSatelliteRequest,
)
from app.services.conjunction_repository import (
    list_recent_conjunction_alerts,
    save_conjunction_alerts,
)
from app.services.satellite_repository import (
    get_satellites_by_group,
    upsert_satellites_for_group,
)
from app.services.log_service import (
    clear_recently_viewed_log,
    get_log_file_path,
    get_recently_viewed_satellites,
    get_saved_tracked_satellites,
    record_satellite_view,
    remove_saved_tracked_satellite,
    save_tracked_satellite,
)
from app.services.risk_scorer import calculate_conjunction_risk, is_model_loaded
from app.state import get_catalog, get_catalog_meta, set_catalog

router = APIRouter()



# ---------------------------------------------------------------------------
# Health & status
# ---------------------------------------------------------------------------

@router.get("/health", response_model=dict)
def health_check():
    """Report API health and live catalog state."""
    meta = get_catalog_meta()
    return {
        "status": "ok",
        "risk_model_loaded": is_model_loaded(),
        "risk_scoring_mode": "ml" if is_model_loaded() else "heuristic",
        "catalog_size": meta["count"],
        "catalog_group": meta["group"],
        "catalog_last_updated_utc": meta["last_updated_utc"],
        "catalog_age_seconds": meta["age_seconds"],
    }


@router.get("/catalog/status", response_model=dict)
def catalog_status():
    """Return detailed metadata about the currently cached TLE catalog."""
    meta = get_catalog_meta()
    return {
        **meta,
        "supported_groups": SUPPORTED_GROUPS,
        "refresh_hint": (
            "POST /api/catalog/refresh?group=<name> to trigger a manual refresh, "
            "or POST /api/catalog/refresh-multi?groups=stations&groups=starlink"
        ),
    }


# ---------------------------------------------------------------------------
# Catalog management
# ---------------------------------------------------------------------------

@router.post("/catalog/refresh", response_model=dict)
def refresh_catalog(
    group: str = Query(
        "active",
        description=f"CelesTrak group name. Supported: {', '.join(SUPPORTED_GROUPS)}",
    )
):
    """Fetch the latest TLE catalog for a single CelesTrak group and sync to DB partition."""
    url = build_celestrak_url(group)
    try:
        catalog = fetch_active_catalog(group)
        if not catalog:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"CelesTrak returned no data for group '{group}'. "
                    "The group name may be invalid or the service is temporarily unavailable."
                ),
            )
        set_catalog(catalog, group=group, source_url=url)
        # Sync to category-partitioned database relation
        try:
            upsert_satellites_for_group(group, catalog)
        except Exception as db_err:
            print(f"[DB] Notice during partitioned sync: {db_err}")

        return {
            "status": "success",
            "total_objects": len(catalog),
            "group": group,
            "source_url": url,
            "fetched_at_utc": get_catalog_meta()["last_updated_utc"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/catalog/refresh-multi", response_model=dict)
def refresh_catalog_multi(
    groups: List[str] = Query(
        default=["stations", "active"],
        description="CelesTrak group names to fetch and merge (deduplicates by NORAD ID).",
    )
):
    """Fetch and merge TLE catalogs from multiple CelesTrak groups and sync to DB partitions."""
    try:
        catalog = fetch_multiple_groups(groups)
        if not catalog:
            raise HTTPException(
                status_code=502, detail=f"All requested groups returned no data: {groups}"
            )
        source_url = " + ".join(build_celestrak_url(g) for g in groups)
        set_catalog(catalog, group="+".join(groups), source_url=source_url)

        # Sync to database partitions
        for g in groups:
            try:
                g_cat = fetch_active_catalog(g)
                if g_cat:
                    upsert_satellites_for_group(g, g_cat)
            except Exception as db_err:
                print(f"[DB] Partition sync notice for '{g}': {db_err}")

        return {
            "status": "success",
            "total_objects": len(catalog),
            "groups": groups,
            "source_url": source_url,
            "fetched_at_utc": get_catalog_meta()["last_updated_utc"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/catalog", response_model=List[SatelliteRecord])
def get_catalog_endpoint(
    limit: Optional[int] = Query(None, description="Optional maximum number of satellites to return (defaults to all)"),
    group: Optional[str] = Query(None, description="Optional category partition to query (e.g. 'starlink', 'stations')"),
    query: Optional[str] = Query(None, description="Search term to match against satellite name, NORAD ID, or international designator"),
):
    """Return all objects in the satellite catalog, optionally filtered by category partition or live search query."""
    grp = group if isinstance(group, str) and group.strip() else None
    q_str = query if isinstance(query, str) and query.strip() else None
    lim = limit if isinstance(limit, int) and limit > 0 else None

    catalog = []
    if grp:
        db_sats = get_satellites_by_group(grp, limit=lim or 50000)
        if db_sats:
            catalog = db_sats
        else:
            try:
                from app.data.fetch_tles import fetch_active_catalog
                live_records = fetch_active_catalog(grp, timeout=6)
                if live_records:
                    upsert_satellites_for_group(grp, live_records)
                    catalog = live_records
            except Exception:
                pass

    if not catalog:
        catalog = get_catalog()
        if not catalog:
            try:
                from app.data.fetch_tles import fetch_active_catalog
                live_records = fetch_active_catalog("stations", timeout=6)
                if live_records:
                    upsert_satellites_for_group("stations", live_records)
                    catalog = live_records
            except Exception:
                pass

    if q_str:
        q = q_str.strip().upper()
        search_pool = list(catalog)
        if not grp:
            try:
                from app.data.fetch_tles import fetch_active_catalog
                for deb_grp in ("fengyun-1c-debris", "cosmos-2251-debris", "iridium-33-debris"):
                    deb_sats = fetch_active_catalog(deb_grp)
                    if deb_sats:
                        search_pool.extend(deb_sats)
            except Exception:
                pass

        seen_norad = set()
        matched = []
        for s in search_pool:
            if s.norad_id not in seen_norad:
                if q in s.name.upper() or q in str(s.norad_id) or (getattr(s, "intl_designator", None) and q in getattr(s, "intl_designator", "").upper()):
                    seen_norad.add(s.norad_id)
                    matched.append(s)

        if lim is not None:
            return matched[:lim]
        return matched

    if lim is not None:
        return catalog[:lim]
    return catalog


# ---------------------------------------------------------------------------
# Orbit tracks  (for 2-D / 3-D orbit plot)
# ---------------------------------------------------------------------------

@router.get("/orbit-tracks", response_model=OrbitTracksResponse)
def get_orbit_tracks(
    hours: float = Query(
        3.0, gt=0, le=24,
        description="How many hours ahead to propagate each orbit.",
    ),
    step_minutes: float = Query(
        2.0, gt=0.1, le=30,
        description="Time step between track points (minutes). Smaller = smoother curve.",
    ),
    limit: int = Query(
        100, ge=1, le=500,
        description="Maximum number of satellites to include (sliced from the catalog).",
    ),
):
    """Return propagated ground-tracks for up to *limit* catalog satellites.

    Each satellite entry contains an array of (t, lat, lon, alt_km) points
    covering the next *hours* hours at *step_minutes* resolution — everything
    a 2-D orbit-plot renderer needs to draw the orbit path.

    Performance note: propagation uses Skyfield's vectorised SGP4 (one C call
    per satellite), so 100 satellites × 3 h at 2-min steps (~90 points each)
    typically finishes in < 2 seconds.
    """
    catalog = get_catalog()
    if not catalog:
        raise HTTPException(
            status_code=400,
            detail="Catalog is empty. Call POST /api/catalog/refresh first.",
        )

    subset = catalog[:limit]
    meta = get_catalog_meta()
    now = datetime.now(timezone.utc)

    satellites: List[SatelliteOrbitTrack] = []
    for sat in subset:
        try:
            track = propagate_orbit_track(sat, now, duration_hours=hours, step_minutes=step_minutes)
            satellites.append(
                SatelliteOrbitTrack(
                    norad_id=sat.norad_id,
                    name=sat.name,
                    inclination_deg=sat.inclination_deg,
                    apogee_km=sat.apogee_km,
                    perigee_km=sat.perigee_km,
                    track=track,
                )
            )
        except Exception as exc:
            # A single bad TLE should not abort the whole response.
            print(f"[TRACKS] Propagation failed for {sat.name} ({sat.norad_id}): {exc}")

    return OrbitTracksResponse(
        generated_at_utc=now,
        propagation_hours=hours,
        step_minutes=step_minutes,
        catalog_group=meta["group"],
        catalog_last_updated_utc=meta["last_updated_utc"],
        satellite_count=len(satellites),
        satellites=satellites,
    )


@router.get("/satellites/{norad_id}/track", response_model=SatelliteOrbitTrack)
def get_single_satellite_track(
    norad_id: int = Path(..., description="NORAD Catalog Number of the satellite."),
    hours: float = Query(3.0, gt=0, le=24, description="Hours to propagate forward."),
    step_minutes: float = Query(2.0, gt=0.1, le=30, description="Step size in minutes."),
):
    """Return the propagated ground-track for a single satellite by NORAD ID.

    Useful for highlighting one object on the 2-D map without fetching the
    full catalog track array.
    """
    catalog = get_catalog()
    sat = next((s for s in catalog if s.norad_id == norad_id), None)

    if sat is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"NORAD ID {norad_id} not found in the current catalog "
                f"({len(catalog)} objects loaded). "
                "Try refreshing: POST /api/catalog/refresh."
            ),
        )

    now = datetime.now(timezone.utc)
    track = propagate_orbit_track(sat, now, duration_hours=hours, step_minutes=step_minutes)

    return SatelliteOrbitTrack(
        norad_id=sat.norad_id,
        name=sat.name,
        inclination_deg=sat.inclination_deg,
        apogee_km=sat.apogee_km,
        perigee_km=sat.perigee_km,
        track=track,
    )


# ---------------------------------------------------------------------------
# Conjunction analysis
# ---------------------------------------------------------------------------

@router.get("/conjunctions", response_model=List[ConjunctionAlert])
def get_recent_conjunctions(
    limit: int = Query(50, ge=1, le=1000),
    group: Optional[str] = Query(None, description="Optional category partition to filter by (e.g. 'active', 'starlink')"),
):
    """Return active upcoming conjunction alerts from the database, newest first."""
    if not isinstance(limit, int):
        limit = getattr(limit, "default", 50)
    if not isinstance(group, str):
        group = None

    alerts = list_recent_conjunction_alerts(limit=limit, catalog_group=group, future_only=True)
    if not alerts:
        try:
            alerts = run_conjunction_scan(max_candidates=50, miss_distance_cutoff_km=25.0, hours=24.0)
        except Exception:
            alerts = []
    return alerts


# In-memory scan cache to avoid redundant re-computations on repeated clicks
_SCAN_CACHE: Dict[str, Tuple[datetime, List[ConjunctionAlert]]] = {}
_SCAN_CACHE_TTL_SECONDS = 15.0


def _evaluate_candidate_pair(
    sat1: SatelliteRecord,
    sat2: SatelliteRecord,
    sat1_obj: Any,
    sat2_obj: Any,
    now: datetime,
    hours: float,
    miss_distance_cutoff_km: float,
    current_group: str,
) -> Optional[ConjunctionAlert]:
    """Worker function to evaluate a single candidate pair."""
    _CO_ORBIT_MIN_KM = 0.5
    try:
        conjunction = find_tca_between_pair(
            sat1=sat1_obj,
            sat2=sat2_obj,
            start_time=now,
            duration_hours=hours,
            cutoff_km=miss_distance_cutoff_km,
        )

        miss_km = conjunction["miss_distance_km"]
        if miss_km < _CO_ORBIT_MIN_KM or miss_km > miss_distance_cutoff_km:
            return None

        # Risk scoring
        risk_score, risk_level = calculate_conjunction_risk(
            miss_km,
            conjunction["relative_velocity_km_s"],
            sat1.bstar_drag,
            sat2.bstar_drag,
        )

        # Propagate both satellites to TCA to get geographic positions
        tca_dt = conjunction["tca_utc"]
        sat1_lat = sat1_lon = sat1_alt = None
        sat2_lat = sat2_lon = sat2_alt = None
        try:
            s1 = propagate_satellite_state(sat1, tca_dt)
            sat1_lat = round(s1["latitude_deg"],  5)
            sat1_lon = round(s1["longitude_deg"], 5)
            sat1_alt = round(s1["altitude_km"],   3)
        except Exception:
            pass

        try:
            s2 = propagate_satellite_state(sat2, tca_dt)
            sat2_lat = round(s2["latitude_deg"],  5)
            sat2_lon = round(s2["longitude_deg"], 5)
            sat2_alt = round(s2["altitude_km"],   3)
        except Exception:
            pass

        return ConjunctionAlert(
            id=str(uuid.uuid4()),
            catalog_group=current_group,
            sat1_id=sat1.norad_id,
            sat1_name=sat1.name,
            sat2_id=sat2.norad_id,
            sat2_name=sat2.name,
            tca_utc=tca_dt,
            miss_distance_km=round(miss_km, 3),
            relative_velocity_km_s=round(conjunction["relative_velocity_km_s"], 3),
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            sat1_lat_at_tca=sat1_lat,
            sat1_lon_at_tca=sat1_lon,
            sat1_alt_at_tca_km=sat1_alt,
            sat2_lat_at_tca=sat2_lat,
            sat2_lon_at_tca=sat2_lon,
            sat2_alt_at_tca_km=sat2_alt,
        )
    except Exception as exc:
        print(f"[SCAN] Error evaluating pair {sat1.name} ↔ {sat2.name}: {exc}")
        return None


@router.get("/conjunctions/scan", response_model=List[ConjunctionAlert])
def run_conjunction_scan(
    max_candidates: int = Query(
        50, ge=2, le=200,
        description="Catalog subset size (smaller = faster demo; larger = more coverage).",
    ),
    miss_distance_cutoff_km: float = Query(
        25.0, gt=0, le=100,
        description="Flag any pair whose predicted separation drops below this value (km).",
    ),
    hours: float = Query(
        12.0, gt=0, le=72,
        description="Conjunction search window (hours from now).",
    ),
):
    """Ultra-fast parallel conjunction scan powered by vectorized SGP4 and multi-core threads."""
    # Coerce FastAPI Query param defaults when called directly as a Python function
    if not isinstance(max_candidates, int):
        max_candidates = getattr(max_candidates, "default", 50)
    if not isinstance(miss_distance_cutoff_km, (int, float)):
        miss_distance_cutoff_km = getattr(miss_distance_cutoff_km, "default", 25.0)
    if not isinstance(hours, (int, float)):
        hours = getattr(hours, "default", 12.0)

    catalog = get_catalog()
    if not catalog:
        raise HTTPException(
            status_code=400,
            detail="Catalog is empty. Call POST /api/catalog/refresh first.",
        )

    meta = get_catalog_meta()
    current_group = meta.get("group") or "active"
    cache_key = f"{current_group}_{max_candidates}_{miss_distance_cutoff_km}_{hours}_{meta.get('last_updated_utc')}"

    now = datetime.now(timezone.utc)

    # Return cached scan if still fresh
    if cache_key in _SCAN_CACHE:
        cached_time, cached_alerts = _SCAN_CACHE[cache_key]
        if (now - cached_time).total_seconds() < _SCAN_CACHE_TTL_SECONDS:
            return cached_alerts

    subset = catalog[:max_candidates]

    # Stage 1: Fast altitude overlap filter
    candidate_pairs = filter_apogee_perigee(
        subset, altitude_buffer_km=miss_distance_cutoff_km
    )

    if not candidate_pairs:
        _SCAN_CACHE[cache_key] = (now, [])
        return []

    # Stage 2: Pre-instantiate EarthSatellite objects once
    sat_objects = {sat.norad_id: create_earth_satellite(sat) for sat in subset}

    # Stage 3: Parallel evaluation across CPU threads
    max_workers = min(32, max(4, (os.cpu_count() or 4) * 2))
    alerts: List[ConjunctionAlert] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(
                _evaluate_candidate_pair,
                subset[i],
                subset[j],
                sat_objects[subset[i].norad_id],
                sat_objects[subset[j].norad_id],
                now,
                hours,
                miss_distance_cutoff_km,
                current_group,
            )
            for i, j in candidate_pairs
        ]
        for f in futures:
            res = f.result()
            if res is not None:
                alerts.append(res)

    alerts.sort(key=lambda a: a.risk_score, reverse=True)
    save_conjunction_alerts(alerts, catalog_group=current_group)

    # Store in memory cache
    _SCAN_CACHE[cache_key] = (now, alerts)

    return alerts


# ---------------------------------------------------------------------------
# Satellite Logs & Collective Watchlist Endpoints
# ---------------------------------------------------------------------------

@router.get("/logs/recently-viewed", response_model=List[RecentlyViewedSatellite])
def get_recently_viewed():
    """Return the last 10 recently viewed satellites from the log file."""
    return get_recently_viewed_satellites()


@router.post("/logs/recently-viewed", response_model=List[RecentlyViewedSatellite])
def record_viewed_satellite(payload: RecordViewRequest):
    """Record a satellite as viewed, updating the last-10 log on disk."""
    updated = record_satellite_view(
        norad_id=payload.norad_id,
        name=payload.name,
        altitude_km=payload.altitude_km,
        latitude_deg=payload.latitude_deg,
        longitude_deg=payload.longitude_deg,
        velocity_km_s=payload.velocity_km_s,
        risk_level=payload.risk_level,
        notes=payload.notes,
    )
    return updated


@router.delete("/logs/recently-viewed", response_model=dict)
def clear_recent_views():
    """Clear all entries from the recently viewed log."""
    clear_recently_viewed_log()
    return {"status": "success", "message": "Recently viewed satellites log cleared."}


@router.get("/logs/saved-satellites", response_model=List[SavedSatellite])
@router.get("/logs/saved-tracked", response_model=List[SavedSatellite])
def get_saved_satellites():
    """Return all satellites in the collective save/track log."""
    return get_saved_tracked_satellites()


@router.post("/logs/saved-satellites", response_model=SavedSatellite)
@router.post("/logs/saved-tracked", response_model=SavedSatellite)
def save_satellite(payload: SaveSatelliteRequest):
    """Save or update a satellite in the collective track log."""
    saved = save_tracked_satellite(
        norad_id=payload.norad_id,
        name=payload.name,
        notes=payload.notes,
        tags=payload.tags,
        apogee_km=payload.apogee_km,
        perigee_km=payload.perigee_km,
        inclination_deg=payload.inclination_deg,
        altitude_km=payload.altitude_km,
        latitude_deg=payload.latitude_deg,
        longitude_deg=payload.longitude_deg,
        risk_level=payload.risk_level,
    )
    return saved


@router.delete("/logs/saved-satellites/{norad_id}", response_model=dict)
@router.delete("/logs/saved-tracked/{norad_id}", response_model=dict)
def delete_saved_satellite(
    norad_id: int = Path(..., description="NORAD Catalog Number of the satellite to remove.")
):
    """Remove a satellite from the collective save/track log."""
    removed = remove_saved_tracked_satellite(norad_id)
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"Satellite with NORAD ID {norad_id} was not found in the save log."
        )
    return {
        "status": "success",
        "message": f"Satellite {norad_id} removed from save log."
    }


@router.get("/stats", response_model=dict)
def get_orbital_statistics():
    """Return aggregated situational awareness metrics across catalog and conjunctions."""
    catalog = get_catalog()
    meta = get_catalog_meta()
    alerts = list_recent_conjunction_alerts(limit=500)

    total = len(catalog)
    debris_count = sum(1 for s in catalog if "DEB" in s.name or "R/B" in s.name or s.bstar_drag > 0.0003)
    active_count = total - debris_count

    leo_count = sum(1 for s in catalog if ((s.apogee_km + s.perigee_km) / 2) < 2000)
    meo_count = sum(1 for s in catalog if 2000 <= ((s.apogee_km + s.perigee_km) / 2) < 35000)
    geo_count = sum(1 for s in catalog if ((s.apogee_km + s.perigee_km) / 2) >= 35000)

    critical_count = sum(1 for a in alerts if (a.risk_level or '').upper() == "CRITICAL")
    high_count = sum(1 for a in alerts if (a.risk_level or '').upper() == "HIGH")
    medium_count = sum(1 for a in alerts if (a.risk_level or '').upper() in ("MEDIUM", "MODERATE"))

    return {
        "total_monitored": total,
        "active_satellites": active_count,
        "tracked_debris": debris_count,
        "conjunctions_screened": len(alerts),
        "critical_conjunctions": critical_count,
        "high_risk_conjunctions": high_count,
        "medium_risk_conjunctions": medium_count,
        "regimes": {
            "LEO": leo_count,
            "MEO": meo_count,
            "GEO": geo_count,
        },
        "catalog_group": meta.get("group", "active"),
        "last_updated_utc": meta.get("last_updated_utc"),
    }


@router.get("/logs/download/{log_type}")
def download_log_file(
    log_type: str = Path(..., description="Log type: 'recently_viewed' or 'saved_satellites'"),
    format: str = Query("json", description="File format: 'json' or 'log'"),
):
    """Download the specified satellite log file (JSON or formatted .log)."""
    file_path = get_log_file_path(log_type, format=format)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Log file for '{log_type}' ({format}) not found or not yet generated."
        )

    media_type = "application/json" if format == "json" else "text/plain"
    filename = f"{log_type}.{format}"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename,
    )


