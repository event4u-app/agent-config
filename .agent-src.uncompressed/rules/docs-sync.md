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

When a skill, rule, or command **reads a new setting** from `.agent-settings.yml` that does not yet
exist in `.augment/templates/agent-settings.md`:

1. **Add the key** with its default value to the template block.
2. **Add a row** to the Settings Reference table.
3. **Add a comment** above the key explaining what it does.
4. **Update the local `.agent-settings.yml`** — add the new key with its default value.
   Preserve all existing values, apply template order and comments. Follow the
   [section-aware merge rules](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
   so the user benefits immediately without running a separate command.

**This step is mandatory.** If the template gains a new key but the local `.agent-settings.yml`
is not updated, the user cannot discover the new setting exists.

## Distribution manifests and hook registries

`.augment/`-internal sync (counts, contexts, cross-refs) is one half. The
other half is **distribution manifests** that ship the package to consumers
and **hook registries** that wire engine code into platform lifecycles.
These are not auto-derived — they drift silently until CI catches them, and
on cooperative platforms (no pre-commit) they can sit broken in a branch
for hours.

When a **skill** is added, renamed, or deleted under
`.agent-src.uncompressed/skills/`:

| Manifest | Required update |
|---|---|
| `.claude-plugin/marketplace.json` | Add/remove the `./.claude/skills/<name>` entry in `plugins[0].skills[]`, alphabetical position. Caught by `scripts/lint_marketplace.py` in CI. |
| `.augment-plugin/marketplace.json` | Skill-name-agnostic — no update needed. Touch only when plugin metadata (description, tags) changes. |
| `.github/plugin/marketplace.json` | Same as above — metadata-only manifest. |

When a **hook** is added, renamed, or deleted under
`.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/`:

| Registry | Required update |
|---|---|
| `templates/scripts/work_engine/hooks/builtin/__init__.py` | New hook class → add the import + `__all__` entry. Single source of truth for engine-side registration. |
| `templates/consumer-settings/claude-settings.json` | Only when a **new platform event** is wired (e.g. first time a hook listens on `SessionEnd`). Existing hooks reuse the `./agent-config chat-history:hook --platform claude` dispatcher — no per-hook entry needed. |
| `templates/consumer-settings/augment-cli-hooks.json` | Same logic — new platform event → new `command` block; new hook on existing event → no update. |

Failure mode that motivated this section: a skill on disk without its
`marketplace.json` entry passes local edits, builds, and tests — only
CI catches it via `lint_marketplace`. The cooperative path is
"agent updates the manifest in the same response as the skill"; the
structural backstop is a pre-commit hook installed by
`scripts/install-hooks.sh` that runs `lint_marketplace` on every
commit. Run the installer once per clone; bypass for an unrelated WIP
commit is `git commit --no-verify`.

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
