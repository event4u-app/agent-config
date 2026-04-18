---
name: performance-analysis
description: "ONLY when user explicitly requests: performance audit, bottleneck analysis, or N+1 query detection. NOT for regular feature work."
source: package
---

# performance-analysis

## Mission

Find performance bottlenecks before they affect users. This skill is **proactive** — it
analyzes code for performance issues, not just responds to "it's slow" reports.

For writing performant code patterns (caching, eager loading, Redis), use the `performance` skill.
For test suite performance, use `test-performance`.

## When to use

Use this skill when:

- Auditing a codebase or flow for performance bottlenecks
- `analysis-autonomous-mode` routes here after detecting slow patterns
- Reviewing code that handles large datasets, loops, or external calls
- Investigating why a specific endpoint or job is slow

Do NOT use when:

- Writing new caching/optimization code → use `performance`
- Optimizing test suite speed → use `test-performance`
- Hunting for functional bugs → use `bug-analyzer` (proactive mode)

## Procedure: Performance analysis

### 1. Identify hotspots

Focus on code paths with high execution frequency or large data volumes:

- API endpoints called frequently (list endpoints, dashboards)
- Queue jobs processing batches
- Scheduled commands running on large datasets
- Import/export operations
- Report generation

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

### 4. Queue and job analysis

- Jobs that should be batched but run individually
- Missing `chunk()` for large dataset processing
- Retry storms from failing jobs without backoff
- Jobs that hold database connections too long
- Missing `WithoutOverlapping` for idempotency-critical jobs

### 5. Infrastructure-level checks

- Missing Redis for session/cache (using file/database driver)
- Missing CDN for static assets
- Missing response caching for read-heavy endpoints
- Database connection pooling and limits
- Queue worker concurrency vs database connection limits

## Output format

For each bottleneck:

- **Issue:** concise title
- **Location:** file, line, or endpoint
- **Severity:** Low / Medium / High / Critical
- **Impact:** estimated effect (e.g., "adds ~500ms per request", "causes N+1 on 100+ records")
- **Evidence:** code reference, query pattern, or measurement
- **Fix:** concrete optimization
- **Effort:** Low / Medium / High
- **Confidence:** Low / Medium / High

## Integration with other skills

- **analysis-autonomous-mode** — routes here when performance concerns are detected
- **performance** — complementary: performance is about writing fast code, this is about finding slow code
- **test-performance** — for test suite speed specifically
- **bug-analyzer** — some performance issues are actually bugs (N+1, infinite loops)
- **database** — for deep DB optimization guidance

## Gotcha

- Don't present raw numbers without context — "200ms" means nothing without knowing the baseline.
- The model tends to focus on code-level optimization when the bottleneck is a database query.
- Profiling in development differs from production — different data volumes, different query plans.

## Do NOT

- Do NOT micro-optimize code that runs infrequently or on small datasets
- Do NOT recommend caching without considering invalidation
- Do NOT assume bottlenecks — measure or trace the actual code path
- Do NOT confuse code style preferences with performance issues
- Do NOT recommend infrastructure changes when code fixes would suffice
