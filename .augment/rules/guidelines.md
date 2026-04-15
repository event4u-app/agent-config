---
type: "always"
description: "Coding guidelines — check relevant guideline before writing or reviewing code"
alwaysApply: true
source: package
---

# Guidelines

Coding guidelines live in `.augment/guidelines/` organized by language.
**Always check the relevant guideline** before writing or reviewing code.

## Available Guidelines

### PHP (`.augment/guidelines/php/`)

| File | Topic |
|---|---|
| `php.md` | General PHP style — strict types, naming, comparisons, early returns, JSON handling |
| `controllers.md` | Thin controllers, single responsibility, delegation to services |
| `eloquent.md` | Model conventions, relationships, scopes, accessors/mutators |
| `validations.md` | FormRequest patterns, custom rules, validation structure |
| `resources.md` | API Resource conventions, response structure |
| `jobs.md` | Queue job patterns, serialization, retry strategies |
| `git.md` | Branch naming, commit messages, PR conventions |
| `api-design.md` | API conventions — response format, status codes, pagination, error handling |
| `artisan-commands.md` | Console command conventions — naming, structure, safety, scheduling |
| `blade-ui.md` | Blade template conventions — views, components, forms, escaping |
| `database.md` | Database conventions — indexing, query optimization, migrations, transactions |
| `flux.md` | Flux UI component conventions — usage, variants, forms, Livewire integration |
| `livewire.md` | Livewire component conventions — state, actions, forms, performance, Alpine.js |
| `logging.md` | Logging conventions — levels, structured context, Sentry patterns |
| `naming.md` | Naming conventions — classes, database, routes, variables, modules, agent infra |
| `performance.md` | Performance conventions — caching, Redis, eager loading, response time targets |
| `security.md` | Security conventions — auth, authorization, SQL injection, XSS, CSRF, headers |
| `sql.md` | Raw SQL conventions — parameterization, MariaDB syntax, common mistakes |
| `websocket.md` | WebSocket conventions — Broadcasting, channel types, connection management |
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

## Boundary: Guidelines vs Skills

- Guidelines contain **conventions and reference knowledge**. Skills contain **executable workflows**.
- Skills may reference guidelines but must NOT outsource core execution steps to guidelines.
- Do NOT move a skill's operational core (procedure, validation, decision logic) into a guideline.
- If a skill becomes "go read the guideline" → restore the workflow.

## Adding new guidelines

When a new language or framework is introduced, create a directory:
```
.augment/guidelines/{language}/
```

Follow the existing PHP structure as a template.

Read the specific guideline file on demand — don't memorize the full list.
