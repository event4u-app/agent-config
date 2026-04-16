---
name: api-endpoint
description: "Use when the user says "create endpoint", "new API route", or "add controller". Creates a complete endpoint with Controller, FormRequest, Resource, route, and OpenAPI docs."
source: package
---

# api-endpoint

## When to use

Use this skill when the user asks to create a new API endpoint, REST route, or controller action.


Do NOT use when:
- Modifying existing endpoints (use `code-refactoring` skill)
- API design decisions (use `api-design` skill)

## Procedure: Create an API endpoint

1. **Read project docs** — Check `./agents/` and `AGENTS.md` for controller conventions, resource patterns, routing.
2. **Create route** — Add to the correct `routes/api.php` or module route file.
3. **Create controller** — Thin controller, delegate logic to service.
4. **Create FormRequest** — Validate all input at the boundary.
5. **Create Resource** — Transform model output via API Resource.
6. **Verify** — Run PHPStan, run tests, confirm response shape matches conventions.

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

## Output format

1. Generated files — controller, route registration, FormRequest, Resource, Policy
2. Test file with happy path and validation error cases
3. Summary of created files and their locations

## Gotcha

- Don't forget to register the route — creating the controller without the route is a common miss.
- Always check if a similar endpoint already exists — duplicates cause confusion.
- FormRequest validation rules must match the OpenAPI schema — keep them in sync.
- The model tends to forget the `return` type on Resource `toArray()` methods.

## Do NOT

- Do NOT put business logic in controllers — delegate to services.
- Do NOT skip FormRequest validation — every controller needs a FormRequest.
- Do NOT return raw Eloquent models — always use API Resources.
- Do NOT create routes without proper authorization (Policy in FormRequest or middleware).
- Do NOT create multi-action controllers — only single-action with `__invoke()`.
- Do NOT use `response()->json()` — use `Resource::make()`.

## Auto-trigger keywords

- create endpoint
- new API route
- controller creation
- form request
- API resource
