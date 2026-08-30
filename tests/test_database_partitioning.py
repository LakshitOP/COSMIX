"""Unit and integration tests for database relational decomposition & category partitioning.

Verifies:
1. Database schema initialization across all relational models.
2. Category-based partition isolation for satellites (e.g. starlink, stations, active, debris).
3. Conjunction alert persistence and category-filtered partition queries.
4. Relational saved satellites and recently viewed tables synchronization.
"""

import os
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

# Path setup
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND_ROOT = os.path.join(_PROJECT_ROOT, "backend")
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import app.database as database
from app.database import Base, SessionLocal, get_engine, initialize_database
from app.models.conjunction import Conjunction
from app.models.satellite import RecentlyViewedRecord, Satellite, SavedSatelliteRecord
from app.models.schemas import ConjunctionAlert, SatelliteRecord
from app.services.conjunction_repository import (
    list_recent_conjunction_alerts,
    save_conjunction_alerts,
)
from app.services.satellite_repository import (
    get_satellite_by_norad_id,
    get_satellites_by_group,
    upsert_satellites_for_group,
)


class DatabasePartitioningTest(unittest.TestCase):

    def setUp(self):
        # Create an isolated temporary SQLite database for tests
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_space_debris.db"
        self.db_url = f"sqlite:///{self.db_path}"

        # Reset engine and configure test DB URL
        database._engine = None
        self.url_patcher = patch.object(database, "DATABASE_URL", self.db_url)
        self.url_patcher.start()

        # Initialize schema
        initialize_database()

    def tearDown(self):
        if database._engine is not None:
            database._engine.dispose()
        database._engine = None
        self.url_patcher.stop()
        self.temp_dir.cleanup()

    def test_schema_creates_all_relational_tables(self):
        """Ensure all relational and tracking tables are created."""
        from sqlalchemy import inspect
        engine = get_engine()
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        self.assertIn("satellites", tables)
        self.assertIn("conjunctions", tables)
        self.assertIn("saved_satellites", tables)
        self.assertIn("recently_viewed_satellites", tables)

    def test_category_partitioned_satellite_isolation(self):
        """Satellites stored in different category partitions must be isolated."""
        starlink_sats = [
            SatelliteRecord(
                norad_id=50001,
                name="STARLINK-1001",
                line1="1 50001U 20001A   26050.00000000  .00001000  00000-0  10000-4 0  9991",
                line2="2 50001  53.0500 100.0000 0001000  50.0000 310.0000 15.05000000 1001",
                apogee_km=550.0,
                perigee_km=545.0,
                inclination_deg=53.05,
                bstar_drag=0.0001,
            ),
            SatelliteRecord(
                norad_id=50002,
                name="STARLINK-1002",
                line1="1 50002U 20001B   26050.00000000  .00001000  00000-0  10000-4 0  9992",
                line2="2 50002  53.0500 105.0000 0001000  50.0000 310.0000 15.05000000 1002",
                apogee_km=552.0,
                perigee_km=547.0,
                inclination_deg=53.05,
                bstar_drag=0.0001,
            ),
        ]

        stations_sats = [
            SatelliteRecord(
                norad_id=25544,
                name="ISS (ZARYA)",
                line1="1 25544U 98067A   26050.00000000  .00010000  00000-0  15000-4 0  9993",
                line2="2 25544  51.6400 120.0000 0002000  60.0000 300.0000 15.49000000 1003",
                apogee_km=420.0,
                perigee_km=415.0,
                inclination_deg=51.64,
                bstar_drag=0.00015,
            )
        ]

        # Upsert into distinct category partitions
        n_starlink = upsert_satellites_for_group("starlink", starlink_sats)
        n_stations = upsert_satellites_for_group("stations", stations_sats)

        self.assertEqual(n_starlink, 2)
        self.assertEqual(n_stations, 1)

        # Query partitions individually
        fetched_starlink = get_satellites_by_group("starlink")
        fetched_stations = get_satellites_by_group("stations")

        self.assertEqual(len(fetched_starlink), 2)
        self.assertEqual(len(fetched_stations), 1)

        self.assertEqual(fetched_starlink[0].norad_id, 50001)
        self.assertEqual(fetched_stations[0].norad_id, 25544)

    def test_single_satellite_norad_lookup(self):
        """Single NORAD primary key query returns matching record."""
        sat = SatelliteRecord(
            norad_id=25544,
            name="ISS (ZARYA)",
            line1="1 25544U 98067A   26050.00000000  .00010000  00000-0  15000-4 0  9993",
            line2="2 25544  51.6400 120.0000 0002000  60.0000 300.0000 15.49000000 1003",
            apogee_km=420.0,
            perigee_km=415.0,
            inclination_deg=51.64,
            bstar_drag=0.00015,
        )
        upsert_satellites_for_group("stations", [sat])

        record = get_satellite_by_norad_id(25544)
        self.assertIsNotNone(record)
        self.assertEqual(record.name, "ISS (ZARYA)")

        # Non-existent
        self.assertIsNone(get_satellite_by_norad_id(99999))

    def test_conjunction_alerts_category_partition_filtering(self):
        """Conjunction alerts can be queried specifically by catalog_group."""
        now = datetime.now(timezone.utc)
        alerts_active = [
            ConjunctionAlert(
                id=str(uuid.uuid4()),
                catalog_group="active",
                sat1_id=1001,
                sat1_name="ACTIVE-1",
                sat2_id=1002,
                sat2_name="ACTIVE-2",
                tca_utc=now,
                miss_distance_km=1.2,
                relative_velocity_km_s=14.5,
                risk_score=0.85,
                risk_level="CRITICAL",
            )
        ]
        alerts_debris = [
            ConjunctionAlert(
                id=str(uuid.uuid4()),
                catalog_group="fengyun-1c-debris",
                sat1_id=3001,
                sat1_name="DEBRIS-1",
                sat2_id=3002,
                sat2_name="DEBRIS-2",
                tca_utc=now,
                miss_distance_km=3.5,
                relative_velocity_km_s=11.2,
                risk_score=0.45,
                risk_level="MEDIUM",
            )
        ]

        save_conjunction_alerts(alerts_active, catalog_group="active")
        save_conjunction_alerts(alerts_debris, catalog_group="fengyun-1c-debris")

        # Query all
        all_alerts = list_recent_conjunction_alerts(10)
        self.assertEqual(len(all_alerts), 2)

        # Query filtered by category partition
        active_only = list_recent_conjunction_alerts(10, catalog_group="active")
        self.assertEqual(len(active_only), 1)
        self.assertEqual(active_only[0].sat1_name, "ACTIVE-1")

        debris_only = list_recent_conjunction_alerts(10, catalog_group="fengyun-1c-debris")
        self.assertEqual(len(debris_only), 1)
        self.assertEqual(debris_only[0].sat1_name, "DEBRIS-1")

    def test_initialize_database_falls_back_to_sqlite_when_postgres_is_unreachable(self):
        """Startup should continue with a local SQLite database if the configured Postgres DB is unavailable."""
        original_url = database.DATABASE_URL
        original_engine = database._engine

        try:
            database._engine = None
            database.DATABASE_URL = "postgresql://invalid-host.invalid:5432/space_debris"
            initialize_database()
            self.assertTrue(database.DATABASE_URL.startswith("sqlite"))
            self.assertIsNotNone(get_engine())
        finally:
            database._engine = original_engine
            database.DATABASE_URL = original_url


if __name__ == "__main__":
    unittest.main()
