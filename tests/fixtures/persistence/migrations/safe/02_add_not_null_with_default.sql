-- FIXTURE: SAFE — ADD COLUMN ... NOT NULL carries a DEFAULT, so existing rows
-- backfill safely. EXPECTED: 0 findings.
ALTER TABLE orders ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pending';

-- DEFAULT-before-NOT-NULL ordering must also pass.
ALTER TABLE orders ADD COLUMN retries INTEGER DEFAULT 0 NOT NULL;
