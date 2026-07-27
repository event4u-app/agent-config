-- FIXTURE: SAFE — destructive ops carry migration-unsafe waivers (same line or
-- line above). EXPECTED: 0 unwaived findings.
-- migration-unsafe: table replaced by reports_v2, data archived to S3 2026-07
DROP TABLE legacy_reports;

ALTER TABLE users DROP COLUMN middle_name; -- migration-unsafe: column unused since v3, verified zero reads

-- migration-unsafe: staging-only table, reloaded on every import run
TRUNCATE TABLE staging_imports;

-- migration-unsafe: widening NUMERIC precision is backfill-safe, verified on replica
ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(14, 4);
