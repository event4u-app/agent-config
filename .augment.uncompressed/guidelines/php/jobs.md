# Job Guidelines

> Queue job conventions. Horizon tags, uniqueness, retries, rate limiting.

**Related Skills:** `jobs-events`, `performance`
**Related Guidelines:** [patterns/service-layer.md](patterns/service-layer.md)

## Constructor

- Pass model **IDs** (not model instances) to reduce serialized job size
- Always set queue via `$this->onQueue()` — queue names from backed enums

```php
public function __construct(public int $productId)
{
    $this->onQueue(Queue::SEARCH->value);
}
```

## Tags (Horizon)

Always add `tags()` for filtering in Horizon:

```php
public function tags(): array
{
    return [
        self::class,
        Product::class . ':' . $this->productId,
    ];
}
```

## Uniqueness

- Add `uniqueId()` if the job should not run twice concurrently
- **Must** also set `$uniqueFor` to prevent stuck locks:

```php
public int $uniqueFor = 3600;

public function uniqueId(): string
{
    return (string) $this->productId;
}
```

## Error Handling & Retries

- Set `$maxExceptions` to limit unhandled exceptions before failing
- Define `backoff()` for retry intervals:

```php
public int $maxExceptions = 3;

/** @return int[] */
public function backoff(): array
{
    return [5, 10, 30];
}
```

## Rate Limiting (External APIs)

Use `WithoutOverlapping` middleware for per-customer sequential execution:

```php
public function middleware(): array
{
    return [new WithoutOverlapping($this->customerId)];
}
```

## General

- Avoid batches unless truly needed (relies on MySQL)
- Use Service classes for complex business logic inside `handle()`

