# Database Guidelines

> Database conventions — indexing, query optimization, migrations, transactions, multi-connection patterns.

**Related Skills:** `database`, `eloquent`, `multi-tenancy`
**Related Guidelines:** [eloquent.md](eloquent.md)

## Indexing

### When to add indexes

- Columns in `WHERE` clauses
- Columns in `JOIN` conditions
- Columns in `ORDER BY` (especially with pagination)
- Foreign key columns (Laravel adds with `foreignId()`)

### When NOT to add indexes

- Boolean columns with low selectivity (99% same value)
- Small tables (< 1000 rows)
- Frequently updated columns (indexes slow writes)

### Composite indexes

Order matters — most selective column first:

```php
$table->index(['customer_id', 'created_at']);
```

## Query Optimization

### EXPLAIN analysis

| Column | Bad value | Meaning |
|---|---|---|
| `type` | `ALL` | Full table scan — needs index |
| `rows` | High number | Too many rows examined |
| `Extra` | `Using filesort` | Sorting without index |
| `Extra` | `Using temporary` | Temp table — optimize GROUP BY/DISTINCT |
| `key` | `NULL` | No index used |

Good values: `type` = `ref`, `eq_ref`, `const`; `Extra` = `Using index`.

### Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `SELECT *` in production | Select only needed columns |
| `LIKE '%search%'` | Fulltext search or `LIKE 'search%'` |
| `OFFSET` on large tables | Cursor pagination |
| Subquery in WHERE | Rewrite as JOIN |
| `ORDER BY RAND()` | Application-level randomization |

### Pagination

Always paginate list endpoints — never `get()` on unbounded queries:

```php
// Standard
$users = User::query()->paginate(15);

// Cursor pagination for large tables
$users = User::query()->orderBy('id')->cursorPaginate(15);
```

## Migrations

- Use `php artisan make:migration` to generate.
- Use `decimal` for money — never `float`.
- Add foreign keys with `constrained()` + proper `onDelete()`.
- Always add indexes for searchable/filterable columns.
- One logical change per migration.
- Make reversible when possible (`down()` method).

### Multi-connection migrations

```php
Schema::connection('tenant_database')->create('projects', function (Blueprint $table) {
    // ...
});
```

## Transactions

```php
// Single connection
DB::transaction(function () use ($order, $items): void {
    $order->save();
    $order->items()->createMany($items);
});

// Explicit connection
DB::connection('tenant_database')->transaction(function () {
    // Tenant-specific operations
});
```

## Multi-Connection Architecture

- Always specify `$connection` on models.
- Use explicit connection in migrations targeting specific databases.
- Transactions are per-connection — cross-connection requires manual begin/commit/rollback.

## Do NOT

- Use raw SQL with user input — always parameterize.
- Use `float` for money — use `decimal`.
- Use `get()` or `all()` on large tables without pagination.
- Run migrations without specifying connection in multi-DB project.
- Add indexes without checking existing ones — duplicates waste write performance.
