"""SQLAlchemy ORM model for a conjunction (close-approach) event.

Uses the cross-dialect ``Uuid`` type (SQLAlchemy 2.0+) so the same model
works with both the local SQLite development database and a production
PostgreSQL instance without any code changes.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, Index, Integer, String, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Conjunction(Base):
    """Persisted result of one conjunction scan."""

    __tablename__ = "conjunctions"
    __table_args__ = (
        CheckConstraint(
            "risk_score >= 0.0 AND risk_score <= 1.0",
            name="conjunctions_risk_score_range",
        ),
        Index("ix_conjunctions_group_risk", "catalog_group", "risk_score", "tca_utc"),
    )

    # Uuid(as_uuid=False) stores as native UUID on PostgreSQL and as
    # CHAR(32) on SQLite — both accept the plain string UUID we pass.
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    catalog_group: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    sat1_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sat1_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sat2_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sat2_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tca_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    miss_distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    relative_velocity_km_s: Mapped[float] = mapped_column(Float, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

