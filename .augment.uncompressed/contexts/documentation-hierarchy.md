# Context: Documentation Hierarchy

> The 8-layer documentation system — what lives where, reading order, and how layers interact.

**Type:** Infrastructure
**Created:** 2026-03-20
**Last Updated:** 2026-03-25

## Overview

Documentation is organized in 8 layers, from shared/cross-project to module-specific.
Each layer has a clear purpose and scope. Agents read them in order, with earlier layers
providing the foundation for later ones.

## The 8 Layers

```
Layer 1: .augment/                    ← Shared package (read-only)
Layer 2: AGENTS.md                    ← Project entry point
Layer 3: .github/copilot-instructions ← Coding standards
Layer 4: agents/overrides/            ← Project customizations of Layer 1
Layer 5: agents/                      ← Project-specific docs
Layer 6: app/Modules/*/agents/        ← Module-specific docs
Layer 7: Docs/                        ← Technical docs for humans
Layer 8: {package}/agents/            ← Package-specific docs
```

### Layer 1: `.augment/` — Shared Package

**Scope:** All projects
**Delivered as:** Composer package (read-only at project level)
**Contains:** Rules, skills, commands, guidelines, templates, contexts

This is the agent's "operating system" — universal behavior that applies everywhere.
**Never modify for project-specific needs** → use Layer 4 (overrides) instead.

### Layer 2: `AGENTS.md` — Project Entry Point

**Scope:** Single project
**Location:** Project root
**Contains:** Tech stack, setup, testing, quality tools, module overview

First file an agent reads. Provides the full project context.
Not every project has this — packages may only have `./agents/`.

### Layer 3: `.github/copilot-instructions.md` — Coding Standards

**Scope:** Single project
**Location:** `.github/`
**Contains:** Architecture rules, PHP standards, naming conventions

Shared with GitHub Copilot and other AI tools. Complements `AGENTS.md`.

### Layer 4: `agents/overrides/` — Project Customizations

**Scope:** Single project
**Location:** `agents/overrides/{rules,skills,commands,guidelines,templates}/`
**Contains:** Override files that extend or replace Layer 1 resources

The bridge between shared behavior (Layer 1) and project needs.
See `.augment/contexts/override-system.md` for naming conventions and format.

### Layer 5: `agents/` — Project-Specific Documentation

**Scope:** Single project
**Location:** `agents/`
**Contains:** Architecture docs, features, roadmaps, contexts, overrides

Project-specific knowledge that doesn't belong in the shared package.
Structural docs live directly in `agents/`, organized content in subdirectories.

### Layer 6: `app/Modules/*/agents/` — Module Documentation

**Scope:** Single module
**Location:** `app/Modules/{Module}/agents/`
**Contains:** Module description, module-scoped features, roadmaps, contexts

Created when a module has its own conventions or active development.
Roadmaps are stored in `agents/roadmaps/`.

### Layer 7: `Docs/` — Technical Documentation

**Scope:** Project or module
**Location:** `Docs/` or `app/Modules/*/Docs/`
**Contains:** Setup guides, architecture diagrams, API docs

For human readers. `agents/` is optimized for AI agents, `Docs/` for humans.

### Layer 8: Package Documentation

**Scope:** Single Composer package
**Location:** `{package-root}/agents/`
**Contains:** Package description, roadmaps

Same structure as projects, but for library packages.

## Reading Order

When starting work, agents read in this order:

| Step | Source | Purpose |
|---|---|---|
| 1 | `AGENTS.md` | Project overview |
| 2 | `.github/copilot-instructions.md` | Coding standards |
| 3 | `agents/roadmaps/` | Active roadmap context |
| 4 | `agents/overrides/` | Project customizations |
| 5 | `agents/` | Project-specific docs for the task |
| 6 | `app/Modules/{Module}/agents/` | Module docs (if working on a module) |
| 7 | `agents/features/` | Related feature plans |
| 8 | `agents/roadmaps/` | Active roadmaps |

## Layer Interactions

### Override Resolution (Layer 1 + Layer 4)

```
.augment/skills/eloquent/SKILL.md          ← Original (Layer 1)
agents/overrides/skills/eloquent.md        ← Override (Layer 4)
                                            → Merged result used by agent
```

### Context Scoping (Layer 1 vs Layer 5 vs Layer 6)

| Context location | Scope | Example |
|---|---|---|
| `.augment/contexts/` | Shared (about the agent system) | `augment-infrastructure.md` |
| `agents/contexts/` | Project-wide | `import-pipeline.md` |
| `app/Modules/*/agents/contexts/` | Module-specific | `client-api.md` |

### Template Usage (Layer 1 → Layer 5/6)

Templates in `.augment/templates/` define the structure.
Documents created from templates live in `agents/` or module `agents/`.
Overrides in `agents/overrides/` customize shared behavior per project.

## Related

- **Context:** `augment-infrastructure.md` — `.augment/` directory details
- **Context:** `override-system.md` — override naming and format
- **Context:** `skills-and-commands.md` — skill/command inventory
- **Skill:** `agent-docs` — canonical reading order and creation rules

