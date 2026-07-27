-- FIXTURE: SAFE — destructive keywords appear ONLY inside string literals and
-- comments; the splitter must not treat them as statements. EXPECTED: 0 findings.
/* A reviewer once wrote: DROP TABLE users; -- but this is just a comment. */
CREATE TABLE release_notes (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL DEFAULT 'No ''TRUNCATE TABLE'' here; DROP COLUMN neither.'
);

INSERT INTO release_notes (id, title, body)
VALUES (1, 'v2.0', 'This release removes the DROP TABLE migration path; see docs.');
