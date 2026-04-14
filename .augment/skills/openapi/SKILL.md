---
name: openapi
description: "Use when writing OpenAPI/Swagger documentation — PHP attributes, project annotation patterns, or spec validation with Redocly."
source: package
---

# openapi

## When to use

OpenAPI docs, annotations, spec validation. Before: `agents/docs/controller.md`, `agents/contexts/api-versioning.md`, existing annotations.

## OpenAPI attributes

### Detection

Check the project for OpenAPI tooling:
- Look for `darkaonline/l5-swagger` or `vyuldashev/laravel-openapi` in `composer.json`.
- Check for `@OA\` or `#[OA\` annotations in controllers.
- Look for `config/l5-swagger.php` or similar config files.

### PHP 8 attribute syntax

Modern Laravel projects use PHP 8 attributes instead of docblock annotations:

```php
#[OA\Get(
    path: '/projects',
    summary: 'List all projects',
    tags: ['Projects'],
    parameters: [
        new OA\Parameter(
            name: 'page',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer'),
        ),
    ],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Successful operation',
        ),
    ],
)]
public function __invoke(ListProjectsRequest $request): ProjectCollection
{
    // ...
}
```

### Conventions

- Place OpenAPI attributes **directly on the controller method**.
- **Paths are relative to the server URL.** If the server is configured as `http://host/api/v1`,
  then `path: '/projects'` resolves to `/api/v1/projects`. Never repeat the server prefix in the path.
- Use **tags** matching the resource name (e.g., `Projects`, `Users`).
- Document **all parameters** — path, query, and header.
- Document **all response codes** — 200, 201, 401, 403, 404, 422.
- Use **schema references** (`$ref`) for reusable types.

## Response documentation

### Resource schemas

Define reusable schemas for API Resources:

```php
#[OA\Schema(
    schema: 'Project',
    properties: [
        new OA\Property(property: 'id', type: 'integer'),
        new OA\Property(property: 'name', type: 'string'),
        new OA\Property(property: 'status', type: 'string', enum: ['active', 'archived']),
    ],
)]
```

### Pagination schema

Document paginated responses with `meta` and `links`:

```php
#[OA\Response(
    response: 200,
    description: 'Paginated list',
    content: new OA\JsonContent(
        properties: [
            new OA\Property(property: 'data', type: 'array', items: new OA\Items(ref: '#/components/schemas/Project')),
            new OA\Property(property: 'meta', ref: '#/components/schemas/PaginationMeta'),
        ],
    ),
)]
```

## Validation with Redocly

If the project uses Redocly for OpenAPI validation:

```bash
# Validate the spec
npx @redocly/cli lint openapi.yaml

# Preview documentation
npx @redocly/cli preview-docs openapi.yaml
```

Check for `.redocly.yaml` or `redocly.yaml` config in the project root.

## Versioned: prefix in server URL, new docs for v2 (don't modify v1), `deprecated: true`.

## Gotcha: match actual behavior (stale > none), response schemas ↔ Resource class, no internal endpoints in public spec.

## Do NOT: skip docs for new endpoints, document internal, docblock `@OA\` when project uses attributes, real customer data in examples, docs ≠ implementation.
