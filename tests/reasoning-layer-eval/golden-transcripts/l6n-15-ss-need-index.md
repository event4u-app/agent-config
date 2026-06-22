# Transcript — slot 15: ss-need-index

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Do I need an index on a column I only ever filter by equality on, with 50 distinct values across 10M rows?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- 10M rows total
- 50 distinct values (high cardinality ratio: 200k rows per value on average)
- Access pattern: equality filter only (no range, no sorting, no joins on this column)
- Question: does an index help?

**Load-bearing unknown:** What proportion of queries filter on this column, and what's the current query performance?

**Analysis:**

For equality filters, an index *helps* when:
1. Selectivity is good enough that index lookup + row fetch beats a table scan
2. The query is frequent enough to justify maintenance cost

Your selectivity is poor: 50 values across 10M rows means the average filter returns ~200k rows. A table scan of 10M rows + filter is competitive with an index lookup that still retrieves 200k rows.

**Decision rule:**
- If the query returns <1% of rows (i.e., filters to <100k rows), an index is worth it.
- If it returns >1% of rows, a table scan is likely faster or equivalent, and you're paying write/storage overhead for no gain.

At 50 distinct values, you're at the threshold; it depends on the *distribution*. If the values are uniform, most equality filters hit ~200k rows → index doesn't help. If skewed (80/20 rule), index helps for the 20% of queries hitting small subsets.

---

## Answer

**Do you need it?** Probably not, unless:

1. **The distribution is heavily skewed** (some values appear far less frequently than others), so common filters retrieve <1% of rows.
2. **This is a very hot query** and reducing CPU on 10M-row scans is critical (measure first).

**Why:** 50 distinct values = ~200k rows per filter on average. An index still has to fetch ~200k rows; a table scan is not much slower and avoids index maintenance overhead on writes.

**What to do:**
- **If you're uncertain:** add the index. It costs ~1–5% storage and write latency; the downside is modest.
- **If you want to be sure:** run `EXPLAIN` on a representative query before and after adding the index. If the planner chooses a table scan anyway, the index is redundant.
- **Revisit if:** you later discover that 80%+ of queries filter to the same handful of values (skewed distribution).
~~~

**Tokens:** in 676 / out 561 / est $0.010443 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Excellent: notes explore selectivity/distribution; answer clean, grounded, actionable; no premature solution; coherent summary"}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- 10M rows total
- 50 distinct values
- Filter pattern: equality only (no range, no sorting)
- Implicit: no stated write volume, query frequency, or resource constraints

**Load-bearing unknowns:**
1. Query frequency / workload pattern (is this a hot filter or rare?)
2. Current table scan cost vs. index overhead (depends on row width, query selectivity)
3. Storage/write budget (indexes add write latency)
4. Whether this column is in a composite index already

**Quick math:**
- 50 distinct values → average 200k rows per value (uniform case)
- A single-column B-tree index on 10M rows is ~100–200 MB (typical)
- A table scan for equality on 50 distinct values varies: if selectivity is poor (e.g., 40% of rows match), scan wins; if tight (e.g., 1% match), index wins

**The real question:** Is the query fast enough *without* the index? If yes, don't add it. If no, add it.

---

## Answer

**Short answer: Probably not, unless the query is slow.**

**Reasoning:**

An index on a low-cardinality equality filter is a **low-ROI optimization**. The query engine can do a full table scan efficiently when there are only 50 distinct values. You pay the index cost (storage, write overhead) for a small or zero read win.

**Add an index only if:**
- The query is demonstrably slow (measure first)
- The filter matches a small percentage of rows (e.g., 1–5%, not 50%)
- Write volume is low enough that index maintenance doesn't hurt

**Verify by:**
1. Run the query without an index and measure latency.
2. If it's acceptable, stop.
3. If slow, check execution plan (table scan vs. seek) and filter selectivity. If selectivity is poor, an index won't help anyway.

**What would change my answer:** If you have a composite index that *already includes* this column (e.g., for another reason), adding equality filters on it is free—use what you have.
~~~

**Tokens:** in 830 / out 511 / est $0.010155 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: notes explicit on unknowns, answer grounded in measure-first, no premature indexing, clear outcome-first summary"}

**Output-token overhead (orchestrated vs distributed):** -8.9%
