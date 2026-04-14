---
name: performance
description: "Use when optimizing application performance — caching strategies, eager loading, query optimization, Redis patterns, or background job design."
source: package
---

# performance

## When to use

Slow endpoints, caching, query performance, Redis, queues. Before: identify bottleneck (measure first), check existing cache services, `config/horizon.php`, `config/cache.php`.

## Caching

Redis primary (cache + queues + sessions). `Cache::remember('key', TTL, fn)`, `Cache::forever()`, `Cache::forget()`. Search existing cache services first.

Invalidation: event-driven (model events), cache tags, short TTLs for frequent changes. **Multi-tenant: always include tenant ID in keys** (`customer:{$id}:...`).

## Eager loading: `with()` at query (not `$with`), `withCount()`, `load()` post-query. See `database` skill.

## Query: `count()`, `exists()`, `pluck()`, `sum()` — avoid loading models. Telescope/`DB::enableQueryLog()` for N+1 detection.

## Jobs: queue emails, API calls, heavy computation, imports. Redis + Horizon. Idempotent, minimal serialization, `failed()` method. Batching for multi-step.

## Redis: cache, queues (Horizon), rate limiting, distributed locks (`Cache::lock()`).

## Targets: API <200ms (simple), <500ms (complex). Always paginate lists.

## Gotcha: measure before optimizing, cache invalidation bugs > slow queries, N+1 = #1 win, don't cache entire collections.

## Do NOT: cache without tenant isolation, unbounded get()/all(), sync heavy compute, blind indexes, sleep() in requests.
