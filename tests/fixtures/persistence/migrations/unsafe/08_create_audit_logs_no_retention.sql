-- FIXTURE: R-A7 (F7) — append-only table (*_logs) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE request_logs (
    id BIGINT PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
