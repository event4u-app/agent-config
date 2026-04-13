---
name: api-versioning
description: "Use when adding API versioning, deprecating endpoints, or managing version fallback. Covers URL-based versioning, deprecation workflow, and changelog management."
---

# api-versioning

## When to use

Use this skill when creating new API versions, deciding whether a change is breaking,
managing deprecation, or working with the project's API fallback mechanism.


Do NOT use when:
- Non-breaking changes (just extend the current version)
- Internal API changes that have no external consumers

## Before making changes

Read `agents/contexts/api-versioning.md` for the project-specific fallback mechanism.

## Versioning strategies

### URL-based versioning (common pattern)

```
/api/v1/projects     → ProjectController (v1)
/api/v2/projects     → ProjectController (v2)
```

Routes live in `routes/api/v1/`, `routes/api/v2/`, etc.

### When to create a new version

| Change type | Action | Example |
|---|---|---|
| Add optional field | Extend current version | Add `?include=comments` |
| Add new endpoint | Add to current version | `GET /api/v1/reports` |
| Remove field | New version | Remove `legacy_id` from response |
| Rename field | New version | `name` → `full_name` |
| Change field type | New version | `id: int` → `id: string` |
| Change validation | New version | Required field becomes optional |
| Change status codes | New version | 200 → 201 for creation |

### Rule of thumb

> If an existing client would break without code changes → **new version required**.

## Deprecation workflow

### Step 1: Mark as deprecated

Add deprecation headers to the old endpoint:

```php
return response()->json($data)
    ->header('Deprecation', 'true')
    ->header('Sunset', '2026-06-01')
    ->header('Link', '</api/v2/projects>; rel="successor-version"');
```

### Step 2: Document

Add to API changelog:

```markdown
## v2 (2026-03-20)
### Breaking Changes
- `GET /api/v2/projects`: Response field `name` renamed to `full_name`.
### Deprecated (sunset: 2026-06-01)
- `GET /api/v1/projects`: Use v2 instead.
```

### Step 3: Monitor usage

Track which clients still use deprecated endpoints (via access logs or analytics).

### Step 4: Remove

After the sunset date, if no clients are using the old endpoint:
1. Remove the route.
2. Remove the controller (if not shared).
3. Update documentation.

## Automatic fallback

Some projects implement an automatic version fallback system:

```
Client requests /api/v2/projects
→ v2 route exists? Use it.
→ v2 route missing? Fall back to v1.
```

Check `agents/contexts/api-versioning.md` or the route configuration to determine
if the current project uses this pattern.

### Implications (when fallback is active)

- Not every endpoint needs a v2 — only those with breaking changes.
- New endpoints can be added in v1 and are automatically available in v2.
- When creating a v2 endpoint, the v1 version still works independently.

## Changelog format

Maintain a changelog in `docs/api-changelog.md` or equivalent:

```markdown
# API Changelog

## v2 (2026-03-20)
### New Endpoints
- `POST /api/v2/reports/generate` — async report generation
### Breaking Changes
- `GET /api/v2/projects`: `name` → `full_name`
- `POST /api/v2/projects`: `customer` (int) → `customer_id` (string UUID)
### Deprecated
- `GET /api/v1/projects` — sunset: 2026-06-01

## v1 (2024-01-15)
### Initial Release
- Full CRUD for projects, customers, users
```

## Core rules

- **Never break existing versions** — add, don't modify.
- **Check the project's versioning strategy** — URL-based is most common, but check existing routes/docs first.
- **Use deprecation headers** when sunsetting endpoints.
- **Document all breaking changes** in the changelog.
- **Give clients time** — minimum 3 months between deprecation and removal.
- **Test both versions** — ensure fallback still works correctly.


## Auto-trigger keywords

- API versioning
- version fallback
- deprecation
- API changelog
- breaking changes

## Gotcha

- Don't version internal APIs that only your own frontend consumes — versioning adds complexity.
- Deprecation without a migration path is useless — always provide the replacement endpoint.
- The model tends to duplicate entire controllers for a new version instead of using fallback logic.

## Do NOT

- Do not modify the behavior of existing versioned endpoints.
- Do not remove endpoints without a deprecation period.
- Do not create v3 if v2 hasn't been fully adopted yet.
- Do not skip the changelog for breaking changes.
- Do not assume clients will upgrade immediately.
