---
name: sql
description: "Use when writing raw SQL — MariaDB/MySQL syntax, parameterization, or preventing common mistakes like PHP notation in SQL."
source: package
---

# sql

## When to use

Use when writing or reviewing raw SQL queries, migrations with raw statements, or seeders with raw SQL.

Do NOT use when:
- Eloquent/Query Builder queries (use `eloquent` or `database` skill)
- Schema design (use `database` skill)

## Procedure: Write raw SQL

```
NEVER build SQL strings with PHP variable interpolation or concatenation.
ALWAYS use parameterized queries or query builder.
```

## Conventions

→ See guideline `php/sql.md` for parameterization patterns, common mistakes, MariaDB syntax reference.

## Quick reference

```php
// ✅ Safe
DB::select('SELECT * FROM users WHERE email = ?', [$email]);

// ❌ SQL injection
DB::select("SELECT * FROM users WHERE email = '{$email}'");
```

## Gotcha

- MariaDB and MySQL have subtle syntax differences.
- The model writes `$variable` in SQL strings instead of `?` placeholders.
- `GROUP BY` with `ONLY_FULL_GROUP_BY` requires all non-aggregated columns.
- Use SQL types (`NULL`, `1/0`, `JSON_ARRAY()`) — not PHP equivalents.

## Do NOT

- Do NOT interpolate PHP variables into SQL strings — always parameterize.
- Do NOT use PHP syntax (arrays, booleans, null) in raw SQL — use SQL equivalents.
- Do NOT write raw SQL when the query builder can express the same thing clearly.

## Auto-trigger keywords

- raw SQL
- SQL query
- parameterized query
- MariaDB syntax
- SQL injection
