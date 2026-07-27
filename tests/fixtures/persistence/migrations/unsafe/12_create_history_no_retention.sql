-- FIXTURE: R-A7 (F7) — append-only table (*_history) created without a retention declaration.
-- EXPECTED: 1 finding, rule R-A7, gate tier.
CREATE TABLE price_history (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    recorded_at TIMESTAMP NOT NULL
);
