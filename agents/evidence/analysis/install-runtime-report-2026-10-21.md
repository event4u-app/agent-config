<!-- evidence-type: analysis -->

# Install and runtime report of 2026-10-21 — causes, fixes, limits

A field report from a 16.5.0 install on Ubuntu 24.04 (Node 24, Claude Code,
Superset desktop and remote host) named seven problems. This records, per
problem, what was **reproduced in a test**, what was a hypothesis, what this
change fixes, and what it does not.

## The version boundary that explains most of it

The report ran **16.5.0**. The staged runtime of #2455 —
`~/.event4u/agent-config/runtime/current`, a package-owned copy of the
dispatcher, the node path it ran under and the one runtime dependency (`yaml`)
— is on `main` and **not in 16.5.0** (`git merge-base --is-ancestor` says so).
It is what makes hooks independent of the npx cache. Much of problems 3 and 4
is therefore already fixed on `main` and waiting for a release; this change
covers the paths that remain broken even with it.

## Per problem

| # | Report | Status | Evidence |
|---|---|---|---|
| 1 | false cross-scope DRIFT from a foreign `~/.claude/skills/superset/` | **cause confirmed, fixed** | `scope_guard.sh` called any non-empty directory an install; a host directory has no `package.json`, so the version read `unknown`, and `unknown` is DRIFT. Same defect in all five directory probes. `tests/install/scope_guard_ownership.test.ts` |
| 2 | global dry-run targeted the npx cache and synced `.augment/` | **cause confirmed, fixed** | `--scope global` set SCOPE only, not GLOBAL/SKIP_SYNC, despite being documented as "same as --global"; and a dry run skipped the stage that owns the global plan. `tests/install/global_dry_run_plan.test.ts` |
| 3 | global install depended on the npx cache | **fixed on main by #2455, unreleased; verified here** | `tests/install/staged_runtime.test.ts` — "the dispatcher still resolves after the npx cache is deleted"; `hook_carrier_never_silent.test.ts` — reached with `PATH=/usr/bin:/bin` |
| 4 | hooks died with `ERR_MODULE_NOT_FOUND: yaml` in a Superset worktree | **cause confirmed, residual fixed** | the hook command took `./agent-config` on `[ -x ]` alone. With no staged runtime that still happened on `main`. `tests/install/hook_runtime_fresh_worktree.test.ts` |
| 5 | a hand-patched `settings.json` must migrate | **already works on main; now pinned** | managed commands are found by `MANAGED_SIGNATURE`, which the hand edit kept. `tests/install/hand_patched_hooks_migrate.test.ts` |
| 6 | `doctor` / `hooks:status` reported a working global install missing | **causes confirmed, fixed** | `hooks:status` read only the project settings file, though Claude Code merges it with the user one; `doctor` never consulted the global scope. `tests/scripts/claude_hook_scope.test.ts`, `tests/scripts/_cli/doctor_no_project_install.test.ts` |
| 7 | two high npm advisories; context size | **advisories fixed; context measured, not changed** | below |

## What was a hypothesis and how it came out

- Problem 1 was phrased as a hypothesis ("possibly interprets foreign skills as
  an install"). Confirmed, and wider than stated: the same test ran for Cursor,
  Cline, Windsurf and Augment directories too.
- Problem 4 said the local wrapper was "preferred over a global dispatcher". On
  `main` the staged runtime now comes BEFORE the wrapper, so the reported shape
  occurs only when no runtime is staged. Reproduced in exactly that condition.

## Design decisions, and why

- **The local wrapper is gated, not demoted.** It runs when the checkout has
  `node_modules`. A maintainer who ran `npm ci` in a worktree still gets the
  local version; only an unrunnable wrapper is skipped.
- **Ownership needs evidence, from two independent sources.** The deploy ledger
  (`deployed-files.json`, already trusted by the reaper to delete safely) or one
  entry named like something the package ships. Each source's load was proven
  separately by disabling it.
- **Version skew is surfaced, not enforced.** A staged runtime older than the
  source checkout it serves runs the older guards. `hooks:status` names it. It
  is not refused, because refusing would leave the hooks not running at all,
  which is worse than running a slightly older guard, and a status report that
  refused would hide what it reports.

## Upgrade and rollback

- **Upgrade.** `install`, `refresh` and `upgrade` all write hooks through
  `ensure_managed_hooks`: under a file lock, managed groups (by
  `MANAGED_SIGNATURE`) are replaced, every other group and key is kept, and a
  second run changes nothing. A hand-patched command is replaced by the
  package's; foreign hooks are untouched. The staged runtime is swapped by an
  atomic rename of `runtime/current`.
- **Rollback.** Re-installing the previous version runs the same writer, so it
  restores that version's commands the same way. An interrupted stage leaves the
  previous runtime resolvable (`staged_runtime.test.ts`). A user's own backup
  such as `settings.json.before-ac-runtime-fix` is never read or written.

## Problem 7 in full

**npm advisories.** Both were in DEV dependencies — `npm audit --omit=dev`
reported 0 before the change, so no consumer installed them. `vite` 8.3.1
(three launch-editor advisories, reachable while a maintainer runs the dev
server) and `source-map-js` 1.2.1 (event-loop denial of service from a crafted
source map). Fixed with `npm update vite source-map-js`: 21 packages moved,
every one a patch bump inside those two packages' dependency closure,
`package.json` unchanged. `npm ci --ignore-scripts` now reports 0.

**Context.** Measured, not reduced. The rule corpus is 121 files, 116 projected,
475,611 bytes (~118,903 tokens by chars/4). The lever that already exists is the
thinned rule layer, which installs stubs and loads bodies on demand — and which
engages only when the install's carrier probe reaches a dispatcher. A machine
whose hooks could not reach a runtime therefore also kept the full layer. The
runtime fixes here make a reachable carrier the common case; they do not change
the thinning logic, and no claim is made that context fell.

## What this does NOT fix

- **A release is needed.** None of this reaches a consumer until it ships, and
  neither does #2455.
- **Hosts other than Claude Code.** The four-state report and the deps gate are
  Claude-specific, because the reported host was Claude and its carrier is the
  one this package builds. Other hosts' hook commands were not re-audited.
- **The full security-hook matrix on a live VPS.** Verified here in fake-HOME
  shell runs, including a refusal passing exit 2 through the new route; not
  re-run on the reporter's machine.
- **Context reduction**, as above.
