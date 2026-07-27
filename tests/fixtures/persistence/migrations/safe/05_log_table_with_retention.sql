-- FIXTURE: SAFE — append-only table (*_logs) WITH a retention declaration.
-- EXPECTED: 0 findings.
-- retention: 90 days, pruned nightly by prune_request_logs job
CREATE TABLE request_logs (
    id BIGINT PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
