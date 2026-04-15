---
name: api-design
description: "Use when designing a new API, planning endpoints, discussing REST conventions, adding API versions, or managing deprecation."
source: package
---

# api-design

## When to use

Use this skill when designing new API endpoints, restructuring existing APIs, or deciding about versioning and deprecation.

Do NOT use when:
- Implementing an already-designed endpoint (use `api-endpoint` skill)
- Writing tests for APIs (use `api-testing` skill)

## Before making changes

1. Read `agents/contexts/api-versioning.md` for versioning and fallback mechanism.
2. Read `agents/docs/api-resources.md` for response transformation patterns.
3. Read `agents/docs/query-filter.md` for list endpoint filtering.
4. Read `agents/docs/controller.md` for controller conventions.
5. Read guideline `php/api-design.md` for conventions (status codes, pagination, error format).

## Versioning decisions

### URL-based versioning

Routes versioned via URL prefix: `/api/v1/...`, `/api/v2/...`

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

| Change type | Action |
|---|---|
| Add optional field | Extend current version |
| Add new endpoint | Add to current version |
| Remove/rename field | New version |
| Change field type | New version |
| Change validation rules | New version |

> If an existing client would break without code changes → **new version required**.

### Deprecation workflow

1. **Mark as deprecated** — add headers: `Deprecation: true`, `Sunset: YYYY-MM-DD`, `Link: <successor>`
2. **Document** — add to API changelog with sunset date
3. **Monitor usage** — track clients still using deprecated endpoints
4. **Remove** — after sunset date, remove route + controller + docs

Minimum 3 months between deprecation and removal.

## Design review

Before presenting an API design, run the **`adversarial-review`** skill.
Focus on: Breaking changes? Consistency? Error responses?

## Gotcha

- Consistency beats "better" design — check existing patterns first.
- Always include pagination on list endpoints.
- Max nesting depth: 2 levels (`/users/{id}/orders/{id}`).
- Don't version internal APIs only your own frontend consumes.
- Deprecation without migration path is useless — always provide the replacement.
- Don't duplicate controllers for new versions — use fallback logic.

## Auto-trigger keywords

- API design
- REST API
- endpoint design
- resource structure
- response format
- API versioning
- deprecation
- breaking changes
