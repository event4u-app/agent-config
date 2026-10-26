ALTER TABLE books ADD COLUMN isbn VARCHAR(20);
CREATE UNIQUE INDEX books_isbn_unique ON books (isbn);
CREATE INDEX books_title_idx ON books (title);
DROP INDEX books_title_idx;
DROP TABLE legacy_notes;
