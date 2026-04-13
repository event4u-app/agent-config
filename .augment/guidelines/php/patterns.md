# Design Patterns

> Proven patterns for PHP / Laravel projects. Use them when they reduce complexity, not when they add it.

**Related Skills:** `php-service`, `dto-creator`, `jobs-events`, `security`, `eloquent`
**Related Rules:** `scope-control.md`, `architecture.md`

## Overview

| Pattern | Skill | When to use |
|---|---|---|
| [Service Layer / Actions](patterns/service-layer.md) | `php-service` | Business logic that doesn't belong in controllers |
| [Dependency Injection](patterns/dependency-injection.md) | `php-service` | Decouple classes from concrete implementations |
| [Strategy](patterns/strategy.md) | `coder` | Multiple interchangeable algorithms at runtime |
| [Factory](patterns/factory.md) | `coder` | Complex object creation |
| [DTOs / Value Objects](patterns/dtos.md) | `dto-creator` | Structured data instead of untyped arrays |
| [Policies](patterns/policies.md) | `security` | Centralized authorization logic |
| [Events / Listeners](patterns/events.md) | `jobs-events` | Decoupled side effects (mails, logs, syncs) |
| [Pipeline / Middleware](patterns/pipelines.md) | `laravel` | Sequential processing steps / filter chains |
| [Repository](patterns/repositories.md) | `eloquent` | Complex or reusable database queries |

## When NOT to Use Patterns

- Don't introduce a pattern for a 5-line function
- Don't create an interface if there will only ever be one implementation
- Don't use events for everything — direct calls are easier to follow
- Don't wrap simple Eloquent queries in repositories
- KISS and YAGNI always trump pattern purity
