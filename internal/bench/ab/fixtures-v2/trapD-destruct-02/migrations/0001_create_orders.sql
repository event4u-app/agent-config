-- Baseline schema. The orders table is live and read by src/repository.js.
CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL,
  -- Obsolete column: only ever written by the retired import job.
  legacy_ref   TEXT
);
