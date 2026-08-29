"""SGP4 orbital propagation engine powered by Skyfield.

Public functions
----------------
propagate_satellite_state(sat_record, dt_utc)
    Compute ECI + geodetic state at a single instant.

propagate_orbit_track(sat_record, start_dt, duration_hours, step_minutes)
    Compute a ground-track (lat/lon/alt array) using vectorised SGP4 — many
    times faster than looping because Skyfield evaluates the full time array
    in one C-level call, avoiding repeated Python-level overhead.
"""

from __future__ import annotations

import numpy as np
from datetime import datetime, timedelta, timezone
from typing import List

from skyfield.api import EarthSatellite, load, wgs84

from app.models.schemas import SatelliteRecord, TrackPoint

# Load the timescale once per process — its constructor hits the filesystem.
ts = load.timescale()

# Pre-instantiated EarthSatellite cache to avoid expensive string parsing every second
_SATELLITE_OBJ_CACHE: dict[int, EarthSatellite] = {}


def get_or_create_satellite_obj(sat_record: SatelliteRecord) -> EarthSatellite:
    """Return cached EarthSatellite or create and cache it."""
    sat_id = sat_record.norad_id
    if sat_id not in _SATELLITE_OBJ_CACHE:
        _SATELLITE_OBJ_CACHE[sat_id] = EarthSatellite(
            sat_record.line1, sat_record.line2, sat_record.name, ts
        )
    return _SATELLITE_OBJ_CACHE[sat_id]


def clear_satellite_obj_cache() -> None:
    """Clear satellite cache when catalog changes."""
    _SATELLITE_OBJ_CACHE.clear()


# ---------------------------------------------------------------------------
# Single-instant state (CPU-Optimized with Object Cache)
# ---------------------------------------------------------------------------

def propagate_satellite_state(sat_record: SatelliteRecord, dt_utc: datetime) -> dict:
    """Return ECI + geodetic state of *sat_record* at *dt_utc* with cached EarthSatellite."""
    t = ts.from_datetime(dt_utc.replace(tzinfo=timezone.utc))
    sat = get_or_create_satellite_obj(sat_record)

    geocentric = sat.at(t)
    geodetic = wgs84.subpoint_of(geocentric)

    return {
        "pos_eci_km":    geocentric.position.km,
        "vel_eci_km_s":  geocentric.velocity.km_per_s,
        "latitude_deg":  geodetic.latitude.degrees,
        "longitude_deg": geodetic.longitude.degrees,
        # subpoint.elevation.km is the surface height (0); use height_of() for altitude.
        "altitude_km":   float(wgs84.height_of(geocentric).km),
    }


# ---------------------------------------------------------------------------
# Vectorised ground-track
# ---------------------------------------------------------------------------

def propagate_orbit_track(
    sat_record: SatelliteRecord,
    start_dt: datetime,
    duration_hours: float = 3.0,
    step_minutes: float = 2.0,
) -> List[TrackPoint]:
    """Propagate *sat_record* over time and return a ground-track series.

    Uses Skyfield's vectorised ``at()`` call (one C-level SGP4 run for the
    full time array) instead of looping, making it ≈10–100× faster than
    calling ``propagate_satellite_state`` in a loop.

    Args:
        sat_record:      Satellite to propagate.
        start_dt:        UTC start time of the track.
        duration_hours:  How many hours ahead to propagate.
        step_minutes:    Time step between track points (minutes).

    Returns:
        List of ``TrackPoint`` (t, lat, lon, alt_km), one per step.
    """
    start_dt = start_dt.replace(tzinfo=timezone.utc)
    sat = EarthSatellite(sat_record.line1, sat_record.line2, sat_record.name, ts)

    n_steps = max(2, int(duration_hours * 60.0 / step_minutes) + 1)

    # Build a vectorised Skyfield Time array via Julian-date offsets.
    # This is the key optimisation: sat.at(t_array) evaluates SGP4 for
    # all time steps in a single vectorised C call.
    start_tt = ts.from_datetime(start_dt).tt          # Terrestrial Time (Julian date)
    step_days = step_minutes / (24.0 * 60.0)
    tt_offsets = np.arange(n_steps, dtype=np.float64) * step_days
    t_array = ts.tt_jd(start_tt + tt_offsets)

    geocentric = sat.at(t_array)
    subpoints = wgs84.subpoint_of(geocentric)

    # subpoints.elevation.km is the *surface subpoint's* elevation (always 0).
    # wgs84.height_of() returns the satellite's WGS-84 altitude — vectorised.
    lats: np.ndarray = np.atleast_1d(subpoints.latitude.degrees)
    lons: np.ndarray = np.atleast_1d(subpoints.longitude.degrees)
    alts: np.ndarray = np.atleast_1d(wgs84.height_of(geocentric).km)

    track: List[TrackPoint] = []
    actual_steps = len(lats)   # authoritative length
    for i in range(actual_steps):
        dt_i = start_dt + timedelta(minutes=i * step_minutes)
        track.append(
            TrackPoint(
                t=dt_i,
                lat=round(float(lats[i]), 5),
                lon=round(float(lons[i]), 5),
                alt_km=round(float(alts[i]), 3),
            )
        )

    return track