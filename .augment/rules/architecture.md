---
type: "auto"
alwaysApply: false
description: "Architecture rules for creating new files, classes, controllers, modules, or making structural decisions about project organization"
source: package
---

# Architecture Rules

## General Principles

- **Thin controllers** — no business logic, delegate to services
- **Single Action Controllers only** — `__invoke()`. No multi-action/resource controllers. See `.augment/guidelines/php/controllers.md`
- **Every controller needs FormRequest** — never `$request->validate()` inline
- **Services** = business logic (calculations, orchestration, validation)
- **Models** = relationships, scopes, accessors/mutators only
- Check existing directory structure before creating files
- Modern standards for **new** code only — respect existing patterns

## Project Detection

Detect project type from Git remote, directory name, or project files:
- `composer.json` → framework (Laravel, Symfony, standalone)
- `artisan` exists → Laravel
- `package.json` → frontend framework
- `AGENTS.md` / `agents/` → project docs

## Project-Specific Architecture

Read `./agents/` and `AGENTS.md` before structural decisions. Don't rely on this rule for project-specific layouts.

## Module-Level Documentation

Modules (`app/Modules/`) may have docs in `app/Modules/*/agents/`. Check module-level agent docs first.

## Packages

Packages may use `./agents/` for docs/roadmaps. Treat like projects.

## Build / Task Runner Detection

Check for `Makefile` or `Taskfile.yml`:
- `Makefile` → `make <target>`
- `Taskfile.yml` → `task <target>`

Prefer these over raw `docker compose exec`.
