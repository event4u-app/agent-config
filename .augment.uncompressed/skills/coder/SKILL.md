---
name: coder
description: "Writes PHP code following project coding guidelines, SOLID principles, modern PHP best practices, and established patterns — for both legacy and Laravel projects."
source: package
---

# coder

## When to use

This skill applies to ALL code generation and editing tasks. It defines how code should be written in this project. Every other skill (api-endpoint, php-service, etc.) builds on top of this one.

## Before writing code

1. **Read the guidelines** — check `AGENTS.md` and `.github/copilot-instructions.md` (if it exists) for project-specific rules.
2. **Check module-level docs** — if working in a module (`app/Modules/*/`), check `app/Modules/{Module}/agents/` for module-specific docs and roadmaps.
3. **Check existing patterns** — look at neighboring files in the same directory. Match the style.
4. **Understand the architecture** — read the docs in `./agents/` for project-specific architecture.
5. **Check ECS/Rector rules** — if `config-dev/ecs.php` or `config-dev/rector.php` exist, read them and code accordingly.
6. **Check Makefile/Taskfile** — read `Makefile` or `Taskfile.yml` (if they exist) to discover available build/test/quality targets.

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

## JSON handling

When working with JSON data (API responses, config files, fixtures, test data):

- **Always validate** JSON before processing — use `json_decode()` with error checking in PHP,
  `JSON.parse()` with try/catch in JavaScript.
- **Fix malformed JSON** — trailing commas, single quotes, unquoted keys, comments.
  Clean before parsing, don't silently ignore errors.
- **Pretty-print for readability** — `JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE` in PHP,
  `JSON.stringify(data, null, 2)` in JavaScript.
- **Type safety** — decode to typed DTOs or interfaces, not untyped arrays/objects.

```php
// ✅ Safe JSON decoding in PHP
$data = json_decode($jsonString, true, 512, JSON_THROW_ON_ERROR);

// ❌ Silent failure
$data = json_decode($jsonString);
```

## What NOT to do

- Never use `var_dump()`, `print_r()`, or `dd()` — disallowed by PHPStan config. Exception: legacy projects where these are already used and no alternative is feasible.
- Never add to PHPStan baseline or ignoreErrors — fix the actual error.
- Never use `float` for money — use `decimal` or `Math` helper.
- Never introduce new patterns without being asked.
- Never refactor code you're not working on.


## Do NOT

- Do NOT use float for money — use decimal or the project's Math helper (if available).
- Do NOT use loose comparisons (== / !=) — use strict (=== / !==).
- Do NOT skip type declarations on parameters, properties, and return types.
- Do NOT use var_dump(), print_r(), or dd() in production code.

## Auto-trigger keywords

- PHP coding
- coding standards
- SOLID
- clean code
- best practices
