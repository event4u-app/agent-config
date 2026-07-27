-- FIXTURE: R-A7 (F7) — append-only table (*_events) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE user_events (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMP NOT NULL
);
