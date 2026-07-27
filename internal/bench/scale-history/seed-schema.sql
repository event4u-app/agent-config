-- Seeded schema for the scale-history bench task (pre-registered in
-- internal/bench/corpora/scale-history-PREREG.md). The agent builds the
-- admin module ON TOP of this — tenants/users exist; projects is the
-- module's surface.
-- retention: reference schema only — no runtime data
CREATE TABLE tenants (
    id BIGINT PRIMARY KEY,
    name VARCHAR(190) NOT NULL,
    subdomain VARCHAR(63) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX tenants_subdomain_unique ON tenants (subdomain);

CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    email VARCHAR(190) NOT NULL,
    name VARCHAR(190) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE INDEX users_tenant_id_index ON users (tenant_id);
