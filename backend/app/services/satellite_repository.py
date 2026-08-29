"""Persistence operations for category-partitioned satellites catalog."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Sequence

from sqlalchemy import delete, select

from app.database import SessionLocal, get_engine
from app.models.satellite import Satellite
from app.models.schemas import SatelliteRecord


def _ensure_session_bound() -> None:
    """Guarantee the session factory has a bound engine before use."""
    get_engine()


def upsert_satellites_for_group(
    group: str,
    records: Sequence[SatelliteRecord],
) -> int:
    """Replace and store satellite records for a given category group partition."""
    if not records:
        return 0

    _ensure_session_bound()
    now = datetime.now(timezone.utc)

    with SessionLocal.begin() as session:
        # Clear existing records in this group partition
        session.execute(
            delete(Satellite).where(Satellite.catalog_group == group)
        )

        # Bulk insert new records
        models = [
            Satellite(
                catalog_group=group,
                norad_id=r.norad_id,
                name=r.name,
                apogee_km=r.apogee_km,
                perigee_km=r.perigee_km,
                inclination_deg=r.inclination_deg,
                bstar_drag=r.bstar_drag,
                line1=r.line1,
                line2=r.line2,
                updated_at=now,
            )
            for r in records
        ]
        session.add_all(models)

    return len(models)


def get_satellites_by_group(
    group: str,
    limit: int = 500,
) -> List[SatelliteRecord]:
    """Retrieve satellites filtered by category group partition."""
    _ensure_session_bound()

    statement = (
        select(Satellite)
        .where(Satellite.catalog_group == group)
        .order_by(Satellite.norad_id.asc())
        .limit(limit)
    )

    with SessionLocal() as session:
        rows = session.scalars(statement).all()

    return [
        SatelliteRecord(
            norad_id=row.norad_id,
            name=row.name,
            line1=row.line1,
            line2=row.line2,
            apogee_km=row.apogee_km,
            perigee_km=row.perigee_km,
            inclination_deg=row.inclination_deg,
            bstar_drag=row.bstar_drag,
        )
        for row in rows
    ]


def get_satellite_by_norad_id(
    norad_id: int,
    group: Optional[str] = None,
) -> Optional[SatelliteRecord]:
    """Retrieve a single satellite record by NORAD ID."""
    _ensure_session_bound()

    statement = select(Satellite).where(Satellite.norad_id == norad_id)
    if group:
        statement = statement.where(Satellite.catalog_group == group)

    statement = statement.limit(1)

    with SessionLocal() as session:
        row = session.scalars(statement).first()

    if row is None:
        return None

    return SatelliteRecord(
        norad_id=row.norad_id,
        name=row.name,
        line1=row.line1,
        line2=row.line2,
        apogee_km=row.apogee_km,
        perigee_km=row.perigee_km,
        inclination_deg=row.inclination_deg,
        bstar_drag=row.bstar_drag,
    )

