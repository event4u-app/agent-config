---
name: override
description: "Creates and manages project-level overrides for shared skills, rules, and commands — extending or replacing originals from .augment/ with project-specific behavior in agents/overrides/."
source: package
---

# Override Skill

## Purpose

`.augment/` = shared (Composer package, read-only). `agents/overrides/` = project-specific. **Never edit `.augment/` for project needs.**

## Mechanism: load original → check override → `extend` (additive) or `replace` (sole source).

## Directory Structure

```
agents/overrides/
├── rules/           ← Override .augment/rules/*.md
│   └── .gitkeep
├── skills/          ← Override .augment/skills/*/SKILL.md
│   └── .gitkeep
├── commands/        ← Override .augment/commands/*.md
│   └── .gitkeep
├── guidelines/      ← Override .augment/guidelines/**/*.md
│   └── .gitkeep
└── templates/       ← Override .augment/templates/*.md
    └── .gitkeep
```

## File Naming Convention

Override files **must match the original filename** exactly:

| Original | Override |
|---|---|
| `.augment/rules/php-coding.md` | `agents/overrides/rules/php-coding.md` |
| `.augment/skills/eloquent/SKILL.md` | `agents/overrides/skills/eloquent.md` |
| `.augment/commands/feature-plan.md` | `agents/overrides/commands/feature-plan.md` |
| `.augment/guidelines/php/controllers.md` | `agents/overrides/guidelines/php-controllers.md` |
| `.augment/templates/roadmaps.md` | `agents/overrides/templates/roadmaps.md` |

**Skills** are flattened: the original lives in a directory (`skills/{name}/SKILL.md`),
but the override is a single file (`skills/{name}.md`).

**Guidelines** are flattened with a prefix: `guidelines/php/controllers.md` → `guidelines/php-controllers.md`.

**Templates** keep their original filename: `templates/roadmaps.md` → `templates/roadmaps.md`.

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

### Mode: extend

- The original is loaded first
- The override adds, modifies, or removes specific parts
- Reference original sections by heading name
- Only write what changes — everything else stays as-is

### Mode: replace

- The original is completely ignored
- The override is the sole source of truth
- Must be self-contained and complete

## When: mismatch → extend. Wrong for project → replace. Bugs → fix original. No empty/duplicate overrides, extend = delta only.

## Agent: check `agents/overrides/{type}/{name}` before executing. Templates in `.augment/templates/overrides/`.

## Related: `/override-create`, `/override-manage`, `agent-docs`

## Do NOT: override to fix shared bugs, replace when extend works.
