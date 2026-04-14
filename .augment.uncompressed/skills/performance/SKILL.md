---
name: performance
description: "Use when optimizing application performance — caching strategies, eager loading, query optimization, Redis patterns, or background job design."
source: package
---

# performance

## When to use

Use this skill when optimizing slow endpoints, designing caching strategies, improving query performance, or working with Redis/queues.

## Before making changes

1. Identify the bottleneck — don't optimize prematurely.
2. Search for existing cache service classes in the project (e.g., `CacheService`, `CacheHelper`).
3. Read queue configuration (`config/horizon.php` or equivalent).
4. Check `config/cache.php` for cache driver setup.

## Caching

### Cache driver

- **Redis** is the primary cache driver (also used for queues and sessions).
- Configuration: `config/cache.php`, `config/database.php` (Redis connections).

### Cache patterns

```php
// Simple cache with TTL
$value = Cache::remember('key', now()->addMinutes(30), function () {
    return ExpensiveQuery::run();
});

// Cache forever (manual invalidation)
Cache::forever('key', $value);

// Invalidate
Cache::forget('key');
```

### Project cache service

Search the project for existing cache service classes before implementing your own caching patterns.

### Cache invalidation rules

- Invalidate cache when the underlying data changes.
- Use **event-driven invalidation** — listen for model events to clear related caches.
- Use **cache tags** (when supported) for group invalidation.
- Prefer **short TTLs** over complex invalidation logic when data changes frequently.

### Multi-tenant caching

**Always include the tenant/customer ID in cache keys** to prevent cross-tenant data leaks:

```php
// ✅ Correct — tenant-scoped
$key = "customer:{$customerId}:projects:count";

// ❌ Wrong — shared across tenants
$key = "projects:count";
```

## Eager loading

See `database` skill for details. Key points:

- **Always eager load** relationships used in API Resources.
- Use `with()` in the query, not in the model's `$with` property (too implicit).
- Use `withCount()` for counting related models without loading them.
- Use `load()` for lazy eager loading when the query is already executed.

## Query optimization

### Common patterns

```php
// Count without loading models
$count = Project::query()->where('status', 'active')->count();

// Exists check without loading
$exists = Project::query()->where('email', $email)->exists();

// Pluck single column
$ids = Project::query()->pluck('id');

// Aggregate without loading
$total = Order::query()->sum('amount');
```

### Avoiding N+1

Use Laravel Telescope or `DB::enableQueryLog()` during development to detect N+1 queries.

## Background jobs

### When to use queues

- **Email/notification sending** — always queue.
- **External API calls** — queue to avoid blocking requests.
- **Heavy calculations** — queue if response time matters.
- **Import/export operations** — always queue.

### Queue configuration

- **Driver:** Redis
- **Management:** Laravel Horizon (`config/horizon.php`)
- **Dashboard:** `http://localhost:8002/horizon`

### Job design

```php
// Jobs should be idempotent — safe to retry
// Jobs should serialize minimal data — resolve dependencies in handle()
// Jobs should handle failures gracefully — implement failed() method
```

### Job batching

Use job batching for complex workflows with multiple steps:

```php
Bus::batch([
    new ProcessStep1($data),
    new ProcessStep2($data),
])->dispatch();
```

## Redis patterns

- **Cache:** Standard key-value caching.
- **Queues:** Job queue backend via Horizon.
- **Rate limiting:** `RateLimiter` facade for API throttling.
- **Locks:** `Cache::lock()` for distributed locking.

## Response time targets

- **API endpoints:** < 200ms for simple CRUD, < 500ms for complex queries.
- **List endpoints:** Always paginated, with proper indexes.
- **Background jobs:** No strict time limit, but monitor via Horizon.


## Auto-trigger keywords

- performance
- caching
- eager loading
- query optimization
- Redis

## Gotcha

- Don't optimize before profiling — measure first, then optimize the actual bottleneck.
- The model tends to add caching everywhere — cache invalidation bugs are worse than slow queries.
- Eager loading N+1 queries is the #1 win — always check queries on list endpoints.
- Redis is fast but not free — don't cache entire Eloquent collections with loaded relations.

## Do NOT

- Do NOT cache without tenant isolation in multi-tenant contexts.
- Do NOT use `get()` or `all()` on large tables — paginate or chunk.
- Do NOT run heavy computations synchronously in API requests — queue them.
- Do NOT add indexes blindly — analyze query patterns first.
- Do NOT use `sleep()` or long-running loops in web requests.
- Do NOT assume cache is always available — handle cache misses gracefully.
