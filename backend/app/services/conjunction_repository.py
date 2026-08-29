"""Persistence operations for conjunction scan results.

All database operations go through this module so the rest of the application
never touches SQLAlchemy sessions directly.
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import select

from app.database import SessionLocal, get_engine
from app.models.conjunction import Conjunction
from app.models.schemas import ConjunctionAlert


def _ensure_session_bound() -> None:
    """Guarantee the session factory has a bound engine before use."""
    get_engine()


def save_conjunction_alerts(
    alerts: Sequence[ConjunctionAlert],
    catalog_group: str = "active",
) -> None:
    """Store all alerts from a completed scan in one atomic transaction."""
    if not alerts:
        return

    _ensure_session_bound()

    with SessionLocal.begin() as session:
        session.add_all(
            [
                Conjunction(
                    id=alert.id,
                    catalog_group=alert.catalog_group or catalog_group,
                    sat1_id=alert.sat1_id,
                    sat1_name=alert.sat1_name,
                    sat2_id=alert.sat2_id,
                    sat2_name=alert.sat2_name,
                    tca_utc=alert.tca_utc,
                    miss_distance_km=alert.miss_distance_km,
                    relative_velocity_km_s=alert.relative_velocity_km_s,
                    risk_score=alert.risk_score,
                    risk_level=alert.risk_level,
                )
                for alert in alerts
            ]
        )


def list_recent_conjunction_alerts(
    limit: int = 100,
    catalog_group: Optional[str] = None,
    future_only: bool = True,
) -> list[ConjunctionAlert]:
    """Return the most recent persisted conjunction alerts, newest first.

    If *catalog_group* is provided, queries only that category partition.
    If *future_only* is True, filters only for active upcoming approaches (TCA >= now - 1h).
    """
    from datetime import datetime, timezone, timedelta
    _ensure_session_bound()

    statement = select(Conjunction)
    if catalog_group:
        statement = statement.where(Conjunction.catalog_group == catalog_group)
    if future_only:
        now = datetime.now(timezone.utc)
        statement = statement.where(Conjunction.tca_utc >= now - timedelta(hours=1))

    statement = statement.order_by(Conjunction.tca_utc.asc()).limit(limit)

    with SessionLocal() as session:
        records = session.scalars(statement).all()

    return [
        ConjunctionAlert(
            id=record.id,
            catalog_group=record.catalog_group,
            sat1_id=record.sat1_id,
            sat1_name=record.sat1_name,
            sat2_id=record.sat2_id,
            sat2_name=record.sat2_name,
            tca_utc=record.tca_utc,
            miss_distance_km=record.miss_distance_km,
            relative_velocity_km_s=record.relative_velocity_km_s,
            risk_score=record.risk_score,
            risk_level=record.risk_level,
        )
        for record in records
    ]
