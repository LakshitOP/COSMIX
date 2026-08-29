"""High-performance Time of Closest Approach (TCA) solver.

Features:
1. Vectorized SGP4 coarse sweep (evaluates thousands of timestamps in a single C call).
2. EarthSatellite object caching / reuse (avoids re-parsing TLE strings per pair).
3. Bounded Brent's numerical minimization on candidate encounters for sub-millisecond precision.
4. Early-pruning guard on coarse separation.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import numpy as np
from scipy.optimize import minimize_scalar
from skyfield.api import EarthSatellite, load

from app.models.schemas import SatelliteRecord

ts = load.timescale()


def create_earth_satellite(sat_record: SatelliteRecord) -> EarthSatellite:
    """Instantiate a Skyfield EarthSatellite object from a SatelliteRecord."""
    return EarthSatellite(sat_record.line1, sat_record.line2, sat_record.name, ts)


def find_tca_between_pair(
    sat1: Union[SatelliteRecord, EarthSatellite],
    sat2: Union[SatelliteRecord, EarthSatellite],
    start_time: datetime,
    duration_hours: float = 12.0,
    coarse_step_seconds: float = 30.0,
    cutoff_km: Optional[float] = None,
) -> Dict[str, Any]:
    """Find the exact Time of Closest Approach (TCA), minimum miss distance,

    and relative velocity using vectorized coarse sweep and bounded Brent's optimization.
    """
    start_time = start_time.replace(tzinfo=timezone.utc)

    # 1. Reuse existing EarthSatellite object or create if SatelliteRecord passed
    sat1_obj = sat1 if isinstance(sat1, EarthSatellite) else create_earth_satellite(sat1)
    sat2_obj = sat2 if isinstance(sat2, EarthSatellite) else create_earth_satellite(sat2)

    total_seconds = duration_hours * 3600.0
    n_steps = max(2, int(total_seconds / coarse_step_seconds) + 1)

    # 2. Stage A: Vectorized Coarse Sweep across the entire duration (Single C call)
    start_tt = ts.from_datetime(start_time).tt
    step_days = coarse_step_seconds / 86400.0
    tt_offsets = np.arange(n_steps, dtype=np.float64) * step_days
    t_array = ts.tt_jd(start_tt + tt_offsets)

    pos1 = sat1_obj.at(t_array).position.km  # Shape: (3, n_steps)
    pos2 = sat2_obj.at(t_array).position.km  # Shape: (3, n_steps)

    diff = pos1 - pos2
    distances = np.linalg.norm(diff, axis=0)  # Shape: (n_steps,)

    min_idx = int(np.argmin(distances))
    coarse_min_dist = float(distances[min_idx])
    best_coarse_t = float(min_idx * coarse_step_seconds)

    # Early exit if even coarse distance is far beyond cutoff (e.g. > 2x cutoff)
    if cutoff_km is not None and coarse_min_dist > (cutoff_km * 2.0):
        tca_utc = start_time + timedelta(seconds=best_coarse_t)
        return {
            "tca_utc": tca_utc,
            "miss_distance_km": coarse_min_dist,
            "relative_velocity_km_s": 0.0,
        }

    # 3. Stage B: Fine Search using Brent's Method around the coarse minimum
    def separation_distance_km(t_seconds_offset: float) -> float:
        current_dt = start_time + timedelta(seconds=t_seconds_offset)
        t = ts.from_datetime(current_dt)
        p1 = sat1_obj.at(t).position.km
        p2 = sat2_obj.at(t).position.km
        d = p1 - p2
        return float(np.sqrt(np.dot(d, d)))

    bracket_min = max(0.0, best_coarse_t - coarse_step_seconds)
    bracket_max = min(total_seconds, best_coarse_t + coarse_step_seconds)

    res = minimize_scalar(
        separation_distance_km,
        bounds=(bracket_min, bracket_max),
        method="bounded",
        options={"xatol": 1e-4},  # Accurate to within 0.1 ms
    )

    tca_seconds = float(res.x)
    exact_miss_distance = float(res.fun)
    tca_utc = start_time + timedelta(seconds=tca_seconds)

    # 4. Compute Relative Velocity at exact TCA instant
    tca_ts = ts.from_datetime(tca_utc)
    vel1 = sat1_obj.at(tca_ts).velocity.km_per_s
    vel2 = sat2_obj.at(tca_ts).velocity.km_per_s
    v_diff = vel1 - vel2
    relative_velocity = float(np.sqrt(np.dot(v_diff, v_diff)))

    return {
        "tca_utc": tca_utc,
        "miss_distance_km": exact_miss_distance,
        "relative_velocity_km_s": relative_velocity,
    }