-- FIXTURE: R-A6 (F6) — ADD COLUMN ... NOT NULL without DEFAULT on an existing table.
-- EXPECTED: 1 finding, rule R-A6, gate tier.
ALTER TABLE orders ADD COLUMN currency_code VARCHAR(3) NOT NULL;
