---
name: agent-docs
description: "Use when reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md. Understands the full .augment/, agents/, and copilot-instructions structure."
source: package
---

# agent-docs

## When to use

Use this skill when:
- Navigating the documentation structure to find relevant information
- Creating or updating agent documentation after changes
- Setting up documentation for a new module or package
- Understanding what documentation exists and where

Do NOT use when:
- Creating code or making technical changes (use coding skills)
- Looking for coding guidelines (use `guidelines` skill)

## Documentation hierarchy

The documentation is organized in layers, from cross-project to module-specific:

### Layer 1: `.augment/` — Cross-project (identical in all repos)

```
.augment/
├── rules/          ← Always-active rules (coding, docker, scope, language, etc.)
├── commands/       ← Slash commands (fix-ci, create-pr, quality-fix, etc.)
├── skills/         ← Reusable skill definitions (coder, refactorer, etc.)
├── contexts/       ← Shared contexts about the agent system itself
├── templates/      ← Templates for features, roadmaps, contexts
└── guidelines/     ← Coding guidelines by language
    └── php/        ← PHP guidelines (controllers, eloquent, patterns, etc.)
```

**Purpose:** Universal agent behavior that applies to ALL projects and packages.
**Language:** English.
**Key rule:** This directory is **identical** across repos. Never add project-specific content here.
**Templates** are the single source of truth for document structure — never store templates in `agents/`.

### Layer 2: `AGENTS.md` — Project-level entry point

Located in the project root. Contains:
- Project description and tech stack
- Development setup (Docker, env files, Makefile targets)
- Testing conventions
- Quality tool configuration
- Links to `./agents/` for detailed docs

**Purpose:** First file an agent reads. Provides the full project context.
**Not every project has this** — packages may only have `./agents/`.

### Layer 3: `.github/copilot-instructions.md` — Coding standards

Located in `.github/`. Contains:
- Architecture rules
- PHP coding standards
- Naming conventions
- Eloquent & database rules
- API development rules

**Purpose:** Coding standards shared with GitHub Copilot and other AI tools.
**Not every project has this** — check if it exists before referencing it.

### Layer 4: `agents/overrides/` — Project-level overrides

```
agents/overrides/
├── rules/           ← Override .augment/rules/*.md
├── skills/          ← Override .augment/skills/*/SKILL.md
├── commands/        ← Override .augment/commands/*.md
├── guidelines/      ← Override .augment/guidelines/**/*.md
└── templates/       ← Override .augment/templates/*.md
```

**Purpose:** Project-specific customizations of shared `.augment/` resources (which are delivered as a package).
**Mechanism:** Each override file has a `Mode` header — `extend` (additive) or `replace` (full swap).
**Key rule:** Never modify `.augment/` directly — always use overrides for project-specific needs.
**See:** `.augment/contexts/override-system.md` for naming conventions and format.

### Layer 5: `./agents/` — Project-specific documentation

```
agents/
├── database-setup.md       ← DB architecture, connections, tenancy
├── testing.md              ← Test suites, conventions, seeders
├── dto.md                  ← DTO patterns and base classes
├── services-and-repos.md   ← Service layer conventions
├── overrides/              ← Project-level overrides (see Layer 4)
├── features/               ← Feature plans (project-wide)
│   └── {feature-name}.md
├── roadmaps/               ← Multi-step change plans
│   └── {roadmap-name}.md
│   └── current.md
└── contexts/               ← Context documents (codebase area snapshots)
    └── {context-name}.md
```

**Purpose:** Project-specific architecture, conventions, and domain knowledge.
**Structure rule:** Structural docs directly in `agents/`, features/roadmaps in subdirectories.
**Templates** live in `.augment/templates/`, NOT in `agents/` subdirectories.

### Layer 6: `app/Modules/*/agents/` — Module-specific documentation

```
app/Modules/ClientSoftware/
├── agents/
│   ├── module-description.md
│   ├── features/               ← Module-scoped feature plans
│   │   └── {feature-name}.md
│   ├── roadmaps/               ← Module-scoped roadmaps
│   │   └── {roadmap-name}.md
│   └── contexts/               ← Module-scoped context documents
│       └── {context-name}.md
└── Docs/
    └── technical-docs.md
```

**Purpose:** Documentation scoped to a specific module.
**When to create:** When a module has its own conventions, complex domain logic, or active roadmaps.

### Layer 7: `Docs/` — Technical documentation

```
Docs/                           ← Project-level technical docs
app/Modules/*/Docs/             ← Module-level technical docs
```

**Purpose:** Technical documentation for humans (setup guides, architecture diagrams, API docs).
**Difference from `agents/`:** `Docs/` is for human readers, `agents/` is optimized for AI agents.

### Layer 8: Package documentation

```
{package-root}/
├── agents/
│   ├── package-description.md
│   └── roadmaps/
└── AGENTS.md (optional)
```

**Purpose:** Same structure as projects, but for Composer packages.

## Reading order

When starting work, read documentation in this order:

1. `AGENTS.md` (if it exists) — project overview
2. `.github/copilot-instructions.md` (if it exists) — coding standards
4. `agents/overrides/` — check for project-level overrides of skills/rules/commands
5. `./agents/` — project-specific docs relevant to the task
6. `app/Modules/{Module}/agents/` — if working on a module
7. `agents/features/` or module `agents/features/` — if related feature plan exists
8. `agents/roadmaps/` or module `agents/roadmaps/` — if continuing existing work

## Procedure: Create or update agent docs

1. **Identify trigger** — What changed? (see table below)
2. **Locate target** — Find the correct file in the documentation hierarchy.
3. **Update content** — Edit or create the doc. English only in `.md` files.
4. **Verify** — Confirm the doc is consistent with surrounding files and cross-references are valid.

| Trigger | Action |
|---|---|
| New module created | Create `app/Modules/{Module}/agents/` with module description |
| Significant multi-step change | Ask user about creating a roadmap in `agents/roadmaps/` |
| New convention introduced | Update relevant doc in `./agents/` or `.augment/guidelines/` |
| Database schema changed | Update `agents/docs/database-setup.md` |

## When to update documentation

After making changes, check if docs need updating:

- **Roadmap step completed** → mark `[x]` in the roadmap file
- **Structural changes** → update affected docs in `./agents/`
- **New patterns** → update or create guideline docs

## Doc sync check (after code changes)

After completing a significant code change, run this mental checklist:

| What changed | Doc to check |
|---|---|
| Database schema (migration) | `agents/docs/database-setup.md` |
| New API endpoint | OpenAPI annotations, `AGENTS.md` API section |
| New module created | Create `app/Modules/{Module}/agents/` |
| Service/repository signature changed | Check if referenced in `agents/docs/services-and-repos.md` |
| New environment variable | `.env.example`, `AGENTS.md` environment section |
| Docker/compose change | `agents/docs/docker.md`, `Makefile` documentation |
| New Artisan command | `AGENTS.md` commands section |
| New pattern/convention introduced | Relevant guideline in `.augment/guidelines/` |

**When unsure** — ask with numbered options:
```
> 1. Yes — update the docs
> 2. No — leave as-is
```

Do NOT auto-update docs without the user's knowledge. Flag what needs updating and let the user decide.

## Rules

- All `.md` files must be in **English**.
- Do NOT create docs unless there's a real need.
- Do NOT duplicate content that's already in `AGENTS.md` or `.github/copilot-instructions.md`.
- Do NOT write docs just to document what you did — only document things others need to know.
- If unsure whether a doc needs updating, **ask the user**.

## Gotcha

- Don't create documentation files unless explicitly requested — the scope-control rule overrides this skill.
- Always check if a doc already exists before creating a new one — duplicates are worse than gaps.
- AGENTS.md and copilot-instructions.md have different audiences — don't copy content between them.
- Module docs go in `app/Modules/*/agents/`, NOT in the central `agents/` directory.

## Do NOT

- Do NOT create docs unless there's a real need (new module, significant change).
- Do NOT duplicate information already in AGENTS.md or copilot-instructions.md.
- Do NOT write docs just to document what you did — only document things others need to know.

## Auto-trigger keywords

- agent documentation
- docs structure
- when to read docs
- documentation maintenance
