"""Pydantic request/response schemas for the Space Debris API."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Satellite catalog
# ---------------------------------------------------------------------------

class SatelliteRecord(BaseModel):
    """Raw orbital elements parsed from a CelesTrak TLE set."""
    norad_id: int
    name: str
    line1: str
    line2: str
    apogee_km: float
    perigee_km: float
    inclination_deg: float
    bstar_drag: float


# ---------------------------------------------------------------------------
# Position / track
# ---------------------------------------------------------------------------

class SatellitePosition(BaseModel):
    """Instantaneous position of a satellite (ECI + geodetic)."""
    norad_id: int
    name: str
    timestamp: datetime
    x_km: float
    y_km: float
    z_km: float
    latitude_deg: float
    longitude_deg: float
    altitude_km: float


class TrackPoint(BaseModel):
    """One point along a propagated ground-track."""
    t: datetime             # UTC timestamp
    lat: float              # geodetic latitude  (degrees, −90 … +90)
    lon: float              # geodetic longitude (degrees, −180 … +180)
    alt_km: float           # altitude above WGS-84 ellipsoid (km)


class SatelliteOrbitTrack(BaseModel):
    """Ground-track series for one satellite — used to draw the orbit path."""
    norad_id: int
    name: str
    inclination_deg: float
    apogee_km: float
    perigee_km: float
    track: List[TrackPoint]


class OrbitTracksResponse(BaseModel):
    """Response envelope for the batch orbit-tracks endpoint."""
    generated_at_utc: datetime
    propagation_hours: float
    step_minutes: float
    catalog_group: str
    catalog_last_updated_utc: Optional[str]
    satellite_count: int
    satellites: List[SatelliteOrbitTrack]


# ---------------------------------------------------------------------------
# Conjunction alerts
# ---------------------------------------------------------------------------

class ConjunctionAlert(BaseModel):
    """Result of one close-approach event detected by the conjunction scanner."""
    id: str
    catalog_group: Optional[str] = "active"
    sat1_id: int
    sat1_name: str
    sat2_id: int
    sat2_name: str
    tca_utc: datetime
    miss_distance_km: float
    relative_velocity_km_s: float
    risk_score: float = Field(..., ge=0.0, le=1.0)
    risk_level: str         # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

    # Geographic position of each satellite at the Time of Closest Approach.
    # Populated by the real-time scan; None when loaded from historical DB records.
    sat1_lat_at_tca: Optional[float] = None
    sat1_lon_at_tca: Optional[float] = None
    sat1_alt_at_tca_km: Optional[float] = None
    sat2_lat_at_tca: Optional[float] = None
    sat2_lon_at_tca: Optional[float] = None
    sat2_alt_at_tca_km: Optional[float] = None


# ---------------------------------------------------------------------------
# Satellite Logs & Collective Tracking
# ---------------------------------------------------------------------------

class RecentlyViewedSatellite(BaseModel):
    """Entry in the recently viewed last-10 satellites log."""
    norad_id: int
    name: str
    viewed_at: str
    altitude_km: Optional[float] = None
    latitude_deg: Optional[float] = None
    longitude_deg: Optional[float] = None
    velocity_km_s: Optional[float] = None
    risk_level: Optional[str] = None
    notes: Optional[str] = None


class RecordViewRequest(BaseModel):
    """Payload to record a satellite view event."""
    norad_id: int
    name: str
    altitude_km: Optional[float] = None
    latitude_deg: Optional[float] = None
    longitude_deg: Optional[float] = None
    velocity_km_s: Optional[float] = None
    risk_level: Optional[str] = None
    notes: Optional[str] = None


class SavedSatellite(BaseModel):
    """Entry in the collective tracked/saved satellites log."""
    norad_id: int
    name: str
    added_at: str
    updated_at: Optional[str] = None
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []
    apogee_km: Optional[float] = None
    perigee_km: Optional[float] = None
    inclination_deg: Optional[float] = None
    altitude_km: Optional[float] = None
    latitude_deg: Optional[float] = None
    longitude_deg: Optional[float] = None
    risk_level: Optional[str] = "NORMAL"


class SaveSatelliteRequest(BaseModel):
    """Payload to save or update a satellite in the collective track log."""
    norad_id: int
    name: str
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []
    apogee_km: Optional[float] = None
    perigee_km: Optional[float] = None
    inclination_deg: Optional[float] = None
    altitude_km: Optional[float] = None
    latitude_deg: Optional[float] = None
    longitude_deg: Optional[float] = None
    risk_level: Optional[str] = None