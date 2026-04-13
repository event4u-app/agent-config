---
type: "auto"
description: "Keeping .augment/ contexts, counts, and cross-references in sync when creating, renaming, or deleting skills, commands, rules, guidelines, or templates"
---

# Docs Sync

## Rule

**ZERO TOLERANCE:** When `.augment/` file is **created, renamed, or deleted** (or name/description/scope/counts change), all related files **must be updated in same response**.

New rule/skill/command without index entry + count update + context update = **incomplete work**.

**Mandatory sequence:**
1. Create/delete file
2. **Immediately** update `contexts/augment-infrastructure.md` (counts + tables)
3. Check cross-references and routing hints

Steps 2–3 NOT optional. Don't present result until done.

**Modes:**
- **Reactive** (auto): add/remove/rename → sync counts, contexts, cross-refs
- **Proactive** (on demand): full audit → duplicates, thin skills, redundancy → fix/merge. Ask before destructive actions.

## What to update

| Change | Files to update |
|---|---|
| Skill/command/rule count changes | `contexts/augment-infrastructure.md` (count + table) |
| New skill category | `contexts/augment-infrastructure.md` + `contexts/skills-and-commands.md` |
| New workflow chain | `contexts/skills-and-commands.md` (workflow chains) |

## Cross-reference updates

| What | Where to check |
|---|---|
| Inline routing hints | "see X skill" / "use X instead" in other skills |
| Guideline cross-refs | Guidelines referencing changed skill |
| Command skill refs | Commands using changed skill |

## Settings template sync

When skill/rule/command reads new setting from `.agent-settings` not in `templates/agent-settings.md`:
1. Add key with default to template
2. Add row to Settings Reference table
3. Add comment explaining key

## Content consistency

**MANDATORY:** When rule/skill/guideline **content** changes, search all files covering same topic:

```bash
grep -rl "TOPIC" .augment/rules/ .augment/skills/ .augment/guidelines/ --include="*.md"
```

Contradictions → **update in same response**. Inconsistent docs worse than no docs.

## Do NOT

- Rewrite entire files — only affected entries
- Ask permission — automatic maintenance
- Skip cross-reference updates
- Present new file without completed sync
- Defer sync to follow-up
