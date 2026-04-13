---
type: "always"
---

# Guidelines

Coding guidelines live in `.augment/guidelines/` organized by language.
**Always check the relevant guideline** before writing or reviewing code.

## Available Guidelines

### PHP (`.augment/guidelines/php/`)

| File | Topic |
|---|---|
| `php.md` | General PHP style — strict types, naming, comparisons, early returns |
| `controllers.md` | Thin controllers, single responsibility, delegation to services |
| `eloquent.md` | Model conventions, relationships, scopes, accessors/mutators |
| `validations.md` | FormRequest patterns, custom rules, validation structure |
| `resources.md` | API Resource conventions, response structure |
| `jobs.md` | Queue job patterns, serialization, retry strategies |
| `git.md` | Branch naming, commit messages, PR conventions |
| `patterns.md` | Design patterns index (links to `patterns/` subdirectory) |

### PHP Patterns (`.augment/guidelines/php/patterns/`)

| File | Pattern |
|---|---|
| `service-layer.md` | Service classes, business logic encapsulation |
| `repositories.md` | Repository pattern, query encapsulation |
| `dtos.md` | Data Transfer Objects, SimpleDto conventions |
| `dependency-injection.md` | Constructor injection, service container |
| `events.md` | Event/Listener patterns, dispatching |
| `policies.md` | Authorization policies, gate definitions |
| `factory.md` | Factory pattern usage |
| `pipelines.md` | Laravel Pipeline pattern |
| `strategy.md` | Strategy pattern implementation |

### E2E (`.augment/guidelines/e2e/`)

Playwright best practices, Page Objects, fixtures, CI.

## How guidelines work

- **Guidelines** = coding conventions (read on demand)
- **Rules** = behavior constraints (auto-loaded)
- **Skills** = capabilities/workflows (topic-matched)

## Adding new guidelines

New language/framework → create `.augment/guidelines/{language}/`. Follow PHP structure as template.
Read specific file on demand — don't memorize full list.
