-- Migrate the original placeholder table to the full conjunction-alert schema.
-- This migration is safe only while the legacy table is empty. A populated
-- legacy table cannot be mapped because it lacks all alert details.

BEGIN;

DO $$
DECLARE
  legacy_row_count BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conjunctions'
      AND column_name = 'id'
      AND data_type = 'integer'
  ) THEN
    SELECT count(*) INTO legacy_row_count FROM conjunctions;
    IF legacy_row_count > 0 THEN
      RAISE EXCEPTION 'Legacy conjunctions table contains data; migrate it manually before applying 001.';
    END IF;
    DROP TABLE conjunctions;
  END IF;
END $$;

\ir ../init_db.sql

COMMIT;
