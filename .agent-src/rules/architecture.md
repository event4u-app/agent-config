---
type: "auto"
alwaysApply: false
description: "Architecture rules for creating new files, classes, controllers, modules, or making structural decisions about project organization"
source: package
---

# Architecture Rules

## General Principles

- **Controllers are thin** — no business logic, delegate to services.
- **Only Single Action Controllers** — every new controller MUST use `__invoke()`. No multi-action / resource controllers. See `../../docs/guidelines/php/controllers.md` for naming conventions.
- **Every controller needs a FormRequest** — never validate inline with `$request->validate()`. Use a dedicated `FormRequest` subclass.
- **Services contain business logic** — calculations, orchestration, validation.
- **Models have no business logic** — only relationships, scopes, accessors/mutators.
- Always check the existing directory structure before creating new files.
- Respect existing patterns — apply modern standards to **new** code only.

## Project Detection

Detect the current project type from the **Git remote URL**, **directory name**, or **project files**:

- Check `composer.json` for framework (Laravel, Symfony, standalone).
- Check if `artisan` exists → Laravel project.
- Check `package.json` for frontend framework (React, Vue, Next.js, etc.).
- Check `AGENTS.md` or `agents/` for project-specific documentation.

For tooling detection (artisan vs composer), check if `artisan` exists in the project root.

## Project-Specific Architecture

Each project documents its own architecture in `./agents/` and/or `AGENTS.md`.
**Always read those files** before making structural decisions. Do not rely on this rule file
for project-specific directory layouts, database conventions, or module systems.

## Module-Level Documentation

Some projects use a module system (e.g. `app/Modules/` in Laravel projects).
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
