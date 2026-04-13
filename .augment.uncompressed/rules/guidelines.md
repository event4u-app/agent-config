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

- **Guidelines** = detailed coding conventions (reference material, read on demand)
- **Rules** = always-active behavior constraints (auto-loaded every conversation)
- **Skills** = agent capabilities and workflows (matched by topic)

Guidelines are the "how to write code" docs. Rules enforce critical subsets automatically.
Skills reference guidelines when performing related tasks.

## Adding new guidelines

When a new language or framework is introduced, create a directory:
```
.augment/guidelines/{language}/
```

Follow the existing PHP structure as a template.

Read the specific guideline file on demand — don't memorize the full list.
