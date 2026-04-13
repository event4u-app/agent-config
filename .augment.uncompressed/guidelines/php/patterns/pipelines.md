# Pipeline / Middleware Pattern

> Sequential processing steps — already built into Laravel.

## Idea

Pass data through a series of steps (pipes), where each step can transform,
validate, or filter the data. Each pipe has a single responsibility.

## Laravel Built-in

- **HTTP Middleware** — request/response pipeline (authentication, CORS, logging)
- **Pipeline facade** — `Illuminate\Pipeline\Pipeline` for custom pipelines
- **Filter pipeline** — used in controllers for query filtering (see [controllers.md](../controllers.md))

## Typical Use Cases

✅ Request processing (middleware)
✅ Import/export data transformation
✅ Multi-step validation or enrichment
✅ Query filter chains

## Example: Custom Pipeline

```php
$result = Pipeline::send($importData)
    ->through([
        ValidateHeaders::class,
        NormalizeEncoding::class,
        MapColumns::class,
        FilterInvalidRows::class,
    ])
    ->thenReturn();
```

Each pipe implements `handle()`:

```php
final class NormalizeEncoding
{
    public function handle(ImportData $data, Closure $next): mixed
    {
        $data->normalize();
        return $next($data);
    }
}
```

## Query Filter Pipeline

Already used in this project via `paginatedPipeline`:

```php
$results = Model::query()
    ->paginatedPipeline([
        StringFilter::on('name')->isLike()->some(),
        DateFilter::on('created_at')->all(),
        OrderFilter::on(['id', 'name'])->default(['id' => 'asc']),
    ]);
```

## When NOT to Use

❌ Only 2 steps with trivial logic — sequential method calls are clearer
❌ Steps have complex dependencies on each other — pipelines assume independence

