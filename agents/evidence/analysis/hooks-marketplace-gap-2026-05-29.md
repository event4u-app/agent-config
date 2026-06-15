<!-- analyzed: 2026-05-29 | commit: 57588489 | files: 0 -->
# Hooks marketplace-install gap — evidence trail

**Source roadmap:** `agents/roadmaps/road-to-hooks-actually-fire-in-consumers.md`
**Witness consumer:** `event4u/agent-ide-plugin`, branch `feat/road-to-phase-0-validation`, commits `46d3d8b`, `c3b806e` (the two manual dashboard-regenerate commits).

## What this file is

A running log of the repro runs from
`scripts/repro/repro_marketplace_install_gap.sh` plus the live-consumer
cross-check. Each run is appended in chronological order.

## Failure shape — what we expect to see

A consumer that ran `/plugin install agent-config@event4u-agent-config`
but **never** ran `agent-config init` shows this signature:

| Symptom | Why |
|---|---|
| Plugin enabled in `.claude/settings.json` | Marketplace install writes this |
| No `./agent-config` symlink at repo root | `init` would create it; marketplace install does not |
| No `update_roadmap_progress.py` under `.augment/scripts/`, `.agent-src/scripts/`, or `.agent-src.uncondensed/scripts/` | All three are populated by `init` (or by editing the source tree); marketplace install touches none |
| No `agents/runtime/state/` directory | Created lazily by the dispatch hook the first time it runs successfully |
| Pre-Phase-1: no `agents/runtime/state/dispatch-issues.jsonl` | The observability log Phase 1 introduces |
| Post-Phase-1: `dispatch-issues.jsonl` carries one entry per failed concern resolution | The new traceability surface |

## Which artefacts gate which hook concerns

Cross-walking `scripts/hook_manifest.yaml::concerns` against the
missing-artefact inventory above:

| Concern | Resolver depends on | Effect when missing |
|---|---|---|
| `roadmap-progress` | `update_roadmap_progress.py` under any of three search paths | Hook returns silently via `_resolve_regenerator() → None`; no dashboard regen, no error |
| Any concern that shells out via `dispatch:hook` | `./agent-config` executable in `$CLAUDE_PROJECT_DIR` | Claude Code's shell fails with `command not found`; per the never-block contract, the lifecycle continues |
| All concerns that read prior state | `agents/runtime/state/<concern>.json` | First-run = empty state, valid by design — not a failure mode |
| Concerns that need git-side gates | `.git/hooks/pre-commit` from `hooks:install` | Backstop missing; the dashboard can drift at commit time |

The *load-bearing* missing artefacts (from Phase 0's repro perspective):

1. `./agent-config` symlink — without it, ALL `dispatch:hook` invocations from `hooks/hooks.json` fail.
2. `update_roadmap_progress.py` regenerator under any of the three search paths — without it, the `roadmap-progress` concern resolves to `None` and silently no-ops.

The other artefacts in the table are either created by the
dispatcher on demand or only affect specific concerns (git-side
gate). The two above are the structural prerequisites.

## Run log

(Repro runs append below this line.)

## 2026-05-29T06:01:05Z — repro run

Tmp consumer root: `/var/folders/_s/c58ktjj93tx8zsw3x69wrbch0000gn/T//marketplace-install-gap-LwgDa2`

Inventory:

```
  present: .claude/settings.json (plugin enabled)
  MISSING: agent-config symlink
  MISSING: .augment/scripts/update_roadmap_progress.py
  MISSING: .agent-src/scripts/update_roadmap_progress.py
  MISSING: .agent-src.uncondensed/scripts/update_roadmap_progress.py
  MISSING: .git/hooks/pre-commit
  MISSING: agents/runtime/state/
```

Dispatcher exit: `0`
Dashboard written: `no`
State files: `7`
dispatch-issues.jsonl: `no`


## 2026-05-29 — Live witness-consumer cross-check

`event4u/agent-ide-plugin` inventory at the time of this roadmap:

```
  MISSING: .claude
  MISSING: .augment
  MISSING: .agent-src
  MISSING: .git/hooks/pre-commit
  MISSING: agent-config
  MISSING: agents/runtime/state
  MISSING: .augment/scripts/update_roadmap_progress.py
```

**Even more bare than the repro fixture assumed.** No `.claude/`
directory at all → the consumer may not have run `/plugin install`
either (or the marketplace plugin id is registered globally outside
the project). Either way: every prerequisite the dispatch hooks
depend on is absent. The two manual `update_roadmap_progress.py`
commits (`46d3d8b`, `c3b806e`) cited in the roadmap context are the
only mechanism by which the dashboard has updated in that
repository.

The repro script's failure shape — silent no-op, no observable
trace — is the same regardless of whether the failure is "plugin
enabled + scaffolding missing" or "plugin not enabled at all". The
fix surface (Phases 1-6) handles both: Phase 1's dispatch-issues
log fires on prerequisite_missing; Phase 2's first-run gate
detects the enabled-but-unscaffolded case explicitly.

## Confirmed load-bearing artefacts

The repro confirms that BOTH of the structurally-load-bearing
artefacts identified in the inventory table above (`./agent-config`
symlink + `update_roadmap_progress.py`) are missing in the witness
consumer. Phase 3 (pin path) provisions the regenerator; Phase 4
(`--claude` flag) provisions the symlink + plugin enablement. Both
must land before the hook path can succeed.

## Phase 5 — Witness-consumer validation (DEFERRED, instructions for the user)

This package's branch lands the plugin-side fix. To validate end-to-end
on the witness consumer `event4u/agent-ide-plugin`, the user (or any
maintainer with write access to that sibling repo) runs:

```bash
cd /Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-ide-plugin

# Make a working branch
git checkout -b chore/agent-config-init-validation

# Provision the minimal scaffolding using THIS package's new flags
"$AGENT_CONFIG_PACKAGE_ROOT/scripts/agent-config" hooks:install --claude --regen

# Verify
ls -la agent-config .claude/settings.json .augment/scripts/update_roadmap_progress.py
cat .claude/settings.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['enabledPlugins'])"

# Open Claude Code in this repo. Run a no-op tool call.
# Expected: NO `agents/runtime/state/dispatch-issues.jsonl` entry
# (prerequisites now satisfied).

# Flip a checkbox in agents/roadmaps/road-to-phase-0-validation.md
# (e.g. one of the 20 existing `[x]` items briefly to `[~]` and back).
# Expected: agents/roadmaps-progress.md updates within the same turn
# via the hook path (NOT via a manual subprocess).

# Capture proof:
stat -f %m agents/roadmaps-progress.md  # mtime
stat -f %m agents/roadmaps/road-to-phase-0-validation.md  # mtime — should be within the same turn
ls agents/runtime/state/                  # state files should exist now
```

The reason this phase is deferred: writing to a sibling consumer repo
falls under the `non-destructive-by-default` Hard Floor (cross-repo
state mutation needs explicit per-turn authorization, not just the
roadmap's). The package-side fix is complete and the user has the
exact recipe to validate.

After validation, append the proof (mtimes + state file listing + the
commit SHA of the `chore/agent-config-init-validation` change) below
this paragraph as Phase-5-complete evidence.
