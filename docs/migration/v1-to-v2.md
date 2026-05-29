# Migration — v1 → v2 (npx-only runtime)

> **Status:** active. The one-shot `npx @event4u/agent-config migrate`
> is implemented in `scripts/_cli/cmd_migrate.py`; its action matrix +
> exit-code contract live in
> [`docs/contracts/migrate-command.md`](../contracts/migrate-command.md).
> This document is the user-facing narrative; the contract is the
> normative reference.

## Why this change

v2 retires the local-install scheme (Composer dependency, npm
`postinstall`, `--global` symlink namespace under `~/.claude/`,
`~/.cursor/`, `~/.codeium/windsurf/`, `~/.config/agent-config/`) in
favour of an **npx-only runtime**. The trade-off and the council's Q1
rejection + the user's override are recorded in
[`docs/architecture.md` § Distribution model](../architecture.md#distribution-model--npx-only--version-pin-governance).

## TL;DR

```bash
npx @event4u/agent-config migrate
```

One command, idempotent. Re-runs on an already-migrated repo do nothing.

## What disappears from the consumer

| Path / entry                                          | Reason                                  |
|-------------------------------------------------------|-----------------------------------------|
| `composer.json` → `require-dev.event4u/agent-config`  | No Composer dependency under v2.        |
| `composer.lock` line for `event4u/agent-config`       | Same; lockfile updated by Composer.     |
| `package.json` → `devDependencies.@event4u/agent-config` | No npm dependency under v2.          |
| `package-lock.json` / `pnpm-lock.yaml` entries        | Same.                                   |
| `node_modules/@event4u/agent-config/`                 | Removed by the package manager once the `package.json` entry is gone. |
| `vendor/event4u/agent-config/`                        | Removed by Composer once the require entry is gone. |
| `~/.claude/{rules,skills}/event4u/`                   | Retired `--global` namespace dir.       |
| `~/.cursor/rules/imported/event4u/`                   | Same.                                   |
| `~/.codeium/windsurf/global_workflows/event4u/`       | Same.                                   |
| `~/.config/agent-config/{rules,skills}/event4u/`      | Same (fallback path).                   |
| Legacy `.gitignore` block lines marked `event4u/agent-config (legacy local install)` | Replaced by the v2 block written by `sync-gitignore`. |

The retired `templates/global-install-manifest.yml` shipped inside the
package and is gone in v2; consumers never carried it directly.

## What appears in the consumer

| Path / entry                                          | Owner / shape                           |
|-------------------------------------------------------|-----------------------------------------|
| `.agent-settings.yml` → `agent_config_version: "<pin>"` | Project version pin, reviewed in PRs. |
| `.agent-settings.yml` → `update_check:` block         | Defaults shipped by `init`; opt-out per knob. |
| Updated `.gitignore` block                            | v2 entries written by `sync-gitignore`. |

The per-tool glue (`.claude/`, `.cursor/`, `.clinerules/`,
`.windsurfrules`, `GEMINI.md`, `.github/copilot-instructions.md`,
`.augment/`, `.vscode/settings.json`) keeps the same shape as v1 — only
the source that writes them changed (from `vendor/` /
`node_modules/` scripts to the npx-resolved runtime).

## The `migrate` command

```bash
npx @event4u/agent-config migrate              # apply, real changes
npx @event4u/agent-config migrate --dry-run    # plan only, zero writes
```

One opinionated command, one flag. The full action matrix +
exit-code contract is documented in
[`docs/contracts/migrate-command.md`](../contracts/migrate-command.md);
the operations summary below is the narrative form.

Order of operations (fixed; foundation-first):

1. Detect every legacy signal in one pass: `composer.json` require
   entry, `package.json` devDependency, managed symlinks pointing
   into `vendor/` / `node_modules/`, v0
   `.implement-ticket-state.json`, project-local `.agent-settings.yml`
   / `.agent-user.yml` (flat or under `settings/`), empty
   `agent-config/` shell.
2. Under `--dry-run`, print the planned change set and stop with
   exit 0.
3. Strip the package entries from `package.json` / `composer.json`
   in-place; preserve sibling keys + formatting.
4. Purge legacy symlinks; preserve user-managed symlinks elsewhere
   with a warning.
5. Migrate `.implement-ticket-state.json` → `.work-state.json`
   (renames the v0 source to `.bak`).
6. **Hard-delete** legacy project-local config files. The wizard
   (`agent-config setup`) recreates fresh global config on the next
   run — deletion is the design, not a regression.
7. Remove the empty `agent-config/` shell directory if present.
8. Refresh the `.gitignore` agent-config managed block.
9. Print a summary listing every action taken.

Idempotency: re-running on a fully-migrated repo prints
*"already migrated — nothing to do"* and exits 0 without touching
the filesystem.

## Verification after migration

```bash
npx @event4u/agent-config doctor    # P3 — runtime sanity check
```

Expected: pin resolved, no v1 markers detected, `update_check` reachable.

## v2 → v2.4 — `~/.event4u/agent-config/` namespace move

v2.4 relocates package-owned user-scope state from
`~/.config/agent-config/` to `~/.event4u/agent-config/`. Tool anchors
(`~/.claude/`, `~/.augment/`, `~/.cursor/`, `~/.codeium/windsurf/`) are
**not** moved — those belong to their host tools.

### What moves

| Old path                                            | New path                                                |
|-----------------------------------------------------|---------------------------------------------------------|
| `~/.config/agent-config/agent-settings.yml`         | `~/.event4u/agent-config/agent-settings.yml`            |
| `~/.config/agent-config/installed.lock`             | `~/.event4u/agent-config/installed.lock`                |
| `~/.config/agent-config/installed-tools.yml`        | `~/.event4u/agent-config/installed-tools.yml`           |
| `~/.config/agent-config/update-check.json`          | `~/.event4u/agent-config/update-check.json`             |
| `~/.config/agent-config/ai-council/`                | `~/.event4u/agent-config/ai-council/`                   |

### Migration — zero action required

A one-shot auto-migration shim runs on the first `init` / `update` /
`uninstall` after upgrading to ≥ 2.4:

1. If `~/.event4u/agent-config/` already exists → no-op.
2. Otherwise, copy every file from `~/.config/agent-config/` to the new
   path, preserving mtimes.
3. Drop a `MIGRATED.md` breadcrumb in the legacy dir pointing at the new
   home. Legacy files stay readable; loaders fall back to them until a
   subsequent install overwrites the new path.

Override the target dir with `EVENT4U_HOME=/some/path` if you keep a
non-standard home (`$HOME` substitute) or want to test the migration
against a sandbox.

### Claude Desktop — new bundle output

v2.4 ships a real Claude Desktop deployment instead of the
marker-only stub. Running `npx @event4u/agent-config init
--tools=claude-desktop` (or any superset that includes it) now produces
one ZIP per `.claude/skills/<name>/` under
`~/.event4u/agent-config/claude-desktop/bundles/`. Import them via
Claude Desktop → Customize → Skills → Upload. See
[`docs/setup/per-ide/claude-desktop.md`](../setup/per-ide/claude-desktop.md)
for the click-through.

## See also

- [`docs/architecture.md` § Distribution model](../architecture.md#distribution-model--npx-only--version-pin-governance) — Q1 council rejection + override + pin substitution.
- [`agents/roadmaps/road-to-portable-runtime-and-update-check.md`](../../agents/roadmaps/road-to-portable-runtime-and-update-check.md) — full delivery plan and acceptance criteria.
- [`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md`](../../agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md) — v2.4 namespace + bundle delivery plan.
- [`docs/installation.md`](../installation.md) — v2 install reference.
