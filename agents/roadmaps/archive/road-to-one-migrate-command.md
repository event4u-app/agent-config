---
status: ready
complexity: lightweight
---

# Road to one migrate command

> One `./agent-config migrate` (with `--dry-run` as the only flag) replaces the three legacy migrate-\* subcommands and leaves nothing of the old composer/npm install behind in a consumer repo.

## Goal

Collapse `./agent-config migrate`, `./agent-config migrate-state`, and `./agent-config migrate-to-global` into a single, opinionated `migrate` command. The unified command runs every cleanup step end-to-end, no flags to pick between behaviors, no surprises. The only flag is `--dry-run` for a preview. After it runs, the consumer repo carries zero legacy composer/npm package artefacts; the wizard handles fresh setup separately.

## Prerequisites

- [x] PR #282 (marketplace-install hook gap) merged — done; this roadmap starts from `main` post-merge.
- [x] Familiarity with the three current migrate paths: `scripts/_cli/cmd_migrate.py`, `cmd_migrate_state` (in `scripts/_dispatch.bash:410`), `scripts/_cli/cmd_migrate_to_global.py`.

## Context

Three commands currently fragment the migration story:

| Command | What it touches | Friction |
|---|---|---|
| `./agent-config migrate` | composer.json / package.json entries · managed symlinks under `vendor/`+`node_modules/` · `.gitignore` block · writes fresh `.agent-settings.yml` **only if missing** | Doesn't restructure `agents/`; leaves stale `.agent-settings.yml` in place |
| `./agent-config migrate-state` | `agents/state/` → `agents/runtime/state/` (v0→v1 engine schema) | Only one slice; user has to know the second command exists |
| `./agent-config migrate-to-global` | moves project-local `.event4u/` config → `~/.event4u/agent-config/` | Setup-migration semantic — the user has stated this is not the right path; the wizard recreates global config fresh |

The user has stated the design intent explicitly: legacy composer/npm install state must be gone after one command; the wizard handles fresh setup, so legacy config can be **hard-deleted** rather than preserved-or-moved. Three commands violate the "one thing, simple, no flag matrix" principle.

## Phase 1 — Lock the unified behavior matrix

Document — in one place — the union of cleanup actions the new `migrate` performs. Required so Phase 2 has an unambiguous specification.

- [x] **Step 1:** Write `docs/contracts/migrate-command.md` defining: input signals (legacy composer/npm entry, managed symlinks pointing into `vendor/`/`node_modules/`, `agents/state/` present, project-local `.event4u/` present, legacy `.agent-settings.yml` shape present), output state (nothing of the above remains after a real run), `--dry-run` semantics (read-only inspection, prints what would change, zero filesystem mutations), and idempotency (re-run on a migrated consumer reports "already migrated", exit 0).
- [x] **Step 2:** Cross-check the three current command modules to confirm the matrix is complete. Capture any cleanup step that exists today but isn't in the matrix as a discussion item, then either add it or document why it's excluded.

**Exit criteria:** the contract doc enumerates every cleanup action and the user's "wizard recreates fresh" principle is encoded as the deletion-over-migration policy.

**Rollback:** delete the contract doc.

## Phase 2 — Implement the unified `cmd_migrate`

Rewrite `scripts/_cli/cmd_migrate.py` to perform every action in the Phase 1 matrix in a fixed, opinionated order. No conditional flags except `--dry-run`.

- [x] **Step 1:** Replace the existing `cmd_migrate.py` body with the unified flow:
  1. Detect legacy signals (composer/npm entries, managed symlinks pointing into `vendor/`/`node_modules/`, `agents/state/` dir, project-local `.event4u/`, legacy `.agent-settings.yml` at project root).
  2. Remove composer.json / package.json package entries in-place (preserving sibling keys + formatting — keep current behavior).
  3. Delete agent-config managed symlinks that point into legacy install dirs (`.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`).
  4. Migrate `agents/state/` → `agents/runtime/state/` (port the logic from `cmd_migrate_state`'s `work_engine.migration.v0_to_v1` driver — inline or call directly).
  5. **Hard-delete** legacy project-local config: `.agent-settings.yml` (no if-missing-write), project-local `.event4u/` directory, any other legacy config files identified in Phase 1.
  6. Remove empty directories left behind (the empty `agent-config/` shell at the project root, etc.).
  7. Update the `.gitignore` block to the new shape (current behavior).
  8. Print a summary listing every action taken (or, under `--dry-run`, every action that would be taken).
- [x] **Step 2:** `--dry-run` flag: identical detection + summary, zero writes. Same exit codes (0 = nothing to migrate or migration plan computed; non-zero only on detection errors).
- [x] **Step 3:** Idempotency: re-running on a fully-migrated consumer prints "already migrated" and exits 0 without touching the filesystem.

**Exit criteria:** the new `cmd_migrate.py` performs every action from Phase 1's matrix in one invocation; `--dry-run` reports the same plan without mutation; re-running is a no-op.

**Rollback:** restore the previous `cmd_migrate.py` from git history; leave the now-orphaned `cmd_migrate_state`/`cmd_migrate_to_global` removal (Phase 3) un-applied.

## Phase 3 — Remove the legacy sub-commands

The two split commands disappear entirely. No deprecation alias, no shim — the user has stated this should be simple.

- [x] **Step 1:** Delete `scripts/_cli/cmd_migrate_to_global.py`.
- [x] **Step 2:** Delete the `cmd_migrate_state()` function from `scripts/_dispatch.bash` and its case branch (`migrate-state)`).
- [x] **Step 3:** Delete the `cmd_migrate_to_global()` function from `scripts/_dispatch.bash` and its case branch (`migrate-to-global)`).
- [x] **Step 4:** Remove the deleted subcommands from `src/cli/registry.ts` (REGISTRY array) so `tests/cli/registry.test.ts`'s parity check stays green.
- [x] **Step 5:** Grep for references to the deleted commands in `.agent-src.uncondensed/`, `docs/`, `AGENTS.md`, `README.md` and update or remove them. (Targeted; not a sweep — only references to the deleted commands.)

**Exit criteria:** `./agent-config help` lists `migrate` once. `migrate-state` and `migrate-to-global` are unknown subcommands. `task lint-marketplace-install` + `tests/cli/registry.test.ts` stay green.

**Rollback:** restore the deleted files + case branches + registry entries.

## Phase 4 — Test coverage

One test suite, fixture-driven, covering every action the unified command performs.

- [x] **Step 1:** Add `tests/migrate/test_unified_migrate.py` with a fixture consumer dir under `tests/fixtures/migrate/` containing every legacy signal (composer entry, npm entry, managed symlinks pointing into `vendor/node_modules`, `agents/state/`, project-local `.event4u/`, legacy `.agent-settings.yml`). Run `cmd_migrate` against the fixture and assert: every signal is gone, every target structure is in place, summary lists each action. <!-- carve-out: new-gate-verification -->
- [x] **Step 2:** Add a `--dry-run` test against the same fixture asserting zero filesystem mutations and the same summary content. <!-- carve-out: new-gate-verification -->
- [x] **Step 3:** Add an idempotency test: run twice against the fixture, assert second run is a no-op + exits 0. <!-- carve-out: new-gate-verification -->
- [x] **Step 4:** Run the new suite once locally to satisfy `verify-before-complete`. <!-- carve-out: new-gate-verification -->

**Exit criteria:** three tests pass; fixture covers every Phase 1 matrix entry; CI runs the suite on every PR.

**Rollback:** delete the test files + fixtures.

## Phase 5 — Docs + help text

Collapse user-facing docs to the one command.

- [x] **Step 1:** Update `./agent-config migrate --help` text in `scripts/_dispatch.bash` to describe the one-shot end-to-end behavior. Mention `--dry-run` as the only flag.
- [x] **Step 2:** Update `README.md` / `docs/architecture.md` / any migration-pointing doc to reference the single command. Remove migrate-state / migrate-to-global references.
- [x] **Step 3:** If a "How do I upgrade from the legacy composer package?" section exists in docs, simplify it to "run `./agent-config migrate`".

**Exit criteria:** the only command name a reader meets is `migrate`. No references to `migrate-state` or `migrate-to-global` remain outside the git history.

**Rollback:** revert the doc edits.

## Acceptance criteria

- [x] `./agent-config migrate` performs every cleanup action from Phase 1's matrix in one run.
- [x] `./agent-config migrate --dry-run` reports the same plan with zero filesystem mutations.
- [x] Re-running on a migrated consumer reports "already migrated" and exits 0 without writes.
- [x] `./agent-config migrate-state` and `./agent-config migrate-to-global` are gone — neither in `_dispatch.bash` nor in the TS registry.
- [x] Fixture-driven tests cover the union of cleanup actions, `--dry-run` invariant, and idempotency.
- [x] `./agent-config help` lists `migrate` once; no stale references in `README.md` / `docs/`.

## Notes

- **Why no flags beyond `--dry-run`.** User-stated design intent: the friction of the current three-command setup comes from forcing the user to remember which slice each command does. A single opinionated command removes that cognitive load. `--dry-run` is the only meaningful axis (preview vs. apply) and survives.
- **Why hard-delete instead of preserve.** The new wizard recreates fresh project config; preserving stale `.agent-settings.yml` only carries forward old values the user already chose to leave behind. The wizard's onboarding flow is the source of truth for new config.
- **Why no setup-migration in the unified command.** The legacy `migrate-to-global` moved project-local config into the user's home directory. The new model: project-local config is deleted; the wizard sets up fresh global config when the user next runs `agent-config setup`. Different paths into the same end state, but the deletion path requires no decisions from the agent at migrate time.
- **No version / tag steps.** Roadmaps plan work.
