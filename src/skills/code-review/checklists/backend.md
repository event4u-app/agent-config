# Checklist — backend / default change

Loaded on demand by [`code-review`](../SKILL.md) when the change is server-side
logic (the default when no other change-type matches). Stack-agnostic; defer
framework specifics to the carve-outs named in the skill body.

## Code quality

| Check | What to look for |
|---|---|
| **Type discipline** | New code is fully typed in the project's idiom (PHP typed properties + `declare(strict_types=1)`, TS strict, Python type hints, Go / Rust by construction). |
| **Style conformance** | Matches the project's formatter / linter output — no reformatting battles, no out-of-band style. |
| **Naming** | Clear, descriptive names; matches the dominant casing in the surrounding code. |
| **Early returns** | No deep nesting. Guard clauses at the top. |
| **Single responsibility** | Each class / module / function does one thing. HTTP handlers stay thin. |
| **No magic** | No reach-through to globals (`app()`, `$_GET`, ambient context). No untyped data shapes leaking out of the I/O boundary. |
| **Doc comments** | Only where the type system is insufficient (generics, complex shapes). No redundant docblocks. |

## Architecture

| Check | What to look for |
|---|---|
| **Layer separation** | Business logic in services / use-cases, not in HTTP handlers. Domain models stay I/O-free. |
| **Handler shape** | New handlers follow the framework's recommended shape (Laravel single-action `__invoke`, Next.js route handler, Express handler-per-route). See the stack carve-out. |
| **Input validation** | Validated at the request boundary via the framework's primitive (Laravel `FormRequest`, Zod / class-validator, Pydantic, struct-tag validators). No ad-hoc inline `if` checks. |
| **Response shaping** | Returns through a transformer / serializer / DTO. Never returns raw ORM entities. |
| **DTOs / value objects** | Structured data between layers, not raw associative arrays / `any` / `dict[str, Any]`. |
| **Dependency injection** | Constructor injection (or framework-idiomatic equivalent). No service-locator calls in business logic. |

## Security

| Check | What to look for |
|---|---|
| **Authorization** | Authz check at every state-changing endpoint (Laravel Policy, Symfony voter, NestJS guard, framework middleware). No unprotected mutating routes. |
| **Input validation** | All user input validated at the boundary via the framework's primitive. |
| **Mass assignment** | No bulk-binding raw request payloads to ORM entities without an explicit allow-list (`$fillable` / `$guarded` in Laravel, DTO mapping in TS / Python). |
| **Injection** | No raw queries / command lines / template strings with unescaped user input. |
| **Output encoding** | Template output is escaped by default; raw / unescaped output is intentional and reviewed. |
| **Sensitive data** | No secrets, tokens, or passwords in code, logs, or error responses. |

## Tests

| Check | What to look for |
|---|---|
| **Coverage** | New code paths have tests. Bug fixes have regression tests (RED → GREEN). |
| **Test quality** | Tests verify behaviour, not implementation details. |
| **Framework idiom** | Correct conventions for the project's test framework — see the stack carve-out. |
| **Test data** | Provisioned via the project's idiom (seeders, factories, fixtures, builders). |
| **Assertions** | Meaningful assertions. Not just "no exception thrown". |
| **Flaky risks** | Time-dependent tests freeze the clock (`travel()`, `jest.useFakeTimers()`, `freezegun`). |
