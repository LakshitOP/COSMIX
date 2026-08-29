-- Migration 002: Relational decomposition, category partitioning, and tracking tables
-- Adds catalog_group to conjunctions, creates satellites partitioned table,
-- and creates saved_satellites & recently_viewed_satellites tables.

BEGIN;

-- 1. Create satellites master table with category partitioning support
CREATE TABLE IF NOT EXISTS satellites (
  norad_id INTEGER NOT NULL,
  catalog_group VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  intl_designator VARCHAR(32),
  apogee_km DOUBLE PRECISION NOT NULL,
  perigee_km DOUBLE PRECISION NOT NULL,
  inclination_deg DOUBLE PRECISION NOT NULL,
  period_min DOUBLE PRECISION,
  bstar_drag DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (catalog_group, norad_id)
);

CREATE INDEX IF NOT EXISTS ix_satellites_norad_id ON satellites (norad_id);
CREATE INDEX IF NOT EXISTS ix_satellites_group_altitude ON satellites (catalog_group, perigee_km, apogee_km);
CREATE INDEX IF NOT EXISTS ix_satellites_name ON satellites (name);

-- 2. Add catalog_group column to conjunctions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conjunctions' AND column_name = 'catalog_group'
  ) THEN
    ALTER TABLE conjunctions ADD COLUMN catalog_group VARCHAR(32) NOT NULL DEFAULT 'active';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_conjunctions_group_risk ON conjunctions (catalog_group, risk_score DESC, tca_utc);

-- 3. Create saved_satellites collective watchlist table
CREATE TABLE IF NOT EXISTS saved_satellites (
  norad_id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  notes TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  apogee_km DOUBLE PRECISION,
  perigee_km DOUBLE PRECISION,
  inclination_deg DOUBLE PRECISION,
  altitude_km DOUBLE PRECISION,
  latitude_deg DOUBLE PRECISION,
  longitude_deg DOUBLE PRECISION,
  risk_level VARCHAR(16) DEFAULT 'NORMAL',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_saved_satellites_risk ON saved_satellites (risk_level);

-- 4. Create recently_viewed_satellites table
CREATE TABLE IF NOT EXISTS recently_viewed_satellites (
  id SERIAL PRIMARY KEY,
  norad_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  altitude_km DOUBLE PRECISION,
  latitude_deg DOUBLE PRECISION,
  longitude_deg DOUBLE PRECISION,
  velocity_km_s DOUBLE PRECISION,
  risk_level VARCHAR(16) DEFAULT 'NORMAL',
  notes TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_recently_viewed_viewed_at ON recently_viewed_satellites (viewed_at DESC);
CREATE INDEX IF NOT EXISTS ix_recently_viewed_norad_id ON recently_viewed_satellites (norad_id);

COMMIT;

