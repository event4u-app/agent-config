---
name: api-endpoint
description: "Use when the user says "create endpoint", "new API route", or "add controller". Creates a complete endpoint with Controller, FormRequest, Resource, route, and OpenAPI docs."
source: package
---

# api-endpoint

## When to use

New API endpoint/route/controller. NOT for: modifying existing (`refactorer`), design decisions (`api-design`). Before: `agents/` docs, AGENTS.md.

## Laravel projects

### What to generate

1. **Controller** — Single Action (invokable). Read `agents/docs/controller.md` and `.augment/guidelines/php/controllers.md`.
2. **FormRequest** — Validation rules, `authorize()` via policies. Read `.augment/guidelines/php/validations.md`.
3. **Resource** — JSON response transformation. Read `agents/docs/api-resources.md`.
4. **Route** — Add to the correct versioned route file.
5. **Policy** — If authorization is needed.
6. **Filter classes** — If it's a list endpoint with filtering. Read `agents/docs/query-filter.md` (if it exists).

### Conventions

- Controllers are thin — delegate to Services.
- **Every controller MUST return an API Resource** — never raw arrays, models, or `response()->json()`.
- Controllers type-hint the return value as the Resource class (e.g. `): ProjectResource`).
- Use `Resource::make()` for single items, `Resource::collection()` for lists.
- Use method injection on `__invoke()` for new controllers.
- Use DTOs for data transfer between layers.

### Show endpoint example

```php
declare(strict_types=1);

namespace App\Http\Controllers\v1\Project;

use App\Http\Controllers\Controller;
use App\Http\Requests\v1\Projects\ShowProjectRequest;
use App\Http\Resources\v1\Project\ProjectResource;
use App\Models\ExternalCustomerDatabase\Project\Project;
use App\OpenApi\Schema\Request\ShowResourceRequestSchema;
use App\OpenApi\Schema\Response\ResourceNotFoundResponse;
use App\OpenApi\Schema\Response\ShowResourceResponseSchema;

class ShowProjectController extends Controller
{
    #[ShowResourceRequestSchema(path: '/projects/{id}', version: '1', resource: ProjectResource::class)]
    #[ShowResourceResponseSchema(ProjectResource::class, wrapInDataObject: false)]
    #[ResourceNotFoundResponse(ProjectResource::class)]
    public function __invoke(ShowProjectRequest $request, Project $project): ProjectResource
    {
        return ProjectResource::make($project);
    }
}
```

### Create endpoint with service injection

```php
class CreateCustomerController extends Controller
{
    #[CreateCustomerRequestSchema(path: '/customers', version: '1', resource: CustomerResource::class)]
    #[CreateResourceResponseSchema(resource: CreatedCustomerResource::class, wrapInDataObject: false)]
    #[ValidationErrorResponse]
    public function __invoke(
        CreateCustomerRequest $request,
        CustomerModelService $customerService,
    ): CustomerResource {
        $result = $customerService->create(CreateCustomerDTO::fromRequest($request));

        return CreatedCustomerResource::make($result);
    }
}
```

### FormRequest example

```php
declare(strict_types=1);

namespace App\Http\Requests\v1\Projects;

use Illuminate\Foundation\Http\FormRequest;

class ShowProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('view', $this->route('project'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
```

### List endpoint with CollectionFormRequest

For list endpoints, extend `CollectionFormRequest` which provides `perPage`, `page`, and `orderBy` rules:

```php
use App\Contracts\Http\Requests\CollectionFormRequest;

class ListProjectsRequest extends CollectionFormRequest
{
    public string $model = Project::class;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'status' => ['sometimes', 'string'],
        ];
    }
}
```

### File locations

| Component | Path |
|---|---|
| Controller | `app/Http/Controllers/v{N}/{Domain}/{Action}{Entity}Controller.php` |
| FormRequest | `app/Http/Requests/v{N}/{Domain}/{Action}{Entity}Request.php` |
| Resource | `app/Http/Resources/v{N}/{Domain}/{Entity}Resource.php` |
| Route | `routes/api/v{N}/{domain}.php` |
| Policy | `app/Policies/{Entity}Policy.php` |

### OpenAPI documentation

Controllers use PHP 8 attributes for OpenAPI spec generation from `App\OpenApi\Schema\`:

- `ShowResourceRequestSchema`, `ListResourceRequestSchema`, `CreateResourceRequestSchema`
- `ShowResourceResponseSchema`, `ListResourceResponseSchema`, `CreateResourceResponseSchema`
- `ResourceNotFoundResponse`, `ValidationErrorResponse`

## Gotcha: register route too, check for duplicates, FormRequest↔OpenAPI sync, return type on `toArray()`.

## Do NOT: logic in controllers, skip FormRequest, raw models, skip auth, multi-action controllers, `response()->json()`.
