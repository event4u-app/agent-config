---
name: coder
description: "Writes PHP code following project coding guidelines, SOLID principles, modern PHP best practices, and established patterns — for both legacy and Laravel projects."
---

# coder

## When to use

ALL code generation/editing. Base skill for all others.

## Before: AGENTS.md + copilot-instructions, module docs, neighboring files, `agents/` architecture, ECS/Rector configs, Makefile/Taskfile.

## Core principles

- **KISS** — simplest solution that works. No over-engineering.
- **YAGNI** — only build what's needed now. No speculative code.
- **DRY** — extract shared logic. But don't abstract prematurely.
- **SOLID** — single responsibility, depend on abstractions, small interfaces.

## PHP version detection

→ See the `php` skill for version detection rules. Use the lowest version from `composer.json` and `Dockerfile`.

## Modern PHP standards

- `declare(strict_types=1)` in every **new** file.
- Typed properties, parameters, and return types — always.
- Constructor property promotion where it makes sense.
- Readonly properties for immutable data.
- Enums instead of string/int constants.
- Nullsafe operator (`?->`) for optional chaining.
- Named arguments for clarity with multiple parameters.
- Match expressions over switch when appropriate.
- First-class callable syntax for callbacks.

## Code style

- **PSR-12** enforced via ECS.
- `camelCase` for variables and methods.
- `snake_case` for array keys.
- `UPPER_SNAKE_CASE` for constants.
- Single quotes for strings without interpolation.
- Prefer concatenation (`.`) for string building: `'Hello ' . $name . '!'`
- Use `sprintf()` only when concatenation becomes unreadable (many placeholders, formatting).
- Yoda comparisons: `null === $var`, not `$var === null`.
- No one-liner if statements.
- Early return over nested if/else.
- Trailing commas in multiline arrays and parameter lists.
- Short array syntax `[]`, never `array()`.

## Architecture rules

- **Controllers are thin** — no business logic, delegate to services.
- **Services contain business logic** — calculations, orchestration, validation.
- **Models have no business logic** — only relationships, scopes, accessors/mutators.
- **Repositories abstract data access** — interface + implementation pattern.
- **DTOs for structured data** — not untyped arrays.

## Project-specific rules

Each project has its own documentation in `./agents/` and/or `AGENTS.md`.
**Always read those files** before writing code for that project.

### Common across all projects

- Use `Math` helper for ALL calculations — never raw PHP arithmetic.
- `MonitoringHelper::captureException()` for Sentry reporting.
- Do NOT refactor existing code unless directly related to the current change.
- Respect existing patterns — don't modernize code you're not asked to touch.

### Project detection

Detect the project type from the **repo name**, **directory**, or **project files**:

- Check if `artisan` exists → Laravel project (use Pest/PHPUnit, Modules system if present).
- No `artisan` + `composer.json` → Standalone PHP / Composer project (check for framework).
- Check `AGENTS.md` and `./agents/` for project-specific docs and conventions.

## PHPDoc rules

- Only add PHPDoc when type hints are insufficient (e.g. generic arrays).
- Must add for iterable types: `@param array<int, MyObject> $items`.
- Do NOT add PHPDoc that just repeats the method signature.
- One docblock per method — never split into multiple `/** */` blocks.
- Tag order: `@param` before `@return` before `@throws`.

## JSON: validate before processing (`JSON_THROW_ON_ERROR`), fix malformed, pretty-print, decode to typed DTOs.

## Do NOT: `var_dump()`/`dd()`, add to PHPStan baseline, `float` for money, new patterns without request, refactor unrelated code, loose comparisons, skip types.
