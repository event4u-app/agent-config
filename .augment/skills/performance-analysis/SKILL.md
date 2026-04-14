---
name: performance-analysis
description: "ONLY when user explicitly requests: performance audit, bottleneck analysis, or N+1 query detection. NOT for regular feature work."
source: package
---

# performance-analysis

## When to use

Proactive bottleneck analysis, code audit for perf, large datasets/loops/external calls, slow endpoint/job investigation. NOT for: writing perf code (`performance`), test speed (`test-performance`), bugs (`bug-analyzer`).

## Workflow

### 1. Hotspots: frequent endpoints, batch jobs, scheduled commands, imports, reports.

### 2. Database query analysis

| Pattern | What to look for |
|---|---|
| **N+1 queries** | `->load()` or relationship access in loops, missing `->with()` |
| **Missing indexes** | `WHERE` clauses on unindexed columns, slow `ORDER BY` |
| **Full table scans** | `SELECT *` without `WHERE`, `LIKE '%term%'` |
| **Unnecessary queries** | Same query executed multiple times in one request |
| **Large result sets** | Loading thousands of models when only counts or IDs are needed |
| **Missing pagination** | `->get()` on unbounded queries |
| **Suboptimal joins** | Multiple queries that should be a single JOIN |
| **Transaction scope** | Transactions holding locks longer than necessary |

### 3. Application-level bottlenecks

| Pattern | What to look for |
|---|---|
| **Synchronous I/O** | HTTP calls, file operations, or API calls in the request cycle |
| **Memory bloat** | Loading entire collections when chunking would work |
| **Redundant computation** | Same calculation repeated without caching |
| **Missing cache** | Data that rarely changes but is queried on every request |
| **Stale cache** | Cache that is never invalidated or has wrong TTL |
| **Serialization overhead** | Large models serialized to JSON unnecessarily |
| **Loop inefficiency** | O(n²) patterns with nested loops or repeated array searches |

### 4. Jobs: unbatched, missing chunk(), retry storms, long-held connections, missing WithoutOverlapping.

### 5. Infra: missing Redis, CDN, response caching, connection pooling, worker concurrency limits.

## Output: Issue, Location, Severity (Low-Critical), Impact, Evidence, Fix, Effort, Confidence.

## Related: `analysis-autonomous-mode`, `performance`, `test-performance`, `bug-analyzer`, `database`.

## Gotcha: numbers without context meaningless, DB queries > code optimization, dev ≠ prod profiling.

## Do NOT: micro-optimize infrequent code, cache without invalidation plan, assume without measuring, confuse style with perf, infra changes when code suffices.
