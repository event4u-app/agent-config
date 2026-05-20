---
type: "auto"
tier: "3"
alwaysApply: false
description: "Architecture rules for new files, classes, controllers, modules, or structural decisions about project organization"
source: package
triggers:
  - keyword: "controller"
  - keyword: "service"
  - keyword: "module"
  - intent: "structural decision"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Architecture Rules

```
HTTP HANDLERS STAY THIN. BUSINESS LOGIC LIVES IN SERVICES OR USE-CASES.
ALWAYS VALIDATE AT THE REQUEST BOUNDARY. NEVER INLINE-VALIDATE INSIDE THE HANDLER.
ALWAYS READ AGENTS.MD AND PROJECT-LOCAL DOCS BEFORE STRUCTURAL DECISIONS.
```

## General Principles

- **HTTP handlers stay thin** — no business logic; delegate to a service / use-case / domain layer.
- **Validate at the request boundary** — never inline-validate user input inside the handler. Use the framework's request-validation primitive (Laravel `FormRequest`, Symfony validator, Zod / class-validator in TS, Pydantic in Python).
- **One handler, one responsibility** — prefer single-purpose handlers over multi-action controllers when the framework supports it (Laravel `__invoke`, Next.js route handlers, Express handler-per-route).
- **Business logic lives in services / use-cases** — calculations, orchestration, cross-aggregate validation.
- **Domain models stay behavior-rich but I/O-free** — no HTTP, no DB transactions in the model; only domain rules, relationships, derived properties.
- Always check the existing directory structure before creating new files.
- Respect existing patterns — apply modern standards to **new** code only.

→ Laravel-specific patterns (FormRequest, single-action `__invoke`, Eloquent scopes): see [`laravel`](../skills/laravel/SKILL.md), [`laravel-validation`](../skills/laravel-validation/SKILL.md).
→ Symfony: see [`symfony-workflow`](../skills/symfony-workflow/SKILL.md).
→ Next.js / TypeScript backends: see [`nextjs-patterns`](../skills/nextjs-patterns/SKILL.md).

## Project Detection

Detect the current project type from the **Git remote URL**, **directory name**, or **project files**:

- **PHP** — `composer.json` (framework slot: Laravel via `artisan`, Symfony via `bin/console`, standalone otherwise).
- **JS / TS** — `package.json` (framework slot: Next.js via `next` dep, Nuxt via `nuxt`, Express / Fastify / NestJS via deps; plain Node otherwise).
- **Python** — `pyproject.toml` / `requirements.txt` (framework slot: Django via `django`, FastAPI via `fastapi`, Flask via `flask`).
- **Go** — `go.mod` (framework slot: `gin`, `echo`, `fiber`, stdlib `net/http`).
- **Ruby** — `Gemfile` (framework slot: Rails via `rails` gem, Sinatra otherwise).
- **Rust** — `Cargo.toml` (framework slot: `axum`, `actix-web`, `rocket`).
- Check `AGENTS.md` or `agents/` for project-specific documentation.

Tooling lives in a runner file at the project root — detect once and reuse the result:
`Taskfile.yml` → `task`, `Makefile` → `make`, `package.json` `scripts:` → `npm` / `pnpm` / `yarn`, `pyproject.toml` `[tool.poetry.scripts]` or `[project.scripts]` → `poetry` / `uv`, framework CLIs (`artisan`, `bin/console`, `manage.py`, `bin/rails`) when the matching manifest is present.

## Project-Specific Architecture

Each project documents its own architecture in `./agents/` and/or `AGENTS.md`.
**Always read those files** before making structural decisions. Do not rely on this rule file
for project-specific directory layouts, database conventions, or module systems.

## Architectural Decision Records (ADRs)

When a structural decision is non-trivial (kernel membership, contract change, library swap,
deprecation, scope re-cut), record it as an ADR. Use the [`adr-create`](../skills/adr-create/SKILL.md)
skill — it numbers the file (`ADR-NNN-<slug>.md`), writes the standard template
(Status / Context / Decision / Consequences / Alternatives / References), and regenerates the
index via `scripts/adr/regenerate_index.py`. ADRs land in `docs/adr/` by default; legacy
projects use `docs/decisions/`. Reversible refactors and minor cleanups do **not** need ADRs.

## Module-Level Documentation

Some projects use a module system (e.g. `app/Modules/` in Laravel, `apps/`/`packages/` in a Turborepo, `src/modules/` in NestJS, `internal/` in Go).
Modules may have their own agent docs in `app/Modules/*/agents/` with:

- Module descriptions and feature docs
- Module-specific roadmaps (`agents/roadmaps/`)
- Module-specific documentation (`Docs/`)

When working on a module, **always check for module-level agent docs** first.

## Packages

Packages (Composer, npm, etc.) may also use `./agents/` in their root
for package-specific docs and roadmaps. Treat them the same way as projects.

## Build / Task Runner Detection

Projects use either `Makefile` or `Taskfile.yml` (or both) for common commands.
**Always check which one exists** and read it to discover available targets for
testing, quality checks, container access, migrations, etc.

- `Makefile` → use `make <target>`
- `Taskfile.yml` → use `task <target>`

Prefer these targets over raw `docker compose exec` commands when available.
