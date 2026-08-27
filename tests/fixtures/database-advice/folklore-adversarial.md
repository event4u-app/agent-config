<!-- evidence-type: analysis -->
# Adversarial fixtures — where the folklore answer is wrong

Four cases, one per passage corrected in
`docs/guidelines/php/database.md` and the migration skill. Each states the
**folklore answer** the old text produced and the **correct answer** the
corrected text must produce.

A corrected passage that cannot answer its own case with a *specific* answer is
not finished: "it depends" is not advice, and folklore at least decides.

Read by `tests/scripts/database_advice_fixtures.test.ts`, which asserts the
shipped text contains the deciding vocabulary each case needs. That is a
text-level check on OUR OWN advice, deliberately — it is not an engine
measurement, and none of these cases asserts an engine-specific or
version-specific fact.

---

## Case 1 — a range predicate must not lead the composite index

**Schema.** `orders(customer_id, created_at, status)`, 5 M rows.
**Query.** `WHERE customer_id = ? AND created_at > ? ORDER BY created_at`.
**Given.** `created_at` is the more selective of the two columns for this
workload — a typical window selects ~0.2 % of rows, while a typical
`customer_id` selects ~2 %.

- **Folklore answer:** `index(['created_at', 'customer_id'])` — most selective
  column first.
- **Correct answer:** `index(['customer_id', 'created_at'])`. The equality
  predicate leads. An index cannot seek on any column *after* the first range
  predicate, so leading with `created_at` strands `customer_id` behind a range
  and turns an equality lookup into a scan of the range.
- **Deciding vocabulary the passage must carry:** equality before range;
  selectivity as a tie-break within a group, not the primary key of the
  decision.

## Case 2 — a full scan is the cheapest plan

**Schema.** `currencies(id, code, name)`, 42 rows, one data page.
**Query.** `WHERE code = ?`.
**Given.** `EXPLAIN` reports `type = ALL`.

- **Folklore answer:** `type = ALL` is a bad value — add an index.
- **Correct answer:** leave it. The whole table is one page; an index adds a
  second read plus a row fetch to save nothing. The question is *how many rows
  the predicate matches out of how many*, not whether `type` reads `ALL`.
- **Deciding vocabulary:** `ALL` is not a defect on its own; compare the
  planner's `rows` estimate against the table size.
- **Note.** This case does **not** conflict with case 4. A performance index on
  `code` is unnecessary here; a *uniqueness constraint* on `code` is a separate,
  correctness-driven decision that this case says nothing about.

## Case 3 — a subquery that must stay a subquery

**Query.**

```sql
SELECT * FROM orders
WHERE customer_id IN (SELECT id FROM customers WHERE region = 'EU')
```

**Given.** The subquery is uncorrelated and yields ~300 ids; `orders` holds 5 M
rows.

- **Folklore answer:** rewrite as a `JOIN`.
- **Correct answer:** leave it. The planner flattens an uncorrelated `IN` into a
  semi-join already, and the hand-written `JOIN` re-introduces the duplicate
  rows the semi-join was avoiding — a customer with two matching rows would
  multiply the order rows. The subquery also bounds the driving set, which the
  rewrite widens.
- **Deciding vocabulary:** correlated → rewrite; uncorrelated `IN`/`EXISTS` →
  leave; a bound on the driving set → leave. Check the plan first.

## Case 4 — a 40-row lookup table whose foreign key is still indexed

**Schema.** `order_statuses` has 40 rows. `orders.status_id` references it, and
`orders` holds 5 M rows.

- **Folklore answer:** `order_statuses` is a small table (< 1000 rows), so skip
  the index.
- **Correct answer:** index `orders.status_id` — the **referencing** column,
  which is the child side and is not small. And the row-count guidance never
  governed constraint indexes in the first place: it governs optional
  performance indexes only.
- **Deciding vocabulary:** the three categories kept apart (declaring a
  constraint · indexing the referencing column · optional performance indexes);
  "small **and rarely accessed**", never "small" alone.
- **The trap this case exists for:** the folklore rule invites the reader to
  apply a property of the *parent* table (40 rows) to a decision about the
  *child* column (5 M rows).
