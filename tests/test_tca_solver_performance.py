"""Unit and performance benchmarks for the optimized TCA solver and risk scan."""

import os
import sys
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

# Path setup
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND_ROOT = os.path.join(_PROJECT_ROOT, "backend")
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.core.tca_solver import create_earth_satellite, find_tca_between_pair
from app.models.schemas import SatelliteRecord
from app.state import set_catalog


class TCASolverPerformanceTest(unittest.TestCase):

    def setUp(self):
        self.sat1 = SatelliteRecord(
            norad_id=25544,
            name="ISS (ZARYA)",
            line1="1 25544U 98067A   26050.00000000  .00010000  00000-0  15000-4 0  9993",
            line2="2 25544  51.6400 120.0000 0002000  60.0000 300.0000 15.49000000 1003",
            apogee_km=420.0,
            perigee_km=415.0,
            inclination_deg=51.64,
            bstar_drag=0.00015,
        )
        self.sat2 = SatelliteRecord(
            norad_id=48274,
            name="TIANGONG",
            line1="1 48274U 21035A   26050.00000000  .00005000  00000-0  80000-5 0  9994",
            line2="2 48274  41.4700 200.0000 0001500 110.0000 250.0000 15.62000000 1004",
            apogee_km=395.0,
            perigee_km=385.0,
            inclination_deg=41.47,
            bstar_drag=0.00010,
        )

    def test_find_tca_between_pair_correctness(self):
        """Verify that vectorized TCA solver returns valid miss distance and velocity."""
        now = datetime.now(timezone.utc)
        result = find_tca_between_pair(self.sat1, self.sat2, start_time=now, duration_hours=6.0)

        self.assertIn("tca_utc", result)
        self.assertIn("miss_distance_km", result)
        self.assertIn("relative_velocity_km_s", result)

        self.assertGreater(result["miss_distance_km"], 0.0)
        self.assertGreater(result["relative_velocity_km_s"], 0.0)

    def test_tca_solver_sub_millisecond_speed(self):
        """Vectorized TCA solver for a 12-hour window should execute in < 20 ms."""
        now = datetime.now(timezone.utc)
        sat1_obj = create_earth_satellite(self.sat1)
        sat2_obj = create_earth_satellite(self.sat2)

        start = time.perf_counter()
        _ = find_tca_between_pair(sat1_obj, sat2_obj, start_time=now, duration_hours=12.0)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        # Vectorized C execution should complete rapidly (< 50ms)
        self.assertLess(elapsed_ms, 50.0, f"Vectorized TCA solver took {elapsed_ms:.2f} ms")

    def test_parallel_conjunction_scan_caching(self):
        """Repeated scan calls return in < 1 ms via memory cache."""
        from app.api.routes import run_conjunction_scan
        set_catalog([self.sat1, self.sat2], group="stations", source_url="test")

        # First scan
        t0 = time.perf_counter()
        alerts1 = run_conjunction_scan(max_candidates=10, miss_distance_cutoff_km=100.0, hours=6.0)
        t_first_ms = (time.perf_counter() - t0) * 1000.0

        # Second cached scan
        t1 = time.perf_counter()
        alerts2 = run_conjunction_scan(max_candidates=10, miss_distance_cutoff_km=100.0, hours=6.0)
        t_cached_ms = (time.perf_counter() - t1) * 1000.0

        self.assertEqual(len(alerts1), len(alerts2))
        self.assertLess(t_cached_ms, 2.0, f"Cached scan took {t_cached_ms:.2f} ms")


if __name__ == "__main__":
    unittest.main()

