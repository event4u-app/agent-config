-- FIXTURE: R-A7 (F7) — append-only table (audit_*) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE audit_trail (
    id BIGINT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    subject_type VARCHAR(255) NOT NULL,
    subject_id BIGINT NOT NULL,
    logged_at TIMESTAMP NOT NULL
);
