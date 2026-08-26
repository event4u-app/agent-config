# Database Guidelines

> Database conventions — indexing, query optimization, migrations, transactions, multi-connection patterns.

**Related Skills:** `database`, `eloquent`, `multi-tenancy`
**Related Guidelines:** [eloquent.md](eloquent.md)

## Indexing

Three separate things get conflated here, and keeping them apart is what makes
the rest of this section decidable:

1. **Declaring an integrity constraint** — a uniqueness or foreign-key
   constraint. This is a correctness decision about the data model.
2. **Indexing the referencing column** — the child side of a foreign key, which
   is what makes the lookup and the constraint check fast.
3. **Adding an optional query-performance index** — everything else.

The row-count guidance below governs **(3) only**. It has never governed (1),
and it must not be read as governing (2).

### When to add indexes

- Columns in `WHERE` clauses
- Columns in `JOIN` conditions
- Columns in `ORDER BY` (especially with pagination)
- Foreign key columns (Laravel adds with `foreignId()`)
- Columns carrying a declared uniqueness constraint

### When NOT to add indexes

These apply to **optional performance indexes** — category (3) above:

- Boolean columns with low selectivity (99% same value)
- Tables that are both small (< 1000 rows) **and rarely accessed**
- Frequently updated columns (indexes slow writes)

**Row count decides nothing on its own.** A 40-row lookup table joined in every
report query and a 40-row config table read twice a week are the same size and
not the same decision — index the first on its observed access pattern, leave
the second alone. "Small" without "rarely accessed" is the folklore half of this
rule.

**Foreign-key and uniqueness indexes are created regardless of table size.**
They serve integrity and lookup latency, and a row count bears on neither. A
40-row child table pointing at a customers table gets its foreign-key column
indexed like any other. Omit one only on the strength of inspected schema
behaviour plus a representative workload measurement showing it serves no access
path — never on an anticipated write cost.

### Composite indexes

Order matters, and what decides it is the **predicate shape**, not selectivity:

1. Columns compared with **equality** (`=`, `IN`) come first.
2. Then the column compared with a **range** (`<`, `>`, `BETWEEN`, `LIKE 'x%'`).
3. Then columns the query only **orders by**.

Selectivity is a tie-break *within* a group, never the primary key of the
decision. An index cannot use any column after the first range predicate for
lookup, so a highly selective range column placed first throws away every column
behind it.

```php
// WHERE customer_id = ? AND created_at > ?  ORDER BY created_at
$table->index(['customer_id', 'created_at']);
```

`customer_id` leads because it is the **equality** predicate — not because it is
more selective. Reverse the order and the equality column sits behind a range,
where the index can no longer seek on it. That holds even when `created_at` is
the more selective of the two, which is exactly the case the folklore rule gets
wrong.

## Query Optimization

### EXPLAIN analysis

| Column | Value worth a second look | The question it raises |
|---|---|---|
| `rows` | High number | Too many rows examined |
| `Extra` | `Using filesort` | Sorting without index |
| `Extra` | `Using temporary` | Temp table — optimize GROUP BY/DISTINCT |
| `key` | `NULL` | No index used |

Good values: `type` = `ref`, `eq_ref`, `const`; `Extra` = `Using index`.

**`type = ALL` is a full table scan, and a full table scan is often the correct
plan.** It belongs in no "bad value" column, because the row itself does not
decide:

- On a table small enough to sit in a page or two, the scan is **cheaper** than
  an index lookup — the index costs a second read plus a row fetch per hit.
- On a predicate that matches a large fraction of the table, the planner picks
  the scan **on purpose**; forcing an index there is slower, and many planners
  will ignore the hint.
- On a table with hundreds of thousands of rows and a predicate matching a
  handful, `ALL` is the defect.

The question to answer is *how many rows the predicate matches, out of how
many* — not whether `type` reads `ALL`. Compare the planner's `rows` estimate
against the table's size before concluding anything.

### Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `SELECT *` in production | Select only needed columns |
| `LIKE '%search%'` | Fulltext search or `LIKE 'search%'` |
| `OFFSET` on large tables | Cursor pagination |
| `ORDER BY RAND()` | Application-level randomization |

**Subqueries in `WHERE` are not on that list**, and the unconditional "rewrite
as a JOIN" they used to carry here was wrong more often than it was right:

| The subquery is | Do |
|---|---|
| **correlated** — it references the outer row, so it re-executes per row | rewrite as a JOIN, or as a derived table joined once. This is the case the folklore rule was built for |
| an **uncorrelated `IN` / `EXISTS`** | leave it. Planners flatten these into a semi-join already, and the hand-written JOIN often introduces the duplicate rows a semi-join was avoiding |
| a **bound on the driving set** — it produces a small list the outer query then filters on | leave it. Rewriting widens the driving set, which is the opposite of the intent |

Check the plan before rewriting: if the subquery already shows as a semi-join or
a materialised derived table executed once, the rewrite buys nothing and costs
correctness.
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
- Add foreign keys with `constrained()`, and **choose** the `onDelete()` action
  rather than copying one: `cascade` when the child is expendable without its
  parent, `restrict` when the child is a record in its own right (an invoice, an
  audit row, a payment), `set null` when it survives the parent with the link
  removed — which needs a nullable column. The decision table lives in
  [`laravel-migration`](../../../src/skills/laravel-migration/SKILL.md)
  § Referential action is a decision.
- Always add indexes for searchable/filterable columns.
- One logical change per migration.
- **Declare recovery, always.** Either a `down()` that restores the prior state,
  or — when restoration is genuinely impossible — a roll-forward plan written in
  the migration file itself, naming why restoration is impossible with the
  evidence, the ordered recovery steps and their inputs, the criteria that say
  recovery succeeded, and the responsible owner. Silence is the violation, not
  the absence of `down()`. Full contract:
  [`laravel-migration`](../../../src/skills/laravel-migration/SKILL.md)
  § The recovery contract.

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
