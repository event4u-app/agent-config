---
stability: beta
keep-beta-until: 2026-09-04
---

# `agent-config migrate` — Behavior Contract

> **Status:** active · **Owner:** maintainer (`src/scripts/_cli/cmd_migrate.py`) · **Opened:** 2026-05-29
>
> Source: `road-to-one-migrate-command.md` Phase 1. Locks the union of
> cleanup actions performed by the unified `./agent-config migrate`
> command and codifies the **deletion-over-migration** policy: the
> wizard recreates fresh project config, so legacy project-local state
> is hard-deleted rather than preserved or relocated.

## Design intent

One opinionated command runs every cleanup step end-to-end. No flag
matrix to pick between behaviors, no surprises. The flags are
`--dry-run` (preview vs. apply), `--check` (read-only probe with a
verdict in the exit code), and `--from {4,5}` (advisory source-major
declaration — 4.x = composer-era, 5.x = npx-era). The legacy
three-command surface — `migrate`, `migrate-state`, `migrate-to-global`
— is collapsed into one entry point.

Rationale:

- **One mental model.** The legacy split forced the user to remember
  which slice each command performed. A single opinionated command
  removes that cognitive load.
- **Deletion over preservation.** The new wizard
  (`agent-config setup`) recreates fresh project / global config on
  next run. Preserving stale `.agent-settings.yml` only carries
  forward old values the user already chose to leave behind.
- **No setup-migration.** Project-local config is deleted; global
  config is recreated fresh by the wizard. Different paths into the
  same end state, but the deletion path requires no decisions from
  the agent at migrate time.

## Input signals — what counts as "needs migration"

The command considers a consumer repo migratable when **any** of
these are detected. The full set is the disjunction below; any one
hit triggers the apply path.

| # | Signal | Source |
|---|---|---|
| 1 | `@event4u/agent-config` entry in `package.json` `dependencies` or `devDependencies` | npm install era |
| 2 | `event4u/agent-config` entry in `composer.json` `require` or `require-dev` | Composer install era |
| 3 | Managed symlink (`.augment`, `.claude`, `.cursor`, `.clinerules`, `.windsurfrules`) pointing into `vendor/` or `node_modules/` | composer / npm install layout |
| 4 | `.implement-ticket-state.json` file present at project root (v0 work-engine state) | pre-v1 engine schema |
| 5 | `.agent-settings.yml` at project root (legacy project-local config) | pre-global-only consumer surface |
| 6 | `.agent-user.yml` at project root (legacy project-local user prefs) | pre-global-only consumer surface |
| 7 | `settings/.agent-settings.yml` or `settings/.agent-user.yml` (typed-subdir variant) | pre-global-only typed-subdir layout |
| 8 | Empty `agent-config/` shell directory at project root | leftover from removed `composer/npm` install |

The detector returns "already migrated" (exit 0, no writes) when
none of the signals fire.

## Output state — what the consumer looks like post-migration

After `./agent-config migrate` (real apply) returns 0, the consumer
repo carries **none** of these:

- ❌ `@event4u/agent-config` in `package.json` (`dependencies` or
  `devDependencies`); the section is removed if it becomes empty.
- ❌ `event4u/agent-config` in `composer.json` (`require` or
  `require-dev`); the section is removed if it becomes empty.
- ❌ Managed symlinks pointing into `vendor/` or `node_modules/`.
- ❌ `.implement-ticket-state.json` at the project root; if v0
  payload was present, it is migrated to `.work-state.json` and the
  v0 source is renamed `.implement-ticket-state.json.bak`. If no v0
  payload existed (file absent), nothing is written.
- ❌ Project-root `.agent-settings.yml` (hard-deleted).
- ❌ Project-root `.agent-user.yml` (hard-deleted).
- ❌ `settings/.agent-settings.yml` and `settings/.agent-user.yml`
  (hard-deleted; the `settings/` directory is removed if it becomes
  empty).
- ❌ Empty `agent-config/` shell at the project root.

The `.gitignore` block is refreshed to the canonical shape
documented in `scripts/_cli/cmd_migrate.py::GITIGNORE_NEW_BODY`.

## Action order — opinionated, fixed

Apply path is deterministic — re-running the same input yields the
same diff. Order is foundation-first so that earlier steps cannot
break detection for later ones:

1. **Detect** legacy signals from the matrix above; collect every
   action that would fire.
2. **Strip** `composer.json` / `package.json` package entries
   in-place (preserves sibling keys + 2-space indent + trailing
   newline).
3. **Purge** managed symlinks whose target points into `vendor/` or
   `node_modules/`. User-managed symlinks pointing elsewhere are
   preserved with a warning.
4. **Migrate state** — if `.implement-ticket-state.json` carries a
   v0 payload, rewrite to `.work-state.json` and rename the v0
   source to `.implement-ticket-state.json.bak`. If the file is
   absent or already v1-shaped, skip.
5. **Hard-delete** legacy project-local config files:
   - `.agent-settings.yml` (project root)
   - `.agent-user.yml` (project root)
   - `settings/.agent-settings.yml` (typed-subdir variant)
   - `settings/.agent-user.yml` (typed-subdir variant)
   - `settings/` directory itself if empty after the YAML removals.
6. **Remove** the empty `agent-config/` shell directory at the
   project root, if present and empty.
7. **Refresh** the `.gitignore` agent-config managed block to the
   canonical shape.
8. **Summarize** — print every action taken, one per line, with a
   leading bullet.

## `--dry-run` semantics

- Same detection + summary as the apply path.
- **Zero filesystem mutations** — no file created, modified, or
  deleted; no symlink removed; no directory removed.
- Exit codes match the apply path: `0` for "nothing to migrate"
  and `0` for "would migrate these N actions".
- Non-zero only on detection errors (unreadable file, invalid JSON
  in `composer.json` / `package.json`, etc.).
- The summary is prefixed with `would` instead of past-tense verbs
  so log scraping can distinguish dry-run from real runs.

## `--check` semantics

`--check` is a **read-only probe** for scripts / CI — same detection +
`would …` action list as `--dry-run`, but the verdict lives in the
**exit code** instead of requiring output parsing:

- Already on the 6.0 layout (no legacy signal) → prints
  `✅  on the 6.0 layout — no migration needed.` and exits **0**.
- Legacy install detected → prints
  `⚠️  legacy install detected — N pending action(s) …` followed by the
  `would …` list, and exits **2**.
- **Zero filesystem mutations**, like `--dry-run`.
- `--check` and `--dry-run` are **mutually exclusive** (argparse group):
  they share the read-only detection but differ in exit semantics, so
  combining them is rejected.

## `--from {4,5}` semantics

`--from` declares the source major for documentation / log purposes —
**4.x = composer-era**, **5.x = npx-era**. Detection itself stays
signal-based (the authoritative source), so `--from` never changes
which actions run:

- The declared major is echoed (`ℹ️  declared source major: N.x`).
- A mismatch with the detected signal (`--from 4` with no composer
  entry, `--from 5` with no npm entry) prints an advisory note and the
  command proceeds from the detected signals.
- `--from` composes with `--dry-run`, `--check`, and the apply path.

## Idempotency contract

Re-running on a fully-migrated consumer:

1. Detector fires zero hits (every signal in the matrix is absent).
2. Command prints `✅  already migrated — nothing to do.`
3. Exits `0`.
4. **No filesystem mutation occurs** — including on `--dry-run`.

A partial migration (e.g., a previous run crashed between steps 3
and 4) re-runs each remaining step on the next invocation. The
apply order is chosen so partial state never poisons detection of
the next pending action.

## Excluded — what `migrate` does NOT do

These cleanup actions exist elsewhere in the package today but are
intentionally **outside** the unified `migrate` command:

| Action | Where it lives instead | Why excluded |
|---|---|---|
| Lift project-local YAML into `~/.event4u/agent-config/` | wizard (`agent-config setup`) | New global config is created fresh by the wizard; preserving stale values defeats the deletion-over-migration policy. |
| Write a fresh `.agent-settings.yml` | wizard (`agent-config setup`) | Same as above — the wizard is the source of truth for new project config. |
| Run the perms gate (`lint_global_paths.py`) | `agent-config doctor` | Migration deletes project-local state; the perms audit is a separate diagnostic on the global tree. |
| `.legacy-pre-global-only/<stamp>/` snapshot | (removed) | Snapshot-and-rollback was a `migrate-to-global` semantic. The deletion path needs no snapshot — git history is the rollback surface. |
| `agents/.event4u-bridge.yml` bridge marker write | `install.py` | Bridge marker is an install-time artefact, not a migration concern. |
| `settings:migrate` (read-only copy of project YAML into global) | (removed; superseded by wizard) | The read-only copy was a stepping stone for the destructive move. With the deletion policy, neither step survives. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Migration complete, or nothing to migrate (already migrated), or `--dry-run` plan computed, or `--check` found the install already on the 6.0 layout. |
| `1` | Detection error — unreadable file, invalid JSON in `composer.json` / `package.json`, work-engine v0 → v1 conversion error. |
| `2` | `--check` only: a legacy install was detected (migration pending). Never returned by the apply or `--dry-run` paths. |

The apply path never exits non-zero on a partial-migration recovery
— a step that fires its predicate is allowed to complete cleanly
even if a sibling step's predicate is already satisfied.

## Test surface

`tests/migrate/test_unified_migrate.py` covers, against a fixture
consumer dir under `tests/fixtures/migrate/`:

- **Full apply** — fixture carries every input signal; assert each
  output-state predicate holds post-run; summary lists each action.
- **`--dry-run`** — same fixture, assert zero filesystem mutations
  (snapshot dir tree before and after; bit-identical).
- **Idempotency** — run twice; assert second run is the
  "already migrated" no-op.

## Rollback

Restoring the previous command surface:

1. Restore the previous `scripts/_cli/cmd_migrate.py` from git
   history.
2. Restore `scripts/_cli/cmd_migrate_to_global.py`,
   `cmd_migrate_state()` / `cmd_migrate_to_global()` in
   `scripts/_dispatch.bash`, and the corresponding registry entries
   in `src/cli/registry.ts`.
3. Delete this contract doc.
4. Restore `scripts/_cli/cmd_settings_migrate.py` if also removed
   (note: this command was originally cited only as a discussion
   item in Phase 1 cross-check; see "Excluded" table above).

## See also

- `road-to-one-migrate-command.md` — the roadmap this contract
  realizes.
- `road-to-global-only-install.md` — the predecessor roadmap that
  shipped `migrate-to-global`; superseded by this contract.
- `road-to-portable-runtime-and-update-check.md` § P3.5–P3.6 — the
  original `migrate` command (composer / npm cleanup).
- `scripts/_cli/cmd_migrate.py` — implementation.
- `.agent-src/templates/scripts/work_engine/migration/v0_to_v1.py`
  — state-file migration helper invoked from step 4.
