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
   ├── YES → Is the target a KERNEL or safety-floor rule?
   │   ├── YES → replace → REFUSE. Report it. Keep the original.
   │   │         extend  → allowed ONLY with a registered exception (below)
   │   └── NO  → Read Mode header
   │             ├── extend  → Apply original FIRST, then layer override on top
   │             └── replace → Skip original entirely, use override only
   └── NO  → Use original unchanged
```

## The non-overridable class

```
A KERNEL OR SAFETY-FLOOR RULE MAY BE TIGHTENED, NEVER REPLACED OR RELAXED.
A `replace`-MODE OVERRIDE ON ONE IS REFUSED AND REPORTED — NEVER SILENTLY APPLIED.
AN `extend` ON ONE REQUIRES A REGISTERED, JUSTIFIED EXCEPTION.
```

The nine kernel rules — `agent-authority`, `ask-when-uncertain`, `commit-policy`,
`direct-answers`, `language-and-tone`, `no-cheap-questions`,
`non-destructive-by-default`, `scope-control`, `verify-before-complete` — plus
anything carrying `tier: safety-floor`, are not replaceable. Dropping an empty
file at `agents/overrides/rules/non-destructive-by-default.md` must not remove
the Hard Floor.

**Why not a blanket ban.** Legitimate tightening exists, and this package does
it: its own `verify-before-complete` override adds a mandatory-Playwright clause
for UI changes. Banning the name would forbid a change that makes the floor
*stronger*. So direction matters, not identity — and since no linter can prove
"relaxes" versus "legitimately narrows" from prose, `extend` is the machine-
checkable proxy for tightening and the registry carries the human judgement.

**The exception registry.** An `extend` override on a kernel or safety-floor rule
requires an entry in `agents/overrides/kernel-exceptions.yml`:

```yaml
exceptions:
  - rule: verify-before-complete
    mode: extend
    justification: "Ships a browser UI; code-only tests cannot prove what renders."
    approved_by: maintainer
```

**Honest limit — read this before trusting the class.** This is a norm with a
partial gate, and saying so is the point. The override layer is resolved by the
*agent reading these instructions*, not by a loader, so an `extend` block that
says "ignore everything above" is not mechanically detectable — and nothing here
stops a consumer relaxing a rule through another channel (a persona file,
host-level config, a direct instruction). What the gate does cover is this
package's own authoring surface: a `replace`-mode kernel override, or an
unregistered kernel exception, fails deterministically. Everything else is
reported, not claimed as enforced.

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

The original is completely ignored. The override is the sole source of truth —
**except for kernel and safety-floor rules, where `replace` is refused outright**
(see "The non-overridable class" above).

**Use when:**
- The shared skill/rule fundamentally doesn't fit the project
- The project needs a completely different workflow for a command

**Best practice:** Must be self-contained and complete. No references to the original.

**Note the update cost.** A whole-file replacement freezes that file at the
version you forked it from: later fixes to the original — including security
fixes — stop reaching you, silently, because your copy wins on name match
forever. Prefer `extend`, which keeps the rest of the original in the update
flow. This is the same silent-drift failure the deploy-tiering discussion names.

## Citation obligation

Every override carries, directly under its Mode header, one line naming what it
overrides and why:

```markdown
> Overrides: verify-before-complete §Turn-completion — ships a browser UI; code-only tests cannot prove what renders.
```

Without it the layer is usable but not auditable: a reviewer six months later
cannot tell an intentional narrowing from an accident. No reason, no override.

## Agent Behavior

Agents **must** check for overrides before applying any shared resource:

1. Before executing a skill → check `agents/overrides/skills/{name}.md`
2. Before applying a rule → check `agents/overrides/rules/{name}.md`
3. Before running a command → check `agents/overrides/commands/{name}.md`
4. Before reading a guideline → check `agents/overrides/guidelines/{lang}-{name}.md`
5. Before using a template → check `agents/overrides/templates/{name}.md`

**Before honouring an override on a rule, check the non-overridable class
first.** A `replace` on a kernel or safety-floor rule is refused and reported to
the user — it is never silently dropped and never silently applied.

## When to Create vs. When to Fix

| Situation | Action |
|---|---|
| Project needs different behavior | Create override (`agents/overrides/`) |
| Shared resource has a bug | Fix the original (in the `.augment/` package repo) |
| Temporary experiment | Use branch-specific notes, not overrides |
| New capability not in any shared resource | Create new skill/command in `.augment/` |
| Project wants to improve a shared rule/skill | Override locally + PR upstream (see below) |

## Improving Shared Rules/Skills from a Project

When a project using this package wants to **optimize** a shared rule or skill:

### Dual-write workflow

1. **Apply locally as override** — create `agents/overrides/{type}/{name}.md` with mode `replace`
   containing the full improved version. This gives the project the benefit immediately.

2. **Create PR against upstream** — submit the improvement to the shared `agent-config` package repository.
   The PR must contain:
   - **Source version** in `src/{type}/{name}`
   - **Condensed version** in `.augment/{type}/{name}`
   - Both files must be the complete, updated file (not a diff or partial)

3. **After PR is merged upstream** — remove the local override from `agents/overrides/`.
   The next package update delivers the improvement to all projects.

### Why both?

- The **override** gives the project immediate benefit without waiting for upstream merge
- The **PR** ensures the improvement flows back to all projects using the package
- After merge, the override becomes redundant and must be removed to avoid drift

### Rules for upstream PRs

- The PR must contain **both** uncondensed and condensed versions (complete files)
- The condensed version must be derived from the uncondensed version
- Changes must pass the skill linter (`./scripts-run src/scripts/skill_linter --all`)
- Changes must not be project-specific (no domain assumptions)
- Changes must pass the promotion gate (see `controlled-self-optimization.md`)

### Anti-patterns

- Keeping the override after upstream merge → causes drift
- Submitting only the condensed version → breaks source-of-truth workflow
- Submitting project-specific behavior as universal improvement
- Forgetting to create the PR → improvement stays siloed

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

- **Skill:** `override-management` — full override system documentation
- **Context:** `augment-infrastructure.md` — overall `.augment/` structure
- **Context:** `documentation-hierarchy.md` — where overrides fit in the layer model

