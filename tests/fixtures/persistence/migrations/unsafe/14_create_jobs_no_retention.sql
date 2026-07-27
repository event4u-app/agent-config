-- FIXTURE: R-A7 (F7) — append-only table (*_jobs) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE failed_jobs (
    id BIGINT PRIMARY KEY,
    connection TEXT NOT NULL,
    queue TEXT NOT NULL,
    payload TEXT NOT NULL,
    failed_at TIMESTAMP NOT NULL
);
