# API Design Guidelines

> API conventions — response format, status codes, pagination, error handling, rate limiting, route naming.

**Related Skills:** `api-design`, `api-endpoint`, `api-testing`
**Related Guidelines:** [controllers.md](controllers.md), [resources.md](resources.md)

## Response Format

- **Always use API Resource classes** — never return raw models or arrays.
- **Single item:** `{ "data": { ... } }`
- **Collection:** `{ "data": [ ... ], "meta": { ... }, "links": { ... } }`

## HTTP Status Codes

| Code | When |
|---|---|
| `200` | Successful GET, PUT, PATCH |
| `201` | Successful POST (resource created) |
| `204` | Successful DELETE (no content) |
| `400` | Bad request (malformed input) |
| `401` | Unauthenticated |
| `403` | Unauthorized (forbidden) |
| `404` | Resource not found |
| `422` | Validation error |
| `429` | Rate limited |
| `500` | Server error |

## Pagination

Use Laravel's built-in pagination for list endpoints:

```php
$projects = Project::query()
    ->filter($filters)
    ->paginate(perPage: $request->integer('per_page', 15));
```

| Parameter | Default | Description |
|---|---|---|
| `page` | 1 | Current page number |
| `per_page` | 15 | Items per page |

## Filtering and Sorting

- Use the project's **filter pipeline** pattern (see `agents/docs/query-filter.md`).
- Filter classes are dedicated, testable units — not inline query logic.
- Sorting via `sort` query parameter.

## Error Responses

### Validation errors (422)

Laravel's default format:

```json
{
    "message": "The given data was invalid.",
    "errors": {
        "field": ["The field is required."]
    }
}
```

### Application errors

```json
{
    "message": "Human-readable error description."
}
```

Error format must match existing project convention — not RFC 7807 or other standards.

## Rate Limiting

```php
// bootstrap/app.php or RouteServiceProvider
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

RateLimiter::for('auth', function (Request $request) {
    return Limit::perMinute(5)->by($request->ip());
});
```

Include in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (on 429).

## Idempotency

For non-idempotent operations (POST), support idempotency keys:

```
POST /api/v1/orders
Idempotency-Key: unique-client-generated-uuid
```

## Route Naming

- Dot notation: `v1.projects.index`, `v1.projects.show`
- Route prefixes in kebab-case: `/api/v1/client-software`
- Controllers in singular: `ProjectController`
- Implicit route model binding where possible
- Scope bindings for nested resources
- Max nesting depth: 2 levels (`/users/{id}/orders/{id}`)

## Do NOT

- Return raw Eloquent models — always use API Resources.
- Put business logic in controllers — delegate to services.
- Create breaking changes in existing versions — create a new version.
- Use inconsistent response formats between endpoints.
- Expose internal IDs or database column names that should be hidden.
- Skip rate limiting on authentication endpoints.
