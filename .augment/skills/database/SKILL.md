---
name: database
description: "Use when working with database architecture, MariaDB optimization, indexing strategies, query performance, or multi-connection patterns."
source: package
---

# database

## When to use

Query optimization, schema design, indexes, connections, DB performance.

## Before: project docs (`agents/docs/`), `config/database.php`, existing migrations.

## Engine: detect from config/`.env`/docker-compose (MySQL, MariaDB, PostgreSQL, SQLite).

## Multi-connection: specify `$connection` on models, explicit connection in migrations (see `multi-tenancy` skill).

## Indexing

**Add:** WHERE columns, JOIN conditions, ORDER BY (pagination), FK columns.
**Don't add:** low-selectivity booleans, small tables (<1000 rows), frequently updated columns.

### Composite indexes

Order matters — put the most selective column first:

```php
$table->index(['customer_id', 'created_at']);  // customer_id is more selective
```

## Query optimization

**EXPLAIN:** `type=ALL` (full scan → need index), `key=NULL` (no index), `Using filesort` (add ORDER BY index). Good: `ref`, `eq_ref`, `const`, `Using index`.

**N+1:** Use `with()` at query level, `load()` post-query. Never `$with` property (always loads).

**Pagination:** Always paginate lists. `cursorPaginate()` for large tables (no OFFSET). Never `get()` unbounded.

**Performance:** `select()` needed columns, `chunk(500)` for bulk processing, `exists()` not `count() > 0`.

**Anti-patterns:** `SELECT *`, `LIKE '%...'`, large OFFSET, subquery in WHERE (→ JOIN), `ORDER BY RAND()`.

## Migrations: `decimal` for money, FK with `constrained()`, indexes for searchable columns, explicit `Schema::connection()` for multi-DB.

## Transactions: explicit connection `DB::connection('x')->transaction()`. Cross-connection: manual begin/commit/rollback.

## Money: `Math` helper if exists, `decimal(10, 2)` columns. Never `float`.

## Schema awareness: NEVER guess names. Verify: migrations → models → tinker → project docs. Common traps: assumed columns, wrong prefix, wrong connection, invented pivots.

## Gotcha: check existing indexes before adding, consider multi-tenant scoping, EXPLAIN differs MariaDB vs MySQL, no TEXT in WHERE without prefix index.

## Do NOT: raw SQL with user input, float for money, skip FK indexes, unbounded get()/all(), default connection for tenant models.
