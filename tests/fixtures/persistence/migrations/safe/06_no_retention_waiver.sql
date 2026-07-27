-- FIXTURE: SAFE — append-only table (audit_*) with an explicit no-retention
-- waiver. EXPECTED: 0 unwaived findings.
-- no-retention: compliance requires indefinite audit trail (SOC2 control A-7)
CREATE TABLE audit_entries (
    id BIGINT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    logged_at TIMESTAMP NOT NULL
);
