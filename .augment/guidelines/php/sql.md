# SQL Guidelines

> Raw SQL conventions — parameterization, MariaDB/MySQL syntax, common mistakes.

**Related Skills:** `sql`, `database`
**Related Guidelines:** [database.md](database.md)

## Iron Law

```
NEVER build SQL strings with PHP variable interpolation or concatenation.
ALWAYS use parameterized queries or query builder.
```

## Parameterized Queries

```php
// ✅ Correct
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
DB::select('SELECT * FROM users WHERE email = :email', ['email' => $email]);

// ❌ DANGEROUS
DB::select("SELECT * FROM users WHERE email = '{$email}'");
```

## Raw Expressions in Eloquent

```php
// ✅ DB::raw with static SQL
User::query()->select(DB::raw('COUNT(*) as count, status'))->groupBy('status')->get();

// ✅ selectRaw with bindings
Order::query()->selectRaw('SUM(total) as revenue')->whereRaw('created_at >= ?', [$start])->get();

// ❌ PHP variable in raw SQL
Order::query()->whereRaw("created_at >= '{$start}'")->get();
```

## Common Mistakes

```php
// ❌ PHP array syntax in SQL
DB::statement("UPDATE users SET roles = ['admin'] WHERE id = 1");
// ✅ SQL JSON syntax
DB::statement("UPDATE users SET roles = JSON_ARRAY('admin') WHERE id = ?", [1]);

// ❌ PHP null
DB::statement("UPDATE users SET deleted_at = null WHERE id = 1");
// ✅ SQL NULL
DB::statement('UPDATE users SET deleted_at = NULL WHERE id = ?', [1]);

// ❌ PHP boolean
DB::statement("UPDATE users SET active = true WHERE id = 1");
// ✅ MariaDB uses 1/0
DB::statement('UPDATE users SET active = 1 WHERE id = ?', [1]);

// ❌ String concat for IN
$ids = implode(',', $userIds);
DB::select("SELECT * FROM users WHERE id IN ({$ids})");
// ✅ Query builder
DB::table('users')->whereIn('id', $userIds)->get();
```

## MariaDB/MySQL Syntax

```sql
-- String quoting: single quotes for values, backticks for identifiers
SELECT `user`.`name` FROM `users` WHERE `name` = 'John';

-- JSON columns (MariaDB 10.2+)
SELECT JSON_VALUE(settings, '$.theme') FROM users;

-- UPSERT
INSERT INTO counters (key, value) VALUES ('visits', 1) ON DUPLICATE KEY UPDATE value = value + 1;

-- Date functions
SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## When Raw SQL is Needed

| Use case | Raw SQL needed? |
|---|---|
| Standard CRUD, filtering, joins | No — query builder |
| Complex subqueries, window functions | Yes |
| Performance-critical index hints | Yes |
| Bulk operations (INSERT...SELECT) | Yes |
| Full-text search (MATCH...AGAINST) | Yes |

## Do NOT

- Interpolate PHP variables into SQL — always parameterize.
- Use PHP syntax in raw SQL — use SQL equivalents.
- Use `float` for money — use `DECIMAL(10, 2)`.
- Forget backtick quoting for reserved words as column names.
- Use `OFFSET` for large table pagination — use cursor.
- Write raw SQL when query builder can express it clearly.
