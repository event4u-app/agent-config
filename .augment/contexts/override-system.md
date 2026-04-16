# Context: Override System

> How project-level overrides customize shared `.augment/` behavior without modifying the package.

**Type:** Infrastructure
**Created:** 2026-03-20
**Last Updated:** 2026-03-20

## Overview

The override system allows each project to customize the shared `.augment/` package behavior.
Overrides live in `agents/overrides/` (project-specific, version-controlled) and layer on top of
the originals in `.augment/` (shared package, read-only).

## Resolution Order

When an agent loads any skill, rule, command, guideline, or template:

```
1. Load original from .augment/{type}/{name}
2. Check agents/overrides/{type}/{name} exists?
   ├── YES → Read Mode header
   │   ├── extend  → Apply original FIRST, then layer override on top
   │   └── replace → Skip original entirely, use override only
   └── NO  → Use original unchanged
```

## Directory Mapping

```
.augment/                          →  agents/overrides/
├── rules/php-coding.md            →  rules/php-coding.md
├── skills/eloquent/SKILL.md       →  skills/eloquent.md          (flattened)
├── commands/feature-plan.md       →  commands/feature-plan.md
├── guidelines/php/controllers.md  →  guidelines/php-controllers.md (flattened with prefix)
└── templates/roadmaps.md          →  templates/roadmaps.md
```

### Flattening Rules

| Original structure | Override file | Rule |
|---|---|---|
| `rules/{name}.md` | `rules/{name}.md` | Same filename |
| `skills/{name}/SKILL.md` | `skills/{name}.md` | Directory → single file |
| `commands/{name}.md` | `commands/{name}.md` | Same filename |
| `guidelines/{lang}/{file}.md` | `guidelines/{lang}-{file}.md` | Path segments joined with `-` |
| `templates/{name}.md` | `templates/{name}.md` | Same filename |

## Override File Format

Every override file **must** have this header:

```markdown
# Override: {Type} — {name}

> Override for `.augment/{path-to-original}`

---
**Mode:** `extend`
**Original:** `.augment/{path-to-original}`
---
```

## Mode: extend

The original is loaded first. The override adds, modifies, or removes specific parts.

**Use when:**
- Adding project-specific rules to a shared skill
- Injecting extra steps into a command
- Adding project-specific examples to a guideline
- Adding fields to a template

**Best practice:** Only write what changes. Reference original sections by heading name.

**Example:** A project needs stricter Eloquent rules:

```markdown
# Override: Skill — eloquent

> Override for `.augment/skills/eloquent/SKILL.md`

---
**Mode:** `extend`
**Original:** `.augment/skills/eloquent/SKILL.md`
---

## Additional Rules

- Always use `$connection` property in models (multi-tenant requirement)
- Never use `DB::table()` — always use Eloquent models
```

## Mode: replace

The original is completely ignored. The override is the sole source of truth.

**Use when:**
- The shared skill/rule fundamentally doesn't fit the project
- The project needs a completely different workflow for a command

**Best practice:** Must be self-contained and complete. No references to the original.

## Agent Behavior

Agents **must** check for overrides before applying any shared resource:

1. Before executing a skill → check `agents/overrides/skills/{name}.md`
2. Before applying a rule → check `agents/overrides/rules/{name}.md`
3. Before running a command → check `agents/overrides/commands/{name}.md`
4. Before reading a guideline → check `agents/overrides/guidelines/{lang}-{name}.md`
5. Before using a template → check `agents/overrides/templates/{name}.md`

## When to Create vs. When to Fix

| Situation | Action |
|---|---|
| Project needs different behavior | Create override (`agents/overrides/`) |
| Shared resource has a bug | Fix the original (in the `.augment/` package repo) |
| Temporary experiment | Use branch-specific notes, not overrides |
| New capability not in any shared resource | Create new skill/command in `.augment/` |
| Project wants to improve a shared rule/skill | Override locally + PR upstream (see below) |

## Improving Shared Rules/Skills from a Project

When a project wants to **optimize** a shared rule or skill:

1. **Override locally** — `agents/overrides/{type}/{name}.md` mode `replace`, full improved version
2. **PR upstream** — submit to shared `agent-config` package repository with:
   - Complete uncompressed version (`.augment.uncompressed/`)
   - Complete compressed version (`.augment/`)
   - Must pass `task lint-skills`
3. **After merge** — remove local override (package update delivers improvement)

**Why both:** Override = immediate benefit. PR = flows to all projects. After merge, override = redundant → remove.

**Anti-patterns:** Keeping override after merge (drift) · Only submitting compressed (breaks source-of-truth) · Project-specific behavior as universal

## Commands

| Command | Purpose |
|---|---|
| `/override-create` | Guided creation — picks type, lists originals, asks mode, creates file |
| `/override-manage` | Inventory, review, edit, delete, sync, upgrade existing overrides |

## Templates

Override templates in `.augment/templates/overrides/`:

| Template | For |
|---|---|
| `rule.md` | Rule overrides |
| `skill.md` | Skill overrides |
| `command.md` | Command overrides |
| `guideline.md` | Guideline overrides |
| `template.md` | Template overrides |

## Related

- **Skill:** `override` — full override system documentation
- **Context:** `augment-infrastructure.md` — overall `.augment/` structure
- **Context:** `documentation-hierarchy.md` — where overrides fit in the layer model

