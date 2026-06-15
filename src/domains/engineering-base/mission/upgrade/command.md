---
model_tier: medium
name: mission-upgrade
pack: engineering-base
intent: "Upgrade a Laravel application one major version (10→11, 11→12) via the gated /work engine with a structured breaking-change catalog"
routes_to: [dependency-upgrade]
replaces: []
tier: 1
visibility: advanced
skills: [dependency-upgrade]
framework: laravel
description: Gated Laravel major-version upgrade mission — provisional branch, breaking-change catalog, size-tier surfaced, git-as-rollback. Never auto-commits or auto-PRs.
suggestion:
  eligible: true
  trigger_description: "upgrade Laravel to version X, Laravel 10 to 11 upgrade, bump framework major version"
  trigger_context: "composer.json present with a laravel/framework constraint and user asks for a major version bump"
packs:
  - engineering-base
disable-model-invocation: true
---

# /mission:upgrade

## Overview

`/mission:upgrade` runs a structured, catalog-driven Laravel major-version upgrade
through the existing gated `/work` engine. It is **not** a new autonomous runtime:

- Every phase uses the `/work` engine's confidence-band gating, N=3 retry budget,
  and persisted `.work-state.json`.
- Rollback = git. Changes land on a provisional branch (`mission/upgrade-…`);
  revert is `git reset` or `git revert`, never a daemon.
- No auto-commit, no auto-PR. The user reviews before anything is staged.

## Single-mission-per-branch guard

Before starting, confirm:

1. The working tree is clean (`git status --porcelain` returns empty).
2. No other `mission/*` branch is already checked out.
3. No `.work-state.json` with a mission envelope is present.

If any of these fail, surface the conflict and stop. Run:

```bash
python3 src/scripts/lint_missions.py --check-precondition upgrade .
```

(Currently a documented stub — full live-repo check lands in Phase 1 PoC.)

## Inputs

| Input | Required | Description |
|---|---|---|
| `target_version` | Yes | Target major version to upgrade to (`11`, `12`, …) |
| `framework` | No (default: `laravel`) | Framework slug — auto-detected from `composer.json` |

## Execution flow

### 1. Resolve inputs

Accept inline arguments:

```
/mission:upgrade 11
/mission:upgrade target_version=11 framework=laravel
```

If `target_version` is missing, ask once (numbered options per
[`user-interaction`](../../rules/user-interaction.md)).

### 2. Surface the size tier

Read `size_tier` from `src/missions/upgrade/mission.yaml` and display it before
starting:

```
> Mission: upgrade Laravel {from} → {target_version}
> Size tier: standard (touches public API and configuration)
> Provisional branch: mission/upgrade-laravel-{from}-to-{target_version}
>
> 1. Proceed on a new branch
> 2. Adjust size tier — I'll override
> 3. Abort
```

`standard` is the floor for upgrade missions (public API + config changes).

### 3. Create the provisional branch

```bash
git checkout -b mission/upgrade-laravel-{from}-to-{target_version}
```

Per [`scope-control`](../../rules/scope-control.md), this requires explicit user
confirmation (step 2 above provides it).

### 4. Load the breaking-change catalog

Read `src/missions/upgrade/laravel-10-to-11.yaml` (or the matching version).
The catalog lists breaking changes with `detection`, `fix`, and `verification`
command blocks restricted to safe prefixes
(`composer`, `php`, `php artisan`, `git`, `sed`, `rector`, `vendor/bin/*`).

### 5. Drive the /work engine

```bash
./agent-config work \
    --state-file .work-state.json \
    --prompt-file prompt.txt
```

Write a structured prompt to `prompt.txt` that describes the mission phases
(`analyze` → `plan` → `implement` → `test` → `verify` → `report`) and references
the catalog entries the engine should address.

Handle exit codes per the `/work` contract:

| Exit | Meaning | Action |
|---|---|---|
| `0` | SUCCESS — final report on stdout | Go to step 6 |
| `1` | BLOCKED — halt surface on stdout | Inspect `questions[0]`, respond, re-run |
| `2` | Config/IO error | Surface stderr to the user, stop |

### 6. Rollback path

If a fix step fails beyond the N=3 budget:

```bash
git revert HEAD        # revert the last mission commit
# or
git reset --hard HEAD~1  # if no remote tracking the branch yet
```

The rollback is always manual — the mission surfaces the command, never auto-runs it.

### 7. Final report and close-prompt

On `/work` exit `0`, surface the delivery report unchanged, then append:

```
> Mission: upgrade complete. Review the changes on branch mission/upgrade-…
>
> 1. /commit — stage + commit per the delivery report
> 2. /create-pr — open a pull request from this branch
> 3. Keep working — hold the state file for follow-up
> 4. Discard — delete .work-state.json and reset the branch
```

Per [`scope-control`](../../rules/scope-control.md), git operations are
permission-gated. Never run `/commit` or `/create-pr` without the user choosing
them.

## Rules

- Honour [`scope-control`](../../rules/scope-control.md),
  [`non-destructive-by-default`](../../rules/non-destructive-by-default.md),
  [`minimal-safe-diff`](../../rules/minimal-safe-diff.md), and
  [`verify-before-complete`](../../rules/verify-before-complete.md).
- Every catalog `command:` field is restricted to the safe-prefix allowlist.
  Never run arbitrary shell commands from the catalog.
- The N=3 retry budget from [`autonomous-execution`](../../rules/autonomous-execution.md)
  applies per breaking-change fix step, not per mission.
- Never skip the size-tier surface step — the user must see the scope before the
  provisional branch is created.

## Breaking-change catalog

The knowledge source is `src/missions/upgrade/laravel-10-to-11.yaml`. It is
versionable, diffable, and CI-tested via `lint_missions.py`. Each entry carries:

- `id` — unique checkpoint key (used in `.work-state.json`)
- `severity` — `critical` / `high` / `medium` / `low`
- `detection` — how to check if this change affects the project
- `fix` — how to apply the fix (may reference a Rector rule)
- `verification` — how to confirm the fix is complete

## See also

- [`/work`](../../work/command.md) — the gated engine this mission drives
- [`dependency-upgrade`](../../skills/dependency-upgrade/SKILL.md) — the stack-agnostic upgrade skill this mission specialises
- `src/missions/upgrade/mission.yaml` — the mission manifest
- `src/missions/upgrade/laravel-10-to-11.yaml` — the breaking-change catalog
- `src/scripts/lint_missions.py` — validates the manifest and catalog

## Examples

```
/mission:upgrade 11
/mission:upgrade target_version=11
```
