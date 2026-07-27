-- FIXTURE: R-A6 (F6) — irreversible destructive op: DROP COLUMN without waiver.
-- EXPECTED: 1 finding, rule R-A6, gate tier.
ALTER TABLE users DROP COLUMN middle_name;
