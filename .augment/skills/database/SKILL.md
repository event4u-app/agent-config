---
name: database
description: "Use when working with database architecture, MariaDB optimization, indexing strategies, query performance, or multi-connection patterns."
source: package
---

# database

## When to use

Use when designing schemas, optimizing queries, adding indexes, or troubleshooting database performance.

Do NOT use when:
- Writing Eloquent models (use `eloquent` skill)
- Creating migrations only (use `migration-creator` skill)

## Procedure: Optimize a query

### Step 0: Inspect

1. Read project docs in `agents/docs/` for database architecture.
2. Check `config/database.php` for connection definitions.
3. Detect engine: check `.env` driver and `docker-compose.yml`.

### Step 1: Diagnose

Run `EXPLAIN` / `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE SELECT * FROM projects WHERE customer_id = 42 AND status = 'active';
```

Check for: full table scans (`type=ALL`), missing indexes (`key=NULL`), filesort, temporary tables.

### Step 2: Fix

- Add missing indexes (most selective column first in composites)
- Rewrite anti-patterns (subquery → JOIN, `OFFSET` → cursor, `SELECT *` → specific columns)
- Add eager loading for N+1 queries
- Always paginate list endpoints

### Step 3: Verify

Re-run `EXPLAIN` and confirm improved plan.

## Schema awareness (anti-hallucination)

**Never guess table or column names.** Verify before writing queries/migrations:

1. **Read migrations** — source of truth
2. **Read models** — `$table`, `$connection`, `$fillable`, `$casts`, relationships
3. **Run schema queries** — `php artisan tinker --execute="Schema::getColumnListing('table')"`
4. **Check project docs** — `agents/docs/` for conventions

| Trap | Reality |
|---|---|
| Assuming column exists | Check migration/model first |
| Wrong table prefix | Customer tables may have prefixes |
| Wrong connection | `api_database` vs `customer_database` — verify |
| Inventing pivot tables | Check if they actually exist |

## Conventions

→ See guideline `php/database.md` for indexing, transactions, migrations, multi-connection patterns.

## Output format

1. Migration file or query change with EXPLAIN analysis
2. Index recommendations with rationale

## Gotcha

- Check existing indexes before adding — duplicates waste write performance.
- Consider multi-tenant implications — queries may need customer DB scoping.
- `EXPLAIN` output varies between MariaDB and MySQL.
- Don't use `TEXT` in WHERE without prefix index.

## Do NOT

- Do NOT guess table/column names — verify against migrations or models first.
- Do NOT add indexes without checking existing ones — duplicates waste write performance.
- Do NOT use `float` for money — use `decimal`.

## Auto-trigger keywords

- database
- MariaDB
- MySQL
- migration
- indexing
- query optimization
