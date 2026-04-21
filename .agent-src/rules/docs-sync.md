---
type: "auto"
description: "Keeping .augment/ contexts, counts, and cross-references in sync when creating, renaming, or deleting skills, commands, rules, guidelines, templates, or any agent infrastructure files"
source: package
---

# Docs Sync

## Rule

**CRITICAL — ZERO TOLERANCE:** When a file in `.augment/` is **created, renamed, or deleted**,
or its **name, description, scope, or counts change**, all related files **must be updated
in the same response** — not later, not in a follow-up, not when reminded.

A new rule/skill/command without its index entry, count update, and context update is **incomplete work**.

**Mandatory sequence when creating/deleting any `.augment/` file:**
1. Create/delete the file
2. **Immediately** update `contexts/augment-infrastructure.md` (counts + category tables)
3. Check cross-references in contexts and routing hints (inline "see X skill" references)

Steps 2–3 are NOT optional. Do NOT present the result to the user until all steps are done.

**Two modes:**
- **Reactive** (automatic): Triggered by add/remove/rename or scope/description/count changes → sync counts, contexts, cross-references.
- **Proactive** (on demand): Full audit → find duplicates, thin skills, redundancy, stale content → fix or merge. Ask before destructive actions.

## What to update

When a file is **added, removed, or renamed**:

| Change | Files to update |
|---|---|
| Skill/command/rule count changes | `contexts/augment-infrastructure.md` (count + category table) |
| New skill category | `contexts/augment-infrastructure.md` + `contexts/skills-and-commands.md` |
| New workflow chain | `contexts/skills-and-commands.md` (workflow chains section) |

## Cross-reference updates

When a skill is **added or its scope changes**, check and update:

| What | Where to check |
|---|---|
| Inline routing hints | "see X skill" or "use X instead" references in other skills |
| Guideline cross-references | Guidelines that reference the changed skill |
| Command skill references | Commands that use the changed skill |

## Settings template sync

When skill/rule/command reads new setting from `.agent-settings.yml` not in `templates/agent-settings.md`:

1. Add key with default to template
2. Add row to Settings Reference table
3. Add comment explaining key
4. **Update local `.agent-settings.yml`** — add new key with default, preserve existing values,
   apply template order. **Mandatory** — user can't discover new settings otherwise.

## Content consistency

**CRITICAL — MANDATORY CHECK:** When a rule, skill, or guideline's **content** is changed
(not just metadata), you MUST search for **all other rules, skills, and guidelines that cover
the same topic** and verify they are consistent.

```bash
grep -rl "TOPIC" .augment/rules/ .augment/skills/ .augment/guidelines/ --include="*.md"
```

If any file contradicts or is missing the updated information → **update it in the same response**.
Inconsistent documentation is worse than no documentation.

## Do NOT

- Do NOT rewrite entire files — only update the affected entries.
- Do NOT ask the user for permission — this is an automatic maintenance step, like updating imports.
- Do NOT skip cross-reference updates — stale links are worse than no links.
- Do NOT present a new `.augment/` file to the user without having completed all sync steps first.
- Do NOT defer sync to a "follow-up" — it must happen in the same response as the creation/deletion.
