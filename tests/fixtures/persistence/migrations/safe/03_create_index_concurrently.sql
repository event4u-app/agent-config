-- FIXTURE: SAFE — postgres-dialect file, index built with CONCURRENTLY.
-- EXPECTED: 0 findings.
ALTER TABLE products ADD COLUMN attributes JSONB;
CREATE INDEX CONCURRENTLY idx_products_sku ON products (sku);
CREATE UNIQUE INDEX CONCURRENTLY idx_products_slug ON products (slug);
