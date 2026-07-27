-- FIXTURE: SAFE — reversible ops only: CREATE TABLE (non-append-only name),
-- nullable ADD COLUMN, RENAME COLUMN. EXPECTED: 0 findings.
CREATE TABLE customers (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255)
);

ALTER TABLE customers ADD COLUMN phone VARCHAR(32);

ALTER TABLE customers RENAME COLUMN name TO full_name;
