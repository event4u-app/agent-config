---
name: override
description: "Creates and manages project-level overrides for shared skills, rules, and commands — extending or replacing originals from .augment/ with project-specific behavior in agents/overrides/."
source: package
---

# Override Skill

## When to use

Use when creating or managing project-level overrides for shared skills, rules, commands, or guidelines — customizing `.augment/` content without modifying originals.

Do NOT use when:
- Changing shared content that should affect all projects (edit `.augment.uncompressed/` directly)
- Creating new skills from scratch (use `skill-writing` skill)

## Purpose

The `.augment/` directory is delivered as a **Composer package** and is **read-only** at project level.
It contains shared skills, rules, commands, guidelines, and templates that work across all projects.

The `agents/overrides/` directory is **project-specific** and lives in the project's own repository.
It customizes shared behavior for a particular codebase **without modifying the originals**.

**Critical rule:** Never edit files in `.augment/` to fix a project-specific need.
Changes to `.augment/` affect ALL projects. Use overrides instead.

## Procedure: Create an override

When loading any skill, rule, or command:

1. **Load the original** from `.augment/{type}/{name}`
2. **Check for override** in `agents/overrides/{type}/{name}`
3. **If override exists**, read its `Mode` header:
   - **`extend`** — Apply the original first, then layer the override on top (additive)
   - **`replace`** — Ignore the original entirely, use only the override

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

## When to Create Overrides

| Situation | Action |
|---|---|
| Shared skill doesn't match project conventions | **extend** — add project-specific rules |
| Shared command needs extra steps for this project | **extend** — inject additional steps |
| Shared rule is too strict/lenient for this project | **extend** — adjust specific rules |
| Shared guideline misses project-specific patterns | **extend** — add examples or sections |
| Shared template needs extra fields for this project | **extend** — add project-specific fields |
| Shared skill is completely wrong for this project | **replace** — write from scratch |
| Project needs behavior not in any shared skill | Create a new skill in `.augment/skills/` instead |

## When NOT to Create Overrides

- **Don't override to fix bugs in the shared package** — fix the original in the `.augment/` package repo instead
- **Don't override for temporary changes** — use branch-specific notes instead
- **Don't create empty overrides** — only create when there's actual content
- **Don't duplicate the original** — `extend` mode should only contain the delta

## Checking for Overrides (Agent Behavior)

Before executing any skill, rule, or command, agents **must**:

1. Note the original path (e.g., `.augment/skills/eloquent/SKILL.md`)
2. Check if `agents/overrides/skills/eloquent.md` exists
3. If it exists, read the `Mode` header
4. Apply accordingly:
   - `extend` → Load original, then apply override additions/changes
   - `replace` → Skip original, use override only

## Templates

Override templates are in `.augment/templates/overrides/`:

| Template | For |
|---|---|
| `rule.md` | Overriding a rule |
| `skill.md` | Overriding a skill |
| `command.md` | Overriding a command |
| `guideline.md` | Overriding a guideline |
| `template.md` | Overriding a template |

## Related

- **Commands:** `/override-create`, `/override-manage`
- **Skill:** `agent-docs-writing` (documentation hierarchy)
- **Templates:** `.augment/templates/overrides/`

### Validate

- Verify the override file exists at the correct path in `agents/overrides/`.
- Confirm the override actually takes effect (test the behavior it modifies).
- Check that the original in `.augment/` is not modified.

## Output format

1. Override file in agents/overrides/ matching the original's structure
2. Summary of what was overridden and why

## Gotcha

- Overrides are invisible to other projects — only the current project sees them.
- Replace mode discards the original entirely — use extend mode unless you need a full rewrite.
- If the override stops working after a package update, the original's structure likely changed.

## Do NOT

- Do NOT create overrides for things that should be changed in the original.
- Do NOT use replace mode when extend mode is sufficient.

## Auto-trigger keywords

- override
- project override
- extend skill
- replace skill
