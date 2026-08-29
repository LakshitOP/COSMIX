"""CelesTrak real-time TLE and 2LE catalog fetcher with 24-hour disk caching and rate-limiting.

Complies strictly with CelesTrak's automated request policies:
1. Cache Your Responses: 24-hour disk caching (86,400s TTL) to prevent repeated fetches.
2. Pace Your Requests: Enforces minimum 1.05s intervals (< 1 req/sec) between CelesTrak calls.
3. Lightweight GP API: Strictly uses https://celestrak.org/NORAD/elements/gp.php (no web UI scraping).
4. SGP4 Propagation: Stores orbital elements locally and propagates positions forward via SGP4.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import requests

from app.data.parser import parse_tle_catalog
from app.models.schemas import SatelliteRecord

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------

CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"

# Local cache directory to abide by CelesTrak 24-hour cache policy
CACHE_DIR = Path(__file__).resolve().parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 24-hour cache TTL in seconds (86,400s)
CACHE_TTL_SECONDS = 86400

# Global Rate Limiter: Pace requests to CelesTrak at >= 1.05s between queries (< 1 req/sec)
_LAST_REQUEST_TIME = 0.0
_RATE_LIMIT_LOCK = threading.Lock()

def _throttle_celestrak_request(min_interval: float = 1.05) -> None:
    """Enforce CelesTrak rate-limiting policy of < 1 request per second."""
    global _LAST_REQUEST_TIME
    with _RATE_LIMIT_LOCK:
        now = time.time()
        elapsed = now - _LAST_REQUEST_TIME
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        _LAST_REQUEST_TIME = time.time()

# Human-readable labels and preferred format for all officially supported CelesTrak groups.
SUPPORTED_GROUPS: dict[str, str] = {
    "last-30-days":       "Launches from Last 30 Days (2LE)",
    "stations":           "Crewed Space Stations (2LE)",
    "visual":             "Visual / Bright Satellites (2LE)",
    "active":             "Active Operational Satellites (2LE)",
    "fengyun-1c-debris":  "Fengyun-1C ASAT Debris Cloud (2LE)",
    "iridium-33-debris":  "Iridium-33 Collision Debris (2LE)",
    "cosmos-2251-debris": "Cosmos-2251 Collision Debris (2LE)",
    "analyst":            "Analyst-Tracked Elements (2LE)",
    "starlink":           "SpaceX Starlink Constellation (2LE)",
    "oneweb":             "OneWeb Constellation (2LE)",
    "debris":             "Tracked Space Debris (2LE)",
    "gps-ops":            "GPS Operational Satellites (2LE)",
    "galileo":            "Galileo Navigation Constellation (2LE)",
}

DEFAULT_FORMATS: dict[str, str] = {
    "last-30-days": "2le",
    "stations": "2le",
    "visual": "2le",
    "active": "2le",
    "fengyun-1c-debris": "2le",
    "iridium-33-debris": "2le",
    "cosmos-2251-debris": "2le",
    "analyst": "2le",
    "starlink": "2le",
}

# Polite, compliant User-Agent identification
_HEADERS = {
    "User-Agent": (
        "COSMIX-Orbital-Monitor/1.0 (+https://github.com/LakshitOP/COSMIX; SGP4 Orbital Propagation Engine)"
    ),
    "Accept": "text/plain, application/json, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://celestrak.org/",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_celestrak_url(group: str, fmt: Optional[str] = None) -> str:
    """Return the canonical CelesTrak URL for a given group and format."""
    format_type = fmt or DEFAULT_FORMATS.get(group, "2le")
    return f"{CELESTRAK_BASE_URL}?GROUP={group}&FORMAT={format_type}"


def _get_cache_path(group: str, fmt: str) -> Path:
    """Return the local cache filepath for a group and format."""
    return CACHE_DIR / f"{group}_{fmt}.txt"


def fetch_active_catalog(
    group: str = "active",
    fmt: Optional[str] = None,
    *,
    force_refresh: bool = False,
    max_cache_age_seconds: int = CACHE_TTL_SECONDS,
    retries: int = 2,
    backoff_seconds: float = 0.5,
    timeout: int = 6,
) -> List[SatelliteRecord]:
    """Fetch 2LE/TLE elements for *group* from CelesTrak with 24-hour disk caching and rate-limiting."""
    if group == "debris":
        all_deb = []
        seen = set()
        for sub_grp in ("fengyun-1c-debris", "cosmos-2251-debris", "iridium-33-debris"):
            try:
                sub_records = fetch_active_catalog(
                    sub_grp,
                    fmt=fmt,
                    force_refresh=force_refresh,
                    max_cache_age_seconds=max_cache_age_seconds,
                    retries=retries,
                    backoff_seconds=backoff_seconds,
                    timeout=timeout,
                )
                if sub_records:
                    for r in sub_records:
                        if r.norad_id not in seen:
                            seen.add(r.norad_id)
                            all_deb.append(r)
            except Exception:
                pass
        if all_deb:
            return all_deb

    format_type = fmt or DEFAULT_FORMATS.get(group, "2le")
    url = build_celestrak_url(group, format_type)
    label = SUPPORTED_GROUPS.get(group, group)
    cache_path = _get_cache_path(group, format_type)

    # 1. Check local 24-hour disk cache first (Policy: Pull data once every 24 hours)
    if cache_path.exists() and not force_refresh:
        cache_age = time.time() - cache_path.stat().st_mtime
        if cache_age < max_cache_age_seconds:
            try:
                cached_text = cache_path.read_text(encoding="utf-8")
                records = parse_tle_catalog(cached_text)
                if records:
                    hrs = round(cache_age / 3600, 1)
                    print(f"[CELESTRAK CACHE] ✓ Serving {len(records)} objects for '{label}' from local cache ({hrs}h old < 24h TTL).")
                    return records
            except Exception as e:
                print(f"[CELESTRAK CACHE WARN] Could not read cache {cache_path}: {e}")

    # 2. Network Request with Rate-Limiting Pacing (< 1 req/sec)
    for attempt in range(1, retries + 1):
        try:
            _throttle_celestrak_request(min_interval=1.05)
            print(f"[CELESTRAK] Requesting '{label}' ({format_type.upper()}) [attempt {attempt}/{retries}]: {url}")
            response = requests.get(url, headers=_HEADERS, timeout=timeout)

            # Check for CelesTrak rate-limiting notice (HTTP 403)
            if response.status_code == 403 and "has not updated since" in response.text:
                print(f"[CELESTRAK] Rate-limit notice: CelesTrak data unchanged. Checking local cache...")
                if cache_path.exists():
                    cached_text = cache_path.read_text(encoding="utf-8")
                    records = parse_tle_catalog(cached_text)
                    if records:
                        print(f"[CELESTRAK] ✓ Loaded {len(records)} objects for '{group}' from local cache.")
                        return records

            response.raise_for_status()
            body = response.text.strip()

            if "<html" in body.lower():
                raise ValueError(f"CelesTrak returned HTML for group '{group}'. Service may be unavailable.")

            if not body or "No GP data found" in body:
                raise ValueError(f"No element data returned for group '{group}'.")

            records = parse_tle_catalog(body)
            if not records:
                raise ValueError(f"Zero valid records parsed for group '{group}'.")

            # Update local disk cache with timestamp
            try:
                cache_path.write_text(body, encoding="utf-8")
            except Exception as cache_err:
                print(f"[CACHE WARN] Could not write cache file {cache_path}: {cache_err}")

            print(
                f"[CELESTRAK] ✓ Fetched {len(records)} objects for '{label}' "
                f"(HTTP {response.status_code}, {len(body):,} bytes)"
            )
            return records

        except Exception as exc:
            print(f"[CELESTRAK] Attempt {attempt} notice for '{group}': {exc}")
            if attempt < retries:
                sleep_for = backoff_seconds * (2 ** (attempt - 1))
                time.sleep(sleep_for)

    # Fallback to local disk cache if network query fails
    if cache_path.exists():
        try:
            cached_text = cache_path.read_text(encoding="utf-8")
            records = parse_tle_catalog(cached_text)
            if records:
                print(f"[CELESTRAK] [FALLBACK] Serving {len(records)} cached records for '{group}'.")
                return records
        except Exception:
            pass

    return []


def fetch_multiple_groups(
    groups: List[str],
    *,
    force_refresh: bool = False,
    retries: int = 2,
    backoff_seconds: float = 0.5,
    timeout: int = 6,
) -> List[SatelliteRecord]:
    """Fetch and merge 2LE/TLE catalogs across groups, strictly pacing requests (< 1 req/sec)."""
    seen_ids: set[int] = set()
    merged: List[SatelliteRecord] = []

    for group in groups:
        records = fetch_active_catalog(
            group,
            force_refresh=force_refresh,
            retries=retries,
            backoff_seconds=backoff_seconds,
            timeout=timeout,
        )
        for record in records:
            if record.norad_id not in seen_ids:
                seen_ids.add(record.norad_id)
                merged.append(record)

    print(f"[CELESTRAK] Merged {len(merged)} unique objects across {len(groups)} group(s).")
    return merged