-- FIXTURE: R-A7 (F7) — append-only table (notifications) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMP
);
