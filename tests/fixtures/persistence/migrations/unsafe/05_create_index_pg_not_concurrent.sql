-- FIXTURE: R-A6 (F6) — CREATE INDEX without CONCURRENTLY on a postgres-dialect file.
-- Postgres dialect is signalled by the JSONB column type below.
-- EXPECTED: 1 finding, rule R-A6, gate tier (pg dialect detected).
ALTER TABLE products ADD COLUMN attributes JSONB;
CREATE INDEX idx_products_sku ON products (sku);
