---
name: openapi
description: "Use when writing OpenAPI/Swagger documentation — PHP attributes, project annotation patterns, or spec validation with Redocly."
---

# openapi

## When to use

Use this skill when adding or updating API documentation, writing OpenAPI annotations on controllers, or validating API specs.

## Before making changes

1. Read `agents/docs/controller.md` for OpenAPI attribute patterns used in controllers.
2. Read `agents/contexts/api-versioning.md` for how versions are reflected in the API docs.
3. Check existing controllers for annotation examples.

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

## Versioned documentation

When the API uses URL-based versioning (e.g., `/api/v1/`, `/api/v2/`):

- The version prefix is typically part of the **server URL**, not the individual endpoint paths.
- Check the OpenAPI server configuration to understand what prefix is already included.
- When creating a v2 endpoint, add new documentation — don't modify v1 docs.
- Mark deprecated endpoints with `deprecated: true`.


## Auto-trigger keywords

- OpenAPI
- Swagger
- API documentation
- PHP attributes
- Redocly

## Gotcha

- OpenAPI attributes must match the actual endpoint behavior — stale docs are worse than no docs.
- The model tends to define response schemas that don't match the Resource class output.
- Don't document internal endpoints in the public API spec.

## Do NOT

- Do NOT skip OpenAPI documentation when creating new endpoints.
- Do NOT document internal/private endpoints that are not part of the public API.
- Do NOT use docblock `@OA\` annotations when the project uses PHP 8 attributes.
- Do NOT hardcode example values that contain real customer data.
- Do NOT create documentation that contradicts the actual implementation.
