# API Resource Guidelines

> Project-specific API Resource conventions. Base class, versioning (v1/v2), OpenAPI schemas.

**Related Skills:** `api-endpoint`, `api-design`, `openapi`
**Related Guidelines:** [controllers.md](controllers.md)

## Core Rule

**Every controller MUST return an API Resource** — never return raw arrays, models, or `response()->json()`.

## Base Class

Extend `App\Http\Resources\JsonResource` (not Laravel's base class directly).

## Resource Structure

```php
use App\Http\Resources\JsonResource;
use App\Models\ExternalCustomerDatabase\Link\Link;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'v2_Link',
    properties: [
        new IntegerProperty(property: 'id', example: 1),
        new StringProperty(property: 'text', example: 'Example link'),
    ]
)]
class LinkResource extends JsonResource
{
    /** @var Link */
    public $resource;

    public static $wrap = 'data';

    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        $link = $this->resource;

        return [
            'id' => $link->getId(),
            'text' => $link->getText(),
        ];
    }
}
```

## Required Elements

| Element | Rule |
|---|---|
| `/** @var ModelClass */` on `$resource` | Always — types the resource for PHPStan and OpenAPI |
| `public static $wrap = 'data';` | Required for v2 resources. v1 resources use `$wrap = null` |
| `#[OA\Schema(...)]` | Required — OpenAPI documentation |
| `/** @return array<string, mixed> */` | PHPDoc on `toArray()` |

## Controller Return Types

Controllers MUST type-hint the return value as the Resource class:

```php
// Single resource
public function __invoke(ShowRequest $request, Project $project): ProjectResource
{
    return ProjectResource::make($project);
}

// Collection
public function __invoke(ListRequest $request): ResourceCollection
{
    return ProjectResource::collection($projects);
}
```

## Key Conventions

- **Type `$resource`** via `@var` PHPDoc — do NOT cast inline in `toArray()`
- **Use getter methods** on the model (`$link->getId()`), not direct attribute access (`$link->id`)
- **Use `Resource::make()`** in controllers, not `new Resource()`
- **Nested resources**: use `::make()` for single items, `::collection()` for lists
- **Conditional null**: `$model->getRelation() ? RelatedResource::make($model->getRelation()) : null`

## Versioning

| Version | Property Names | `$wrap` |
|---|---|---|
| **v1** | Clean English (`number`, `status`, `title`) | `null` |
| **v2** | Legacy DB columns (`nr_lv`, `lv_status`, `bezeichnung`) | `'data'` |

## Resource Variants

| Pattern | Example | Purpose |
|---|---|---|
| `{Entity}Resource` | `ProjectResource` | Full entity |
| `{Entity}MinimalResource` | `ProjectMinimalResource` | Lightweight for lists |
| `Simple{Entity}Resource` | `SimpleUserResource` | Embedded in other resources |
| `{Entity}StatisticsResource` | `ProjectStatisticsResource` | Aggregated data |

