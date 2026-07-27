-- FIXTURE: R-A6 (F6) — column type change (ALTER COLUMN ... TYPE) without waiver.
-- EXPECTED: 1 finding, rule R-A6, gate tier.
ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(12, 4);
