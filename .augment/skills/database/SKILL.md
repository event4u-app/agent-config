---
name: database
description: "Use when working with database architecture, MariaDB optimization, indexing strategies, query performance, or multi-connection patterns."
---

# database

## When to use

Use this skill when optimizing queries, designing schemas, adding indexes, managing database connections, or troubleshooting database performance.

## Before making changes

1. Read project-specific docs in `agents/docs/` for database architecture details.
2. Check `config/database.php` (or equivalent) for connection definitions.
3. Review existing migrations for naming and schema patterns.

## Database engine

Detect the database engine from the project's configuration:
- Check `config/database.php` or `.env` for the driver (MySQL, MariaDB, PostgreSQL, SQLite).
- Check `docker-compose.yml` for database containers.

## Multi-connection architecture

If the project uses multiple database connections (see `multi-tenancy` skill):

- **Always specify `$connection`** on models.
- **Use explicit connection in migrations** when targeting specific databases.

## Indexing strategies

### When to add indexes

- Columns used in `WHERE` clauses.
- Columns used in `JOIN` conditions.
- Columns used in `ORDER BY` (especially with pagination).
- Foreign key columns (Laravel adds these automatically with `foreignId()`).

### When NOT to add indexes

- Boolean columns with low selectivity (e.g., `is_active` on a table where 99% are `true`).
- Small tables (< 1000 rows) — full scans are fast enough.
- Columns that are frequently updated — indexes slow down writes.

### Composite indexes

Order matters — put the most selective column first:

```php
$table->index(['customer_id', 'created_at']);  // customer_id is more selective
```

## Query optimization

### Diagnosing slow queries

Use `EXPLAIN` to analyze query plans in MariaDB/MySQL:

```sql
-- Basic explain
EXPLAIN SELECT * FROM projects WHERE customer_id = 42;

-- Extended with actual execution stats (MariaDB 10.1+)
EXPLAIN ANALYZE SELECT * FROM projects WHERE customer_id = 42 AND status = 'active';
```

**Key things to look for in EXPLAIN output:**

| Column | Bad value | Meaning |
|---|---|---|
| `type` | `ALL` | Full table scan — needs an index |
| `type` | `index` | Full index scan — query touches too many rows |
| `rows` | High number | Too many rows examined |
| `Extra` | `Using filesort` | Sorting without index — add ORDER BY index |
| `Extra` | `Using temporary` | Temp table created — optimize GROUP BY/DISTINCT |
| `key` | `NULL` | No index used |

**Good values:** `type` = `ref`, `eq_ref`, `const`; `Extra` = `Using index` (covering index).

### N+1 query detection

N+1 is the most common performance issue. Detect and prevent:

```php
// ❌ N+1 — triggers a query per project
$projects = Project::all();
foreach ($projects as $project) {
    echo $project->customer->name;
}

// ✅ Eager load — 2 queries total
$projects = Project::with(['customer', 'creator'])->get();

// ✅ Lazy eager load — when you already have the collection
$projects->load('customer');
```

**In services:** Use `->with()` at the query level, not in the model's `$with` property
(which always loads the relationship, even when not needed).

### Pagination

**Always paginate** list endpoints — never use `get()` on unbounded queries:

```php
// ✅ Correct
$users = User::query()->paginate(15);

// ❌ Dangerous — loads entire table
$users = User::all();
```

For large datasets with simple "next page" navigation, use cursor pagination:

```php
// ✅ More efficient for large tables (no OFFSET)
$users = User::query()->orderBy('id')->cursorPaginate(15);
```

### Select only needed columns

```php
// ✅ For large tables with many columns
$names = User::query()->select(['id', 'name', 'email'])->get();
```

### Chunk processing

For processing large datasets:

```php
User::query()->chunk(500, function ($users) {
    foreach ($users as $user) {
        // Process
    }
});
```

### Query anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `SELECT *` in production | Transfers unnecessary data | Select only needed columns |
| `LIKE '%search%'` | Leading wildcard prevents index use | Use fulltext search or `LIKE 'search%'` |
| `OFFSET` on large tables | Scans and discards rows | Use cursor pagination |
| Subquery in WHERE | Often slower than JOIN | Rewrite as JOIN |
| `ORDER BY RAND()` | Full table scan + sort | Use application-level randomization |

## Migrations

### Conventions

- Use `php artisan make:migration` (Laravel) or equivalent to generate files.
- Use `decimal` for money — never `float`.
- Add foreign keys with `constrained()` and proper `onDelete()` behavior.
- Always add indexes for searchable/filterable columns.
- Check project docs (`agents/docs/`) for table prefixes and naming patterns.

### Multi-connection migrations

```php
// Specify the connection explicitly
Schema::connection('tenant_database')->create('projects', function (Blueprint $table) {
    // ...
});
```

## Transactions

### Per-connection transactions

```php
// ✅ Correct — explicit connection
DB::connection('tenant_database')->transaction(function () {
    // Tenant-specific operations
});

// ✅ Cross-connection (manual)
DB::connection('central_database')->beginTransaction();
DB::connection('tenant_database')->beginTransaction();
try {
    // Operations on both connections
    DB::connection('tenant_database')->commit();
    DB::connection('central_database')->commit();
} catch (\Throwable $e) {
    DB::connection('tenant_database')->rollBack();
    DB::connection('central_database')->rollBack();
    throw $e;
}
```

## Money and calculations

If the project has a `Math` helper class, use it for financial calculations:

```php
// ✅ Correct (if Math helper exists)
$total = Math::multiply($price, $quantity);

// ❌ Wrong — floating point errors
$total = $price * $quantity;
```

Use `decimal` columns in migrations:

```php
$table->decimal('price', 10, 2);
```


## Schema awareness (anti-hallucination)

**Never guess table or column names.** Always verify against the actual schema before writing queries,
migrations, or model code.

### Verification methods (in order of preference)

1. **Read migrations** — `database/migrations/` (and module migration directories if applicable) are the source of truth.
2. **Read models** — check `$table`, `$connection`, `$fillable`, `$casts`, and relationships.
3. **Run schema queries** — inside the Docker container:
   ```bash
   # List tables (Laravel)
   php artisan tinker --execute="Schema::getColumnListing('table_name')"
   ```
4. **Check project docs** — `agents/docs/` for table prefix conventions and architecture.

### Common hallucination traps

| Trap | Reality |
|---|---|
| Assuming a column exists | Check the migration or model first |
| Wrong table prefix | Customer tables may have prefixes — check conventions |
| Wrong connection | `api_database` vs `customer_database` — always verify |
| Inventing relationship tables | Check if the pivot table actually exists |
| Assuming column types | `decimal` vs `float`, `string` vs `text` — check migration |

### Safe query patterns

When exploring an unfamiliar area of the database:
- **Start with the model** — it documents the table, connection, and relationships.
- **Cross-reference with migrations** — for exact column types and constraints.
- **Never write a migration that references a column without verifying it exists.**

## Auto-trigger keywords

- database
- MariaDB
- MySQL
- migration
- indexing
- query optimization

## Gotcha

- Never add indexes without checking existing ones — duplicate indexes waste write performance.
- The model forgets to consider multi-tenant implications — queries may need to scope by customer DB.
- `EXPLAIN` output varies between MariaDB and MySQL — don't assume identical behavior.
- Don't use `TEXT` columns in WHERE clauses without a prefix index — full table scan guaranteed.

## Do NOT

- Do NOT use raw SQL with user input — always parameterize.
- Do NOT use `float` for money — use `decimal`.
- Do NOT forget to add indexes on foreign keys and frequently queried columns.
- Do NOT use `get()` or `all()` on large tables without pagination or limits.
- Do NOT run migrations without specifying the connection in a multi-DB project.
- Do NOT rely on the default connection for tenant models — always set `$connection`.
