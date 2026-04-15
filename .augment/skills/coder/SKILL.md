---
name: coder
description: "Writes PHP code following project coding guidelines, SOLID principles, modern PHP best practices, and established patterns — for both legacy and Laravel projects."
source: package
---

# coder

## When to use

This skill applies to ALL code generation and editing tasks. Every other skill builds on top of this one.

Do NOT use when:
- Only reading/reviewing code (use `code-review` skill)
- Only running quality tools (use `quality-tools` skill)

## Procedure: Before writing code

### Step 0: Inspect project

1. Read `AGENTS.md` and `.github/copilot-instructions.md` for project-specific rules.
2. If working in a module (`app/Modules/*/`), check `app/Modules/{Module}/agents/` for module docs.
3. Look at neighboring files in the same directory — match the style.
4. Read `./agents/` for project-specific architecture.
5. Check `ecs.php` / `rector.php` (if they exist) — code accordingly.
6. Read `Makefile` or `Taskfile.yml` for available build/test/quality targets.

### Step 1: Detect project type

- `artisan` exists → Laravel project (Pest, Modules if present)
- No `artisan` + `composer.json` → Standalone PHP / Composer project
- Check `AGENTS.md` and `./agents/` for conventions

### Step 2: Apply conventions

→ See `php-coding` rule (always loaded) for PHP coding standards.
→ See guideline `php/php.md` for detailed PHP conventions.
→ See guideline `php/controllers.md`, `php/eloquent.md`, etc. for domain-specific conventions.

### Core principles

- **KISS** — simplest solution that works. No over-engineering.
- **YAGNI** — only build what's needed now.
- **DRY** — extract shared logic. Don't abstract prematurely.
- **SOLID** — single responsibility, depend on abstractions, small interfaces.

## Gotcha

- Don't introduce new patterns without being asked.
- Don't refactor code you're not working on.
- Use `Math` helper for ALL calculations — never raw PHP arithmetic.
- `MonitoringHelper::captureException()` for Sentry reporting.

## Auto-trigger keywords

- PHP coding
- coding standards
- SOLID
- clean code
- best practices
