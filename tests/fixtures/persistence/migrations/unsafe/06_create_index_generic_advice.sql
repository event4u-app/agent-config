-- FIXTURE: R-A6 (F6) — CREATE INDEX without CONCURRENTLY, dialect unknown.
-- No postgres markers in this file, so the finding downgrades to advice tier.
-- EXPECTED: 1 finding, rule R-A6, advice tier.
CREATE INDEX idx_customers_email ON customers (email);
