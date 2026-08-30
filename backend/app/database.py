"""Database engine and session management.

Supports both SQLite (local development) and PostgreSQL (production).

Configure for PostgreSQL by setting the DATABASE_URL environment variable:

    export DATABASE_URL="postgresql+psycopg://user:password@host:5432/space_debris"

When DATABASE_URL is not set the API falls back to a SQLite file placed
beside this package's parent directory (i.e. backend/space_debris.db),
which is consistent regardless of the working directory uvicorn is launched
from.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ---------------------------------------------------------------------------
# Database URL resolution
# ---------------------------------------------------------------------------
_DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent.parent / "space_debris.db"
_DEFAULT_SQLITE_URL = f"sqlite:///{_DEFAULT_SQLITE_PATH}"

_raw_url: str = os.environ.get("DATABASE_URL", "").strip()

if not _raw_url:
    DATABASE_URL = _DEFAULT_SQLITE_URL
else:
    # Normalize Render / PostgreSQL URLs for psycopg 3.
    if _raw_url.startswith("postgres://"):
        _raw_url = _raw_url.replace(
            "postgres://",
            "postgresql+psycopg://",
            1,
        )
    elif _raw_url.startswith("postgresql://"):
        _raw_url = _raw_url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1,
        )

    DATABASE_URL = _raw_url
# ---------------------------------------------------------------------------
# Engine singleton & session factory
# ---------------------------------------------------------------------------
_engine: Engine | None = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _build_engine(url: str) -> Engine:
    """Create a SQLAlchemy engine for the given URL and bind the session factory."""
    connect_args: dict = {}
    if url.startswith("sqlite"):
        # SQLite requires check_same_thread=False when the same connection
        # is used from multiple threads (FastAPI / Uvicorn thread pool).
        connect_args["check_same_thread"] = False

    engine = create_engine(
        url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    SessionLocal.configure(bind=engine)
    return engine


def _fallback_to_sqlite(reason: Exception) -> None:
    """Replace an unreachable production database with the local SQLite file."""
    global DATABASE_URL, _engine

    if DATABASE_URL == _DEFAULT_SQLITE_URL:
        return

    print(
        f"[DB] Primary database unavailable ({reason}). "
        f"Falling back to SQLite at {_DEFAULT_SQLITE_PATH}."
    )
    if _engine is not None:
        _engine.dispose()
    DATABASE_URL = _DEFAULT_SQLITE_URL
    _engine = _build_engine(DATABASE_URL)



# ---------------------------------------------------------------------------
# SQLite Performance Optimization Event Listeners
# ---------------------------------------------------------------------------
@event.listens_for(Engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """Enable SQLite WAL mode, memory mapping, and cache for low-latency queries."""
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        # 1. Enable Write-Ahead Logging (WAL) for non-blocking concurrent reads & writes
        cursor.execute("PRAGMA journal_mode = WAL;")
        # 2. Synchronous NORMAL cuts disk I/O wait times
        cursor.execute("PRAGMA synchronous = NORMAL;")
        # 3. 64 MB memory cache for instant queries
        cursor.execute("PRAGMA cache_size = -64000;")
        # 4. Memory-mapped I/O (256 MB) for zero-copy kernel reads
        cursor.execute("PRAGMA mmap_size = 268435456;")
        # 5. Fast temp memory storage
        cursor.execute("PRAGMA temp_store = MEMORY;")
        cursor.close()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_engine() -> Engine:
    """Return the singleton database engine."""
    global _engine

    if _engine is None:
        _engine = _build_engine(DATABASE_URL)

    try:
        with _engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        if DATABASE_URL == _DEFAULT_SQLITE_URL:
            raise
        _fallback_to_sqlite(exc)

    return _engine


def initialize_database() -> None:
    """Run lightweight schema migrations and create any missing tables."""
    # Import here to register ORM mappings before metadata is inspected.
    from app.models.conjunction import Conjunction  # noqa: F401
    from app.models.satellite import (  # noqa: F401
        RecentlyViewedRecord,
        Satellite,
        SavedSatelliteRecord,
    )

    engine = get_engine()
    _migrate_empty_legacy_conjunctions(engine)
    _migrate_conjunction_catalog_group(engine)
    Base.metadata.create_all(bind=engine)
    print(f"[DB] Relational & Partitioned Schema ready. Backend: {DATABASE_URL.split('://')[0]}")


# ---------------------------------------------------------------------------
# Internal migration helpers
# ---------------------------------------------------------------------------

def _migrate_empty_legacy_conjunctions(engine: Engine) -> None:
    """Drop the original two-column placeholder table when it is empty."""
    inspector = inspect(engine)
    if "conjunctions" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("conjunctions")}
    if columns != {"id", "created_at"}:
        return

    with engine.begin() as connection:
        row_count = connection.execute(
            text("SELECT count(*) FROM conjunctions")
        ).scalar_one()
        if row_count:
            raise RuntimeError(
                "The legacy conjunctions table contains data and requires a "
                "manual migration before the API can start."
            )
        connection.execute(text("DROP TABLE conjunctions"))
        print("[DB] Dropped empty legacy conjunctions table.")


def _migrate_conjunction_catalog_group(engine: Engine) -> None:
    """Add catalog_group column to conjunctions table if missing."""
    inspector = inspect(engine)
    if "conjunctions" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("conjunctions")}
    if "catalog_group" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE conjunctions ADD COLUMN catalog_group VARCHAR(32) NOT NULL DEFAULT 'active'")
            )
            print("[DB] Added 'catalog_group' column to conjunctions table.")
