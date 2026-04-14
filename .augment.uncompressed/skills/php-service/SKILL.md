---
name: php-service
description: "Use when the user says "create service", "new service class", or needs a PHP service following SOLID principles with proper DI and repository usage."
source: package
---

# php-service

## When to use

Use this skill when the user asks to create a new service, extract business logic from a controller, or refactor logic into a service layer.


Do NOT use when:
- Controllers (use `laravel` skill)
- DTOs (use `dto-creator` skill)
- Models (use `eloquent` skill)

## Architecture

```
Controller → Service → (optional) Repository (interface) → Database implementation
                ↓
              Model (Eloquent)
```

- Services contain **business logic** — calculations, orchestration, validation, side effects.
- Services may use **repository interfaces** for data access when they add value (e.g., complex/reusable queries, multiple data sources), or use Eloquent/query scopes directly when simpler and consistent with repository guidelines.
- Services are injected via **constructor injection**.

## Project-specific conventions

Read `./agents/` and `AGENTS.md` for service and repository conventions.

### Laravel projects

- Services live in `app/Services/{Domain}/` or `app/Modules/{Module}/App/Services/`.
- Constructor inject dependencies (repositories, other services).
- Methods should be focused — one responsibility per method.
- Use DTOs for structured data transfer between layers.
- For repository patterns, check `.augment/guidelines/php/patterns/repositories.md`.

### Example service

```php
declare(strict_types=1);

namespace App\Services\Project;

use App\DTO\Project\UpdateProjectDTO;
use App\Models\ExternalCustomerDatabase\Project\Project;
use App\Repositories\Project\ProjectRepository;

class ProjectService
{
    public function __construct(
        private readonly ProjectRepository $projectRepository,
        private readonly ProjectCalculationService $calculationService,
    ) {}

    public function update(Project $project, UpdateProjectDTO $dto): Project
    {
        $project->setName($dto->name);
        $project->setStatus($dto->status);

        $this->projectRepository->save($project);

        if ($dto->recalculate) {
            $this->calculationService->recalculate($project);
        }

        return $project;
    }
}
```

### Service from controller

```php
public function __invoke(
    UpdateProjectRequest $request,
    Project $project,
    ProjectService $projectService,
): ProjectResource {
    $dto = UpdateProjectDTO::fromRequest($request);
    $project = $projectService->update($project, $dto);

    return ProjectResource::make($project);
}
```

### Composer / legacy projects

- Services typically live in `core/Services/` organized by domain.
- Repositories in `core/Repository/`.
- Follow existing patterns in the same domain folder.

### All projects

- Use `Math` helper for ALL business calculations — never raw PHP arithmetic (`+`, `-`, `*`, `/`).
- New files must have `declare(strict_types=1)` and proper type hints.
- Use getters/setters on models — never magic properties.

## When to create a service

✅ Multiple steps that need orchestration (save + calculate + notify)
✅ Business rules / validation beyond FormRequest
✅ Logic reused across controllers, jobs, or commands
✅ Complex calculations or data transformations

❌ Simple CRUD — `$model->update($request->validated())` can stay in the controller
❌ One-liner logic — don't create a class for a single Eloquent call

## Gotcha

- Services must not depend on other services directly — use dependency injection via interfaces.
- The model tends to create "god services" with 10+ methods — split by responsibility.
- Don't inject the `Request` object into services — pass the specific data the service needs.

## Do NOT

- Do NOT inject too many dependencies — if >4, consider splitting the service.
- Do NOT call other services' repositories directly — go through the service.
- Do NOT put HTTP/request logic in services — services are framework-agnostic.
- Do NOT use `new Service()` — always inject via constructor.
- Do NOT add `static` methods for business logic — use instance methods.

## Auto-trigger keywords

- service class
- business logic
- service layer
- dependency injection
