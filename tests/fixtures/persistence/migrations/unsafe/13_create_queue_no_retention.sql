-- FIXTURE: R-A7 (F7) — append-only table (*_queue) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE email_queue (
    id BIGINT PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    queued_at TIMESTAMP NOT NULL
);
