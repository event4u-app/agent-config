---
name: test-generator
description: "Use when the user says "write tests", "generate tests", or "test this code". Generates meaningful PHP tests focusing on business logic, edge cases, and real-world scenarios."
---

# test-generator

## When to use

Write/generate tests. NOT for: reviewing tests (`pest-testing`), E2E (`api-testing`/`playwright-testing`).

Detect: `pestphp/pest` → Pest, else PHPUnit. Match existing style.

## Test: business logic, edge cases, error paths, code branches. NOT: trivial getters, method existence, framework internals, private methods.

## Quality: descriptive names, data providers, mock externals, one concept per test, quality > quantity.

## Test suites

| Suite | Location | Purpose |
|---|---|---|
| Unit | `tests/Unit/`, `app/Modules/*/Tests/Unit/` | Isolated class tests, no DB |
| Component | `tests/Component/`, `app/Modules/*/Tests/Component/` | Tests with real DB connections |
| Integration | `tests/Integration/`, `app/Modules/*/Tests/Integration/` | Full HTTP request/response |

**Prefer integration/component tests** over unit tests. Unit tests are for pure logic only.

## Pest syntax examples

### Integration test (API endpoint)

```php
declare(strict_types=1);

use App\Models\ExternalCustomerDatabase\Project\Project;
use Database\Seeders\ApiDatabase\Customer\CustomerSeeder;
use Database\Seeders\ExternalCustomerDatabase\Project\ProjectSeeder;
use Database\Seeders\ExternalCustomerDatabase\User\UserSeeder;

use function Pest\Laravel\getJson;

function getShowProjectUrlV1(Project $project): string
{
    return route('v1.projects.show', ['project' => $project]);
}

beforeEach(function (): void {
    $this->seed([CustomerSeeder::class, UserSeeder::class, ProjectSeeder::class]);
});

it('returns a project for authenticated user', function (): void {
    authenticateAsUser();
    $project = Project::query()->first();

    getJson(getShowProjectUrlV1($project))
        ->assertOk()
        ->assertJsonStructure(['data' => ['id', 'name']]);
});

it('returns 403 for unauthorized user', function (): void {
    authenticateAsUser(role: 'viewer');
    $project = Project::query()->first();

    getJson(getShowProjectUrlV1($project))
        ->assertForbidden();
});
```

### Component test (service logic)

```php
declare(strict_types=1);

use App\Services\Project\ProjectCalculationService;

it('calculates project progress correctly', function (): void {
    $service = app(ProjectCalculationService::class);

    $result = $service->calculateProgress(completed: 3, total: 10);

    expect($result)->toBe(Math::div(3, 10) * 100);
});

it('returns zero progress when no positions exist', function (): void {
    $service = app(ProjectCalculationService::class);

    $result = $service->calculateProgress(completed: 0, total: 0);

    expect($result)->toBe(0);
});
```

### Data provider pattern

```php
it('validates status transitions', function (string $from, string $to, bool $allowed): void {
    expect(StatusTransition::isAllowed($from, $to))->toBe($allowed);
})->with([
    'draft to active' => ['draft', 'active', true],
    'active to completed' => ['active', 'completed', true],
    'completed to draft' => ['completed', 'draft', false],
]);
```

## Project-specific conventions

- **Pest** is the test framework (not PHPUnit directly).
- Use seeders for test data — factories MAY be used unless forbidden by module docs.
- Use `authenticateAsUser()` / `authenticateAsSuperUser()` helpers for auth.
- Use `Math` helper in test expectations when testing calculations.
- Do NOT use `readonly` or `final` on Pest test classes.
- Do NOT add `use` statements for global PHP classes (`DateTimeImmutable`, `Exception`, etc.).
- Use `$this->travel(5)->seconds()` for time-dependent tests — never rely on `now()` diffs.

## Gotcha

- Don't generate tests that just assert the implementation — test the behavior and edge cases.
- The model tends to create too many trivial tests (getter/setter tests, constructor tests) — focus on business logic.
- Always run generated tests immediately — the model frequently generates tests that don't compile.
- Check for existing tests before generating — don't duplicate coverage.

## Do NOT

- Do NOT generate tests without understanding the code under test.
- Do NOT create tests that only test framework behavior.
- Do NOT skip edge cases and error paths.
- Do NOT use `readonly` or `final` on test classes.
- Do NOT mark classes `final` if they need to be mocked via Mockery.


