"""Shared mutable application state.

Centralises the in-memory satellite catalog so the REST router, the
WebSocket streamer, and the background auto-refresh task all read from
the same live reference without circular imports.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from app.models.schemas import SatelliteRecord

# ---------------------------------------------------------------------------
# Satellite catalog
# ---------------------------------------------------------------------------
_catalog: List["SatelliteRecord"] = []
_catalog_group: str = ""
_catalog_source_url: str = ""
_catalog_last_updated: Optional[datetime] = None


def get_catalog() -> List["SatelliteRecord"]:
    """Return the currently cached satellite catalog (auto-loading active cache if uninitialized)."""
    global _catalog, _catalog_group, _catalog_last_updated
    if not _catalog:
        try:
            from app.data.fetch_tles import fetch_active_catalog
            cached = fetch_active_catalog("active")
            if cached:
                _catalog = cached
                _catalog_group = "active"
                _catalog_last_updated = datetime.now(timezone.utc)
        except Exception as err:
            print(f"[STATE] Notice loading fallback catalog: {err}")
    return _catalog


def set_catalog(
    new_catalog: List["SatelliteRecord"],
    group: str = "",
    source_url: str = "",
) -> None:
    """Replace the catalog and record fetch metadata."""
    global _catalog, _catalog_group, _catalog_source_url, _catalog_last_updated
    _catalog = new_catalog
    _catalog_group = group
    _catalog_source_url = source_url
    _catalog_last_updated = datetime.now(timezone.utc)


def get_catalog_meta() -> dict:
    """Return a summary of the current catalog state (for status endpoints)."""
    return {
        "count": len(_catalog),
        "group": _catalog_group,
        "source_url": _catalog_source_url,
        "last_updated_utc": _catalog_last_updated.isoformat() if _catalog_last_updated else None,
        "age_seconds": (
            (datetime.now(timezone.utc) - _catalog_last_updated).total_seconds()
            if _catalog_last_updated else None
        ),
    }
