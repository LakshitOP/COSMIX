"""Real CelesTrak 2LE/TLE Conjunction Dataset Generator.

Pulls real orbital elements from CelesTrak for active satellites and tracked
debris clouds (Fengyun-1C, Cosmos-2251, Iridium-33, Analyst, Visual, Stations).

Propagates real orbits using SGP4 and the TCA solver to extract authentic
conjunction metrics:
  - Real Miss Distances (km)
  - Real Relative Velocities (km/s)
  - True Atmospheric Drag Terms (BSTAR from TLEs)
  - Astrodynamic Risk Scores computed from actual encounter physics

Saves to ``ml_pipeline/datasets/synthetic_cdms.csv`` for ML model training.
"""

from __future__ import annotations

import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd
import requests

# Add backend to sys.path so we can reuse our validated SGP4 engine & parser
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.filters import filter_apogee_perigee
from app.core.tca_solver import find_tca_between_pair
from app.data.parser import parse_tle_catalog
from app.models.schemas import SatelliteRecord
from app.services.risk_scorer import calculate_conjunction_risk

CELESTRAK_GROUPS = [
    ("stations", "tle"),
    ("visual", "2le"),
    ("analyst", "2le"),
    ("fengyun-1c-debris", "2le"),
    ("cosmos-2251-debris", "2le"),
    ("iridium-33-debris", "2le"),
]

CACHE_DIR = Path(__file__).resolve().parents[1] / "datasets" / "raw_tles"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/plain, */*; q=0.01",
}


def fetch_or_load_group(group: str, fmt: str) -> List[SatelliteRecord]:
    """Fetch 2LE/TLE data from CelesTrak with disk caching."""
    cache_file = CACHE_DIR / f"{group}_{fmt}.txt"
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT={fmt}"

    # Try downloading fresh data
    try:
        print(f"[CelesTrak] Fetching {group} ({fmt})...")
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code == 200 and r.text.strip() and "No GP data found" not in r.text:
            cache_file.write_text(r.text.strip(), encoding="utf-8")
            records = parse_tle_catalog(r.text.strip())
            if records:
                print(f"  ✓ Fetched {len(records)} records from CelesTrak.")
                return records
    except Exception as e:
        print(f"  ⚠ Network notice for {group}: {e}")

    # Fallback to cache if available
    if cache_file.exists():
        text = cache_file.read_text(encoding="utf-8")
        records = parse_tle_catalog(text)
        if records:
            print(f"  ✓ Loaded {len(records)} records from local cache.")
            return records

    return []


def generate_real_cdms(target_samples: int = 5000) -> pd.DataFrame:
    """Generate conjunction training data from real CelesTrak 2LE/TLE datasets."""
    print("=" * 60)
    print("  GENERATING CDMs FROM REAL CELESTRAK 2LE/TLE DATASETS")
    print("=" * 60)

    # 1. Load active payloads and space stations
    active_records: List[SatelliteRecord] = []
    for g, fmt in [("stations", "tle"), ("visual", "2le"), ("analyst", "2le")]:
        active_records.extend(fetch_or_load_group(g, fmt))

    # 2. Load tracked real debris clouds (Fengyun-1C, Cosmos-2251, Iridium-33)
    debris_records: List[SatelliteRecord] = []
    for g, fmt in [("fengyun-1c-debris", "2le"), ("cosmos-2251-debris", "2le"), ("iridium-33-debris", "2le")]:
        debris_records.extend(fetch_or_load_group(g, fmt))

    print(f"\nLoaded {len(active_records)} active/payload objects and {len(debris_records)} real debris fragments.")

    now = datetime.now(timezone.utc)
    cdm_rows = []

    # Combined catalog
    all_objects = active_records + debris_records
    if not all_objects:
        raise RuntimeError("Could not load any CelesTrak 2LE datasets.")

    print("\nRunning Apogee-Perigee spatial filtering across real orbits...")
    candidate_pairs = filter_apogee_perigee(all_objects, altitude_buffer_km=50.0)
    print(f"Found {len(candidate_pairs)} candidate overlapping orbital pairs.")

    print("\nPropagating real SGP4 orbital encounters and computing TCA...")
    count = 0
    for i, j in candidate_pairs:
        if count >= target_samples:
            break

        sat1 = all_objects[i]
        sat2 = all_objects[j]

        # Ignore identical objects or docked modules (miss distance < 0.5 km)
        if sat1.norad_id == sat2.norad_id:
            continue

        try:
            conjunction = find_tca_between_pair(sat1, sat2, start_time=now, duration_hours=24.0)
            miss_km = float(conjunction["miss_distance_km"])
            rel_vel = float(conjunction["relative_velocity_km_s"])

            if miss_km < 0.5:
                continue

            # Compute actual risk score using orbital encounter physics
            risk_score, _ = calculate_conjunction_risk(
                miss_distance_km=miss_km,
                rel_velocity_km_s=rel_vel,
                bstar1=sat1.bstar_drag,
                bstar2=sat2.bstar_drag,
            )

            cdm_rows.append({
                "sat1_id": sat1.norad_id,
                "sat1_name": sat1.name,
                "sat2_id": sat2.norad_id,
                "sat2_name": sat2.name,
                "miss_distance_km": round(miss_km, 4),
                "relative_velocity_km_s": round(rel_vel, 4),
                "bstar_1": sat1.bstar_drag,
                "bstar_2": sat2.bstar_drag,
                "target_risk_score": risk_score,
            })
            count += 1
            if count % 250 == 0:
                print(f"  Processed {count}/{min(target_samples, len(candidate_pairs))} real conjunction pairs...")

        except Exception:
            continue

    df = pd.DataFrame(cdm_rows)
    print(f"\n✓ Extracted {len(df)} authentic conjunction encounters from real CelesTrak orbits.")

    # Save to datasets directory
    out_dir = PROJECT_ROOT / "ml_pipeline" / "datasets"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "synthetic_cdms.csv"
    real_out_path = out_dir / "real_cdms.csv"

    df.to_csv(out_path, index=False)
    df.to_csv(real_out_path, index=False)
    print(f"Saved real CDM training dataset to: {out_path}")
    return df


if __name__ == "__main__":
    generate_real_cdms(target_samples=1500)
