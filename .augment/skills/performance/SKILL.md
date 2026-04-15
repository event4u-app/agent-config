---
name: performance
description: "Use when optimizing application performance — caching strategies, eager loading, query optimization, Redis patterns, or background job design."
source: package
---

# performance

## When to use

Use when optimizing slow endpoints, designing caching, or improving query performance.

Do NOT use when:
- Database schema design (use `database` skill)
- Queue job creation (use `jobs-events` skill)

## Procedure: Optimize performance

### Step 0: Identify the bottleneck

1. Don't optimize prematurely — measure first.
2. Use `DB::enableQueryLog()` or Telescope to find slow queries.
3. Check for N+1 queries on list endpoints.
4. Search for existing cache services in the project.

### Step 1: Apply the right fix

| Bottleneck | Fix |
|---|---|
| N+1 queries | Eager loading with `with()` |
| Slow queries | Add indexes, optimize (see `database` skill) |
| Repeated expensive queries | Cache with TTL |
| Blocking API calls | Queue as background job |
| Large datasets | Paginate, chunk, cursor |
| Missing counts | `withCount()` instead of loading relations |

### Step 2: Verify

Re-measure after fix. Check that cache invalidation works correctly.

## Conventions

→ See guideline `php/performance.md` for caching patterns, Redis, response time targets.

## Gotcha

- Cache invalidation bugs are worse than slow queries — don't add caching everywhere.
- Eager loading N+1 is the #1 win — always check list endpoints.
- Don't cache Eloquent collections with loaded relations — too large.
- Always include tenant ID in cache keys (multi-tenant).

## Auto-trigger keywords

- performance
- caching
- eager loading
- query optimization
- Redis
