"""Unit tests for the satellite log service and API endpoints.

Tests:
1. Recently viewed satellites log (max 10 entries, FIFO/MRU behavior, persistence).
2. Saved tracked satellites log (add, update, delete, persistence).
3. Text .log file and JSON formatting.
4. FastAPI route responses for logs.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Path setup
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_BACKEND_ROOT = os.path.join(_PROJECT_ROOT, "backend")
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import app.services.log_service as log_service
from app.api.routes import (
    clear_recent_views,
    delete_saved_satellite,
    get_recently_viewed,
    get_saved_satellites,
    record_viewed_satellite,
    save_satellite,
)
from app.models.schemas import RecordViewRequest, SaveSatelliteRequest


class SatelliteLogServiceTest(unittest.TestCase):

    def setUp(self):
        # Create a temporary directory for test log files
        self.test_dir = tempfile.TemporaryDirectory()
        self.logs_dir = Path(self.test_dir.name)

        # Patch module log paths to use the temp directory
        self.patchers = [
            patch.object(log_service, "_LOGS_DIR", self.logs_dir),
            patch.object(log_service, "_RECENTLY_VIEWED_JSON", self.logs_dir / "recently_viewed_satellites.json"),
            patch.object(log_service, "_RECENTLY_VIEWED_LOG", self.logs_dir / "recently_viewed_satellites.log"),
            patch.object(log_service, "_SAVED_SATELLITES_JSON", self.logs_dir / "saved_tracked_satellites.json"),
            patch.object(log_service, "_SAVED_SATELLITES_LOG", self.logs_dir / "saved_tracked_satellites.log"),
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in self.patchers:
            p.stop()
        self.test_dir.cleanup()

    def test_recently_viewed_empty_initially(self):
        """Recently viewed list should be empty on clean state."""
        entries = log_service.get_recently_viewed_satellites()
        self.assertEqual(entries, [])

    def test_recently_viewed_max_10_and_mru_order(self):
        """Recently viewed should cap at 10 items and maintain MRU order."""
        for i in range(15):
            log_service.record_satellite_view(
                norad_id=1000 + i,
                name=f"SAT_{i}",
                altitude_km=400.0 + i,
                latitude_deg=10.0,
                longitude_deg=20.0,
            )

        entries = log_service.get_recently_viewed_satellites()
        self.assertEqual(len(entries), 10)
        # Most recently added should be at index 0 (SAT_14)
        self.assertEqual(entries[0]["norad_id"], 1014)
        self.assertEqual(entries[0]["name"], "SAT_14")
        # Oldest in the 10-item window should be SAT_5 (norad 1005)
        self.assertEqual(entries[-1]["norad_id"], 1005)

        # Re-viewing SAT_7 should bump it to index 0
        log_service.record_satellite_view(norad_id=1007, name="SAT_7", altitude_km=407.0)
        updated = log_service.get_recently_viewed_satellites()
        self.assertEqual(len(updated), 10)
        self.assertEqual(updated[0]["norad_id"], 1007)

    def test_recently_viewed_writes_both_json_and_log_files(self):
        """Ensure both .json and .log files are written and readable."""
        log_service.record_satellite_view(
            norad_id=25544,
            name="ISS (ZARYA)",
            altitude_km=420.5,
            latitude_deg=51.6,
            longitude_deg=-0.12,
            velocity_km_s=7.66,
            risk_level="LOW",
        )

        json_file = self.logs_dir / "recently_viewed_satellites.json"
        log_file = self.logs_dir / "recently_viewed_satellites.log"

        self.assertTrue(json_file.exists())
        self.assertTrue(log_file.exists())

        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["norad_id"], 25544)

        with open(log_file, "r", encoding="utf-8") as f:
            text = f.read()
            self.assertIn("RECENTLY VIEWED SATELLITES LOG", text)
            self.assertIn("ISS (ZARYA)", text)
            self.assertIn("25544", text)

    def test_clear_recently_viewed(self):
        """Clearing the recently viewed log empties the file."""
        log_service.record_satellite_view(norad_id=25544, name="ISS (ZARYA)")
        self.assertEqual(len(log_service.get_recently_viewed_satellites()), 1)

        log_service.clear_recently_viewed_log()
        self.assertEqual(log_service.get_recently_viewed_satellites(), [])

    def test_saved_tracked_satellites_crud(self):
        """Test adding, updating, and removing from collective saved track log."""
        # Add satellite 1
        saved1 = log_service.save_tracked_satellite(
            norad_id=25544,
            name="ISS (ZARYA)",
            notes="Primary human spaceflight station",
            tags=["station", "priority"],
            altitude_km=420.0,
            risk_level="LOW",
        )
        self.assertEqual(saved1["norad_id"], 25544)
        self.assertEqual(saved1["notes"], "Primary human spaceflight station")

        # Add satellite 2
        log_service.save_tracked_satellite(
            norad_id=48274,
            name="TIANGONG",
            notes="CSS Core Module",
            tags=["station"],
            altitude_km=390.0,
        )

        tracked = log_service.get_saved_tracked_satellites()
        self.assertEqual(len(tracked), 2)

        # Update notes for satellite 1
        log_service.save_tracked_satellite(
            norad_id=25544,
            name="ISS (ZARYA)",
            notes="Updated monitoring notes",
        )
        updated_tracked = log_service.get_saved_tracked_satellites()
        iss_entry = next(e for e in updated_tracked if e["norad_id"] == 25544)
        self.assertEqual(iss_entry["notes"], "Updated monitoring notes")

        # Delete satellite 2
        removed = log_service.remove_saved_tracked_satellite(48274)
        self.assertTrue(removed)
        self.assertEqual(len(log_service.get_saved_tracked_satellites()), 1)

        # Delete non-existent returns False
        self.assertFalse(log_service.remove_saved_tracked_satellite(99999))

    def test_saved_satellites_file_persistence(self):
        """Test that saved satellites generate valid JSON and .log files."""
        log_service.save_tracked_satellite(
            norad_id=25544,
            name="ISS (ZARYA)",
            notes="Monitoring conjunction risk",
            altitude_km=415.2,
            risk_level="HIGH",
        )

        json_file = self.logs_dir / "saved_tracked_satellites.json"
        log_file = self.logs_dir / "saved_tracked_satellites.log"

        self.assertTrue(json_file.exists())
        self.assertTrue(log_file.exists())

        with open(log_file, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("COLLECTIVE SAVED SATELLITES TRACK LOG", content)
            self.assertIn("ISS (ZARYA)", content)
            self.assertIn("HIGH", content)

    def test_api_route_handlers(self):
        """Test direct invocation of API route handler functions."""
        # Record view via API
        req = RecordViewRequest(
            norad_id=33591,
            name="NOAA 19",
            altitude_km=850.0,
            latitude_deg=-15.2,
            longitude_deg=45.6,
        )
        views = record_viewed_satellite(req)
        self.assertEqual(len(views), 1)
        self.assertEqual(views[0]["norad_id"], 33591)

        # Get recent views
        fetched_views = get_recently_viewed()
        self.assertEqual(len(fetched_views), 1)

        # Clear views
        clear_res = clear_recent_views()
        self.assertEqual(clear_res["status"], "success")
        self.assertEqual(len(get_recently_viewed()), 0)

        # Save satellite via API
        save_req = SaveSatelliteRequest(
            norad_id=33591,
            name="NOAA 19",
            notes="Weather satellite tracking",
        )
        saved = save_satellite(save_req)
        self.assertEqual(saved["norad_id"], 33591)
        self.assertEqual(saved["notes"], "Weather satellite tracking")

        saved_list = get_saved_satellites()
        self.assertEqual(len(saved_list), 1)

        # Delete saved satellite
        del_res = delete_saved_satellite(33591)
        self.assertEqual(del_res["status"], "success")
        self.assertEqual(len(get_saved_satellites()), 0)


if __name__ == "__main__":
    unittest.main()
