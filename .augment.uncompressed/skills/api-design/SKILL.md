---
name: api-design
description: "Use when designing a new API, planning endpoints, discussing REST conventions, adding API versions, or managing deprecation. Covers versioning, pagination, filtering, error responses, resource structure, and deprecation workflow."
source: package
---

# api-design

## When to use

Use this skill when designing new API endpoints, restructuring existing APIs, or making decisions about response formats, versioning, pagination, or error handling.

## Before making changes

1. Read `agents/contexts/api-versioning.md` for the versioning and fallback mechanism.
2. Read `agents/docs/api-resources.md` for response transformation patterns.
3. Read `agents/docs/query-filter.md` for list endpoint filtering.
4. Read `agents/docs/controller.md` for controller conventions.

## API versioning

### URL-based versioning

Routes are versioned via URL prefix: `/api/v1/...`, `/api/v2/...`

```
routes/api/v1/projects.php  → /api/v1/projects
routes/api/v2/projects.php  → /api/v2/projects
```

### Automatic fallback

If a route doesn't exist in the requested version, the system falls back to the next older version. Configured in `config/app.php`:

```php
'api_versioning' => [
    'versions' => 'v2,v1',  // newest first
],
```

### When to create a new version

| Change type | Action | Example |
|---|---|---|
| Add optional field | Extend current version | Add `?include=comments` |
| Add new endpoint | Add to current version | `GET /api/v1/reports` |
| Remove field | New version | Remove `legacy_id` from response |
| Rename field | New version | `name` → `full_name` |
| Change field type | New version | `id: int` → `id: string` |
| Change validation | New version | Required field becomes optional |

> If an existing client would break without code changes → **new version required**.

Read `agents/contexts/api-versioning.md` for the full decision matrix.

### Deprecation workflow

1. **Mark as deprecated** — add deprecation headers:
   ```php
   return response()->json($data)
       ->header('Deprecation', 'true')
       ->header('Sunset', '2026-06-01')
       ->header('Link', '</api/v2/projects>; rel="successor-version"');
   ```
2. **Document** — add to API changelog with sunset date
3. **Monitor usage** — track which clients still use deprecated endpoints
4. **Remove** — after sunset date, remove route + controller + update docs

Give clients minimum 3 months between deprecation and removal.

## Response format

### API Resources

Always use API Resource classes for JSON responses:

```php
// Single resource
return new ProjectResource($project);

// Collection with pagination
return ProjectResource::collection($projects->paginate());
```

### Consistent structure

Responses follow a consistent envelope:
- **Single item:** `{ "data": { ... } }`
- **Collection:** `{ "data": [ ... ], "meta": { ... }, "links": { ... } }`

### HTTP status codes

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

### Standard pagination

Use Laravel's built-in pagination for list endpoints:

```php
$projects = Project::query()
    ->filter($filters)
    ->paginate(perPage: $request->integer('per_page', 15));
```

### Pagination parameters

| Parameter | Default | Description |
|---|---|---|
| `page` | 1 | Current page number |
| `per_page` | 15 | Items per page |

## Filtering and sorting

- Use the project's **filter pipeline** pattern (see `agents/docs/query-filter.md`).
- Filter classes are dedicated, testable units — not inline query logic.
- Sorting is typically handled via a `sort` query parameter.

## Error responses

### Validation errors (422)

Laravel's default validation response format:

```json
{
    "message": "The given data was invalid.",
    "errors": {
        "field": ["The field is required."]
    }
}
```

### Application errors

Use consistent error responses:

```json
{
    "message": "Human-readable error description."
}
```

## Rate limiting

### Define rate limiters

```php
// bootstrap/app.php or RouteServiceProvider
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

RateLimiter::for('auth', function (Request $request) {
    return Limit::perMinute(5)->by($request->ip());
});
```

### Apply to routes

```php
Route::middleware('throttle:api')->group(function () { ... });
Route::post('/login', LoginController::class)->middleware('throttle:auth');
```

### Rate limit headers

Include in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (on 429).

## Idempotency

For non-idempotent operations (POST), support idempotency keys:

```
POST /api/v1/orders
Idempotency-Key: unique-client-generated-uuid
```

This prevents duplicate resource creation on retries.

## Route naming

- Use dot notation: `v1.projects.index`, `v1.projects.show`
- Route prefixes in kebab-case: `/api/v1/client-software`
- Controllers in singular: `ProjectController`

## Route model binding

- Use implicit route model binding where possible.
- Scope bindings for nested resources.
- Check `agents/docs/controller.md` for binding patterns.

## Adversarial review

Before presenting an API design, run the **`adversarial-review`** skill.
Focus on the "API design" attack questions: Breaking changes? Consistency? Error responses?

## Auto-trigger keywords

- API design
- REST API
- endpoint design
- resource structure
- response format
- API versioning
- deprecation
- breaking changes

## Gotcha

- Don't design endpoints without checking existing patterns in the project — consistency beats "better" design.
- The model often forgets pagination on list endpoints — always include it.
- Don't use nested resources beyond 2 levels — `/users/{id}/orders/{id}` is the max depth.
- Error response format must match the existing project convention, not RFC 7807 or other standards.
- Don't version internal APIs that only your own frontend consumes — versioning adds complexity.
- Deprecation without a migration path is useless — always provide the replacement endpoint.
- The model tends to duplicate entire controllers for a new version instead of using fallback logic.

## Do NOT

- Do NOT return raw Eloquent models — always use API Resources.
- Do NOT put business logic in controllers — delegate to services.
- Do NOT create breaking changes in existing versions — create a new version.
- Do NOT use inconsistent response formats between endpoints.
- Do NOT expose internal IDs or database column names that should be hidden.
- Do NOT skip rate limiting on authentication endpoints.
- Do NOT return different error formats from different endpoints.
