-- ============================================================================
-- Space Debris & Conjunction Monitoring Database Schema
-- Supports PostgreSQL (with declarative LIST partitioning) and SQLite.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SATELLITES TABLE (Partitioned by catalog_group)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. CONJUNCTIONS TABLE (Categorized by catalog_group & indexed for fast UI)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conjunctions (
  id UUID NOT NULL,
  catalog_group VARCHAR(32) NOT NULL DEFAULT 'active',
  sat1_id INTEGER NOT NULL,
  sat1_name VARCHAR(255) NOT NULL,
  sat2_id INTEGER NOT NULL,
  sat2_name VARCHAR(255) NOT NULL,
  tca_utc TIMESTAMPTZ NOT NULL,
  miss_distance_km DOUBLE PRECISION NOT NULL,
  relative_velocity_km_s DOUBLE PRECISION NOT NULL,
  risk_score DOUBLE PRECISION NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
  risk_level VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Fast covering & category indexes
CREATE INDEX IF NOT EXISTS ix_conjunctions_group_risk ON conjunctions (catalog_group, risk_score DESC, tca_utc);
CREATE INDEX IF NOT EXISTS ix_conjunctions_sat1_id ON conjunctions (sat1_id);
CREATE INDEX IF NOT EXISTS ix_conjunctions_sat2_id ON conjunctions (sat2_id);
CREATE INDEX IF NOT EXISTS ix_conjunctions_tca_utc ON conjunctions (tca_utc);
CREATE INDEX IF NOT EXISTS ix_conjunctions_risk_score ON conjunctions (risk_score DESC);

-- ----------------------------------------------------------------------------
-- 3. SAVED / COLLECTIVELY TRACKED SATELLITES
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. RECENTLY VIEWED SATELLITES LOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recently_viewed_satellites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
