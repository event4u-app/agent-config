-- FIXTURE: R-A7 (F7) — append-only table (sessions) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT,
    payload TEXT NOT NULL,
    last_activity INTEGER NOT NULL
);
