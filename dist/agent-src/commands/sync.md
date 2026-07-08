---
model_tier: medium
name: sync
disable-model-invocation: true
pack: meta
intent: "Sync dispatcher — agent settings or the managed .gitignore block"
routes_to: [sync-agent-settings, sync-gitignore, sync-gitignore-fix]
replaces: []
tier: 2
visibility: internal
description: Sync orchestrator — routes to agent-settings (template sync) and gitignore (managed block sync, plus legacy-cleanup fix)
cluster: sync
type: orchestrator
suggestion:
  eligible: false
  rationale: "Settings/file sync — must be deliberate."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /sync

Top-level orchestrator for the `/sync` family — keeping consumer-side
managed files in step with the package templates.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/sync agent-settings` | `commands/sync/agent-settings.md` | Sync `.agent-settings.yml` against the current template + profile — adds new keys, preserves user values, diff before write |
| `/sync gitignore` | `commands/sync/gitignore.md` | Sync the managed `event4u/agent-config` block in the consumer's `.gitignore` — append-only, diff before write |
| `/sync gitignore-fix` | `commands/sync/gitignore/fix.md` | Scrub legacy pre-`/agents/` patterns anywhere in the `.gitignore`, then re-sync the canonical entries |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/sync <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding sub-command file and follow its
   `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. agent-settings — sync `.agent-settings.yml` with the template
   > 2. gitignore — sync the managed `.gitignore` block (append-only)
   > 3. gitignore-fix — scrub legacy patterns + re-sync canonical entries

## Rules

- **Diff before write, always.** Every `/sync` sub-command shows the proposed
  diff and waits for approval before touching the file.
- **Do NOT chain sub-commands.** One `/sync <sub>` per turn.
- If the user invokes `/sync` with no argument, **show the menu** — do not
  guess which sub-command they meant.
