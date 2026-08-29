"""SQLAlchemy ORM models for Satellites and Tracking Relations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Satellite(Base):
    """Normalized master satellite record, partitioned by catalog_group."""

    __tablename__ = "satellites"
    __table_args__ = (
        PrimaryKeyConstraint("catalog_group", "norad_id", name="pk_satellites_group_norad"),
        Index("ix_satellites_group_altitude", "catalog_group", "perigee_km", "apogee_km"),
        Index("ix_satellites_norad_id", "norad_id"),
        Index("ix_satellites_name", "name"),
    )

    catalog_group: Mapped[str] = mapped_column(String(32), nullable=False)
    norad_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    intl_designator: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    apogee_km: Mapped[float] = mapped_column(Float, nullable=False)
    perigee_km: Mapped[float] = mapped_column(Float, nullable=False)
    inclination_deg: Mapped[float] = mapped_column(Float, nullable=False)
    period_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bstar_drag: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    line1: Mapped[str] = mapped_column(Text, nullable=False)
    line2: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class SavedSatelliteRecord(Base):
    """Relational model for collectively saved / tracked satellites."""

    __tablename__ = "saved_satellites"
    __table_args__ = (
        Index("ix_saved_satellites_risk", "risk_level"),
    )

    norad_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON string
    apogee_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    perigee_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    inclination_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    altitude_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latitude_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="NORMAL")
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class RecentlyViewedRecord(Base):
    """Relational model for recently viewed satellites log."""

    __tablename__ = "recently_viewed_satellites"
    __table_args__ = (
        Index("ix_recently_viewed_viewed_at", "viewed_at"),
        Index("ix_recently_viewed_norad_id", "norad_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    norad_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    altitude_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latitude_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    velocity_km_s: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="NORMAL")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

