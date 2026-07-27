-- FIXTURE: R-A6 (F6) — irreversible destructive op: DROP TABLE without waiver.
-- EXPECTED: 1 finding, rule R-A6, gate tier.
DROP TABLE legacy_reports;
