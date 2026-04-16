---
type: "auto"
description: "Writing or reviewing code — check relevant guideline before writing or reviewing code"
alwaysApply: false
source: package
---

# Guidelines

Coding guidelines live in `.augment/guidelines/` organized by language.
**Check relevant guideline** before writing or reviewing code.

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

### Agent Infrastructure (`.augment/guidelines/agent-infra/`)

| File | Topic |
|---|---|
| `size-and-scope.md` | Size limits and scope boundaries for rules, skills, commands, guidelines, AGENTS.md, copilot-instructions.md |

## How guidelines work

- **Guidelines** = coding conventions (reference, on demand)
- **Rules** = behavior constraints (auto-loaded)
- **Skills** = workflows (matched by topic)

## Boundary: Guidelines vs Skills

- Guidelines = **conventions and reference**. Skills = **executable workflows**.
- Skills may reference guidelines but MUST NOT outsource core execution to them.
- If skill becomes "go read guideline" → restore workflow.

## Adding new guidelines

New language/framework → create `.augment/guidelines/{language}/`.
Follow PHP structure as template. Read on demand — don't memorize.
