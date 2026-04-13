---
name: sql
description: "Use when writing raw SQL — MariaDB/MySQL syntax, parameterization, or preventing common mistakes like PHP notation in SQL."
---

# sql

## When to use

Use this skill when writing or reviewing raw SQL queries, database migrations with raw statements,
seeders with raw SQL, or any code that constructs SQL strings.

## The Iron Law

```
NEVER build SQL strings with PHP variable interpolation or concatenation.
ALWAYS use parameterized queries or query builder.
```

## Raw SQL in Laravel

### Parameterized queries (safe)

```php
// ✅ Correct — parameterized
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
DB::select('SELECT * FROM users WHERE email = :email', ['email' => $email]);

// ✅ Correct — query builder
DB::table('users')->where('email', $email)->get();

// ❌ DANGEROUS — SQL injection
DB::select("SELECT * FROM users WHERE email = '{$email}'");
DB::select('SELECT * FROM users WHERE email = ' . $email);
```

### Raw expressions in Eloquent

```php
// ✅ Correct — DB::raw with static SQL
$users = User::query()
    ->select(DB::raw('COUNT(*) as count, status'))
    ->groupBy('status')
    ->get();

// ✅ Correct — selectRaw with bindings
$orders = Order::query()
    ->selectRaw('SUM(total) as revenue, DATE(created_at) as date')
    ->whereRaw('created_at >= ?', [$startDate])
    ->groupByRaw('DATE(created_at)')
    ->get();

// ❌ Wrong — PHP variable in raw SQL
$orders = Order::query()
    ->whereRaw("created_at >= '{$startDate}'")
    ->get();
```

## Common mistakes to prevent

### PHP notation in SQL

```php
// ❌ Wrong — PHP array syntax in SQL
DB::statement("UPDATE users SET roles = ['admin'] WHERE id = 1");

// ✅ Correct — SQL JSON syntax
DB::statement("UPDATE users SET roles = JSON_ARRAY('admin') WHERE id = ?", [1]);

// ❌ Wrong — PHP null in raw SQL
DB::statement("UPDATE users SET deleted_at = null WHERE id = 1");

// ✅ Correct — SQL NULL
DB::statement('UPDATE users SET deleted_at = NULL WHERE id = ?', [1]);

// ❌ Wrong — PHP boolean in SQL
DB::statement("UPDATE users SET active = true WHERE id = 1");

// ✅ Correct — SQL boolean (MariaDB uses 1/0)
DB::statement('UPDATE users SET active = 1 WHERE id = ?', [1]);

// ❌ Wrong — PHP string concatenation for IN clause
$ids = implode(',', $userIds);
DB::select("SELECT * FROM users WHERE id IN ({$ids})");

// ✅ Correct — parameterized IN
DB::select('SELECT * FROM users WHERE id IN (' . implode(',', array_fill(0, count($userIds), '?')) . ')', $userIds);

// ✅ Better — use query builder
DB::table('users')->whereIn('id', $userIds)->get();
```

### MariaDB/MySQL-specific syntax

```sql
-- String quoting: single quotes for values, backticks for identifiers
SELECT `user`.`name` FROM `users` AS `user` WHERE `name` = 'John';

-- JSON columns (MariaDB 10.2+)
SELECT JSON_VALUE(settings, '$.theme') FROM users;
UPDATE users SET settings = JSON_SET(settings, '$.theme', 'dark') WHERE id = 1;

-- UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
INSERT INTO counters (key, value) VALUES ('visits', 1)
ON DUPLICATE KEY UPDATE value = value + 1;

-- Date functions
SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) FROM orders GROUP BY month;
```

## Migration raw statements

```php
// ✅ Correct — static SQL in migrations
DB::statement('ALTER TABLE users ADD FULLTEXT INDEX ft_name (name)');

// ✅ Correct — with proper escaping for identifiers
DB::statement(sprintf(
    'ALTER TABLE `%s` ADD INDEX `%s` (`%s`)',
    $table,
    $indexName,
    $column
));
```

## Prefer query builder

When possible, always prefer Laravel's query builder over raw SQL:

| Raw SQL needed | Use case |
|---|---|
| **No** | Standard CRUD, filtering, joins, aggregates |
| **Yes** | Complex subqueries, window functions, vendor-specific features |
| **Yes** | Performance-critical queries with specific index hints |
| **Yes** | Bulk operations (INSERT ... SELECT, UPDATE ... JOIN) |
| **Yes** | Full-text search with MATCH ... AGAINST |


## Auto-trigger keywords

- raw SQL
- SQL query
- parameterized query
- MariaDB syntax
- SQL injection

## Gotcha

- MariaDB and MySQL have subtle syntax differences — don't assume identical behavior.
- Never use PHP variable interpolation in SQL — always use parameterized queries.
- The model tends to write `$variable` in SQL strings instead of `?` or `:named` placeholders.
- `GROUP BY` in MariaDB with `ONLY_FULL_GROUP_BY` requires all non-aggregated columns — the model frequently forgets this.

## Do NOT

- Do NOT interpolate PHP variables into SQL strings — always parameterize.
- Do NOT use PHP syntax (arrays, booleans, null) in raw SQL — use SQL equivalents.
- Do NOT use `float` for money in SQL — use `DECIMAL(10, 2)`.
- Do NOT forget backtick quoting for reserved words used as column names.
- Do NOT use `OFFSET` for pagination on large tables — use cursor pagination.
- Do NOT write raw SQL when the query builder can express the same thing clearly.
