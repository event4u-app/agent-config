# Performance Guidelines

> Performance conventions — caching, Redis, eager loading, query optimization, response time targets.

**Related Skills:** `performance`, `database`
**Related Guidelines:** [database.md](database.md), [eloquent.md](eloquent.md)

## Caching

### Cache driver

Redis is the primary cache driver (also used for queues and sessions).
Config: `config/cache.php`, `config/database.php` (Redis connections).

### Patterns

```php
// TTL-based
$value = Cache::remember('key', now()->addMinutes(30), fn () => ExpensiveQuery::run());

// Forever (manual invalidation)
Cache::forever('key', $value);

// Invalidate
Cache::forget('key');
```

### Cache invalidation

- Invalidate when underlying data changes.
- Use event-driven invalidation — model events clear related caches.
- Use cache tags (when supported) for group invalidation.
- Prefer short TTLs over complex invalidation logic.

### Multi-tenant caching

**Always include tenant/customer ID in cache keys:**

```php
// ✅ Tenant-scoped
$key = "customer:{$customerId}:projects:count";

// ❌ Shared across tenants
$key = "projects:count";
```

## Eager Loading

- Always eager load relationships used in API Resources.
- Use `with()` at query level — not `$with` model property.
- Use `withCount()` for counting without loading.
- Use `load()` for lazy eager loading.

## Query Patterns

```php
$count = Project::query()->where('status', 'active')->count();
$exists = Project::query()->where('email', $email)->exists();
$ids = Project::query()->pluck('id');
$total = Order::query()->sum('amount');
```

Use `DB::enableQueryLog()` during development to detect N+1 queries.

## Background Jobs

Queue when: email/notification sending, external API calls, heavy calculations, import/export.

## Redis Patterns

- Cache: standard key-value
- Queues: job backend via Horizon
- Rate limiting: `RateLimiter` facade
- Locks: `Cache::lock()` for distributed locking

## Response Time Targets

| Endpoint type | Target |
|---|---|
| Simple CRUD | < 200ms |
| Complex queries | < 500ms |
| List endpoints | Always paginated |
| Background jobs | No strict limit (monitor via Horizon) |

## Do NOT

- Cache without tenant isolation in multi-tenant contexts.
- Use `get()` or `all()` on large tables — paginate or chunk.
- Run heavy computation synchronously in API requests — queue it.
- Add indexes blindly — analyze query patterns first.
- Use `sleep()` or long-running loops in web requests.
- Assume cache is always available — handle misses gracefully.
