# Docs Sync — mechanics

Update tables, distribution manifests, hook registries, and content
consistency check details for the
[`docs-sync`](../../../rules/docs-sync.md) rule. The Iron Rule, the
mandatory sequence, the two modes (reactive/proactive), the
settings-template sync, and the "Do NOT" list live in the rule; this
file is the lookup material when a sync trigger fires.

## What to update — count and category tables

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

## Content consistency check

When a rule, skill, or guideline's **content** is changed (not just
metadata), search for all other artefacts that cover the same topic
and verify they are consistent:

```bash
grep -rl "TOPIC" .augment/rules/ .augment/skills/ .augment/guidelines/ --include="*.md"
```

If any file contradicts or is missing the updated information →
update it in the same response. Inconsistent documentation is worse
than no documentation.
