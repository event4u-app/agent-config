---
name: api-design
description: "Use when designing a new API, planning endpoints, or discussing REST conventions. Covers versioning, pagination, filtering, error responses, and resource structure."
source: package
---

# api-design

## When to use

API design, endpoint planning, response formats, versioning, pagination, error handling.

## Before: `agents/contexts/api-versioning.md`, `agents/docs/api-resources.md`, `agents/docs/query-filter.md`, `agents/docs/controller.md`.

## Versioning: URL prefix `/api/v1/`, `/api/v2/`. Auto-fallback to older version if route missing (`config/app.php`). Breaking change → new version. Non-breaking → extend.

## Responses: API Resource classes always. Single: `{ "data": {...} }`. Collection: `{ "data": [...], "meta": {...} }`. Status: 200/201/204/400/401/403/404/422/429/500.

## Pagination: `paginate(per_page: 15)`. Filter pipeline pattern (`query-filter.md`). Sort via `sort` param.

## Errors: 422 = `{ message, errors: { field: [...] } }`. App errors: `{ message }`.

## Rate limiting: `RateLimiter::for('api', ...)`, `throttle:api` middleware. Headers: X-RateLimit-Limit/Remaining, Retry-After.

## Idempotency: POST with `Idempotency-Key` header.

## Routes: dot notation (`v1.projects.index`), kebab-case prefixes, singular controllers, implicit model binding, max 2 nesting levels.

## Before presenting: run `adversarial-review`.

## Gotcha: check existing patterns (consistency > better), always paginate, max 2 nested levels, match existing error format.

## Do NOT: raw models (use Resources), business logic in controllers, break existing versions, inconsistent responses, expose internals, skip rate limiting on auth.
