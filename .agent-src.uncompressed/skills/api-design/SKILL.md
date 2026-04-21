---
name: api-design
description: "Use when designing APIs, planning endpoints, REST conventions, versioning, or deprecation — even when the user just says 'expose this as an endpoint' without naming API design."
source: package
---

# api-design

## When to use

Use this skill when designing new API endpoints, restructuring existing APIs, or deciding about versioning and deprecation.

Do NOT use when:
- Implementing an already-designed endpoint (use `api-endpoint` skill)
- Writing tests for APIs (use `api-testing` skill)

## Procedure: Design an API

1. **Gather context** — read `agents/contexts/api-versioning.md`, `agents/docs/api-resources.md`, `agents/docs/query-filter.md`, `agents/docs/controller.md`, and guideline `php/api-design.md`.
2. **Identify the resource** — determine the domain entity, its attributes, and relationships. Check existing models and resources for field naming patterns.
3. **Define endpoints** — list each endpoint with HTTP method, URL path, request body, query parameters, and response structure. Follow existing route file patterns.
4. **Decide versioning** — determine whether this extends the current version or requires a new version (see decision table below).
5. **Design error responses** — define 4xx/5xx responses matching the project's existing error format.
6. **Validate against existing patterns** — compare your design with 2-3 similar existing endpoints. Flag any inconsistencies.
7. **Run adversarial review** — use `adversarial-review` skill to check for breaking changes, consistency issues, and missing error cases.

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

## Output format

1. Endpoint specification — method, path, request/response structure
2. Versioning decision with rationale
3. Error response format following existing project patterns

## Gotcha

- Consistency beats "better" design — check existing patterns first.
- Always include pagination on list endpoints.
- Max nesting depth: 2 levels (`/users/{id}/orders/{id}`).
- Don't version internal APIs only your own frontend consumes.
- Deprecation without migration path is useless — always provide the replacement.
- Don't duplicate controllers for new versions — use fallback logic.

## Do NOT

- Do NOT introduce a new response format in an established API — match existing patterns.
- Do NOT create v2 endpoints without a deprecation plan for v1.
- Do NOT skip pagination on list endpoints.

## Auto-trigger keywords

- API design
- REST API
- endpoint design
- resource structure
- response format
- API versioning
- deprecation
- breaking changes
