---
status: ready
slug: golden-transcript-ts-replatform
title: "Golden-Transcript replay subsystem — full TS + vitest re-platform"
parent_roadmap: py2ts-teardown
---
<!-- check-refs: skip -->

# Road to a TypeScript Golden-Transcript Replay (py2ts Phase 12 follow-up)

> Resolves the `road-to-py2ts-teardown.md` Phase-5 "Council fork — port or
> retire the Golden-Transcript replay harness" decision. User chose **full
> re-platform** (2026-06: option 2 — truly 0 Python, end-to-end agent-loop
> coverage restored under a re-derived `.ts` baseline). The Python harness
> (`harness.py`/`runner.py`/`capture.py`/`test_replay.py`) was already deleted
> in the teardown PR; only the recipe `.py` + locked baselines remain on
> `python2ts`. This roadmap rebuilds the subsystem in TS+vitest.

## Why this is non-trivial (the entanglement)

The recipes drive the live `work_engine` through cycles and, in the run-tests
cycle, call `_helpers.run_pytest` → `python3 -m pytest` against a **Python toy
repo** (`tests/golden/sandbox/repo/`). The locked baselines encode pytest /
Python-specific content. So a faithful "no-Python" port requires re-platforming
the toy repo to TS+vitest AND **re-capturing every baseline** — the locked
transcripts are re-derived, not preserved byte-for-byte (accepted in option 2).

## Subsystem map (source = `origin/main`, python era)

| File | Lines | Role |
|---|---|---|
| `tests/golden/sandbox/repo/{src/calculator.py,tests/test_calculator.py}` | ~50 | Python toy repo (add/subtract/buggy power) the recipes edit + test |
| `tests/golden/sandbox/recipes/_helpers.py` | ~260 | `append_to_file`, `replace_in_file`, `run_pytest` (spawns `python3 -m pytest`), `standard_plan`, `base_changes`, `simulated_review_verdict`, `trivial_envelope`, `stack_state`, `mixed_contract`, `simulated_smoke_verdict` |
| `tests/golden/sandbox/recipes/gt*.py` (29) | ~30-80 each | per-scenario `META` + `build_recipe(workspace)` → directive→callback map; some `seed_state(workspace)` |
| `tests/golden/sandbox/runner.py` | 471 | `prepare_workspace`, `invoke_engine` (drives the `.ts` work_engine per cycle), `detect_directive`, `run_capture`, `serialise_capture` |
| `tests/golden/harness.py` | 432 | `all_gt_ids`, `replay(gt_id)`, `load_baseline`, 4 comparators (`compare_exit_codes`, `compare_state_snapshots` shape-diff, `compare_halt_markers` Strict-Verb, `compare_delivery_report` `##` headings), `replay_and_compare` |
| `tests/golden/capture.py` | 281 | regenerate the baseline Capture Pack per scenario |
| `tests/golden/baseline/GT-*/` | 234 json | locked goldens (transcript, exit-codes, halt-markers, state-snapshots, delivery-report) — RE-CAPTURED here |

## Comparators (must port faithfully — the test's value)

1. **exit codes** — exact per-cycle list match.
2. **state snapshots** — recursive *shape* match (type identity, dict keys, list
   lengths); leaf scalar drift allowed; `questions`/`report` delegated.
3. **halt markers** — exit + `recipe_action` exact, plus *Strict-Verb* on
   `questions`: `@agent-directive:` verb identity, per-line class
   (directive/numbered `> N.`/blockquote `> `/text), numbered-option count.
4. **delivery report** — `^## ` headings, exact-equal as an ordered list.

## Phases

### Phase 1 — Re-platform the toy repo to TS+vitest — DONE 2026-06
- [x] Port `sandbox/repo/src/calculator.py` → `calculator.ts` (add/subtract/buggy `power` = `Math.abs(a) ** b`).
- [x] Port `tests/test_calculator.py` → `calculator.test.ts` (3 pre-green tests; `power` green for positive base so GT-3 can add the failing case). Excluded from the outer suite via `tests/golden/sandbox/repo/**` in `vitest.config.ts`.
- [x] **Reachability decision (PINNED):** `run_vitest(workspace)` = spawn the package's `node_modules/vitest/vitest.mjs run` with `cwd = <temp workspace>`. The workspace is a copy under a tmp dir **outside** the package, so vitest finds no upward config → pure defaults collect `**/*.test.ts`; vitest + esbuild come from the package's `node_modules` (invoked by abs path), so the workspace needs no `node_modules`. Proven: copied repo → `3 passed`, rc 0. Faithful twin of the old `python3 -m pytest`.

### Phase 2 — Port the helper + runner layer
- [x] `_helpers.ts`: pure helpers ported 1:1; `run_pytest` → `run_vitest(workspace)` (spawns the package vitest, cwd=workspace) returns the same `state.tests` shape; verdict map exit 0→success / 1→failed / else→mixed; `targeted` = the deterministic `Tests …` count line (timing scrubbed). Verified: success → `Tests 3 passed (3)`, failed → `Tests 1 failed | 3 passed (4)`; typecheck + eslint clean.
- [ ] `runner.ts`: port `prepare_workspace` (copy repo fixture), `invoke_engine` (drive the `.ts` work_engine via `./agent-config implement-ticket`/`work` — already `.ts`-first), `detect_directive`, `run_capture`, `serialise_capture`. Deepest integration — only end-to-end-verifiable as part of a GT-1 vertical slice (runner + harness + GT-1 recipe + re-captured baseline + replay), so build that slice first, then fan out.

### Phase 3 — Port the harness + comparators
- [ ] `harness.ts`: `allGtIds`, `replay`, `loadBaseline`, the 4 comparators (faithful per the spec above), `replayAndCompare`.
- [ ] Unit-test each comparator in isolation (shape-diff, Strict-Verb classify) before wiring the full replay.

### Phase 4 — Port the 29 recipes
- [ ] Port each `gt*.py` → `gt*.ts`: `META` object + `buildRecipe(workspace)` returning the directive→callback map; `seedState` where present. The injected source/test snippets become TS (e.g. `multiply` as TS). Parallelizable per recipe.

### Phase 5 — Re-capture baselines + replay test + CI
- [ ] Port `capture.ts` (or fold capture into the harness) and **re-capture all GT-* baselines** from the `.ts` system → new locked Capture Packs (transcript/exit-codes/halt-markers/state-snapshots/delivery-report). Update `CHECKSUMS.txt` + `CAPTURING.md` for the TS flow.
- [ ] `tests/golden/golden_replay.test.ts`: vitest twin of `test_replay.py` — parametrized over `allGtIds()`, smoke subset (`GT-1,GT-2,GT-P1,GT-U1,GT-U10,GT-U15`), fails on any diff. Confirm it's collected by `vitest.config.ts`.
- [ ] CI: no `setup-python` re-introduced; the replay runs under the existing `node-tests` job. Full matrix vs smoke split as the python version had (freeze-guard cadence) if still wanted.

### Phase 6 — Delete Python originals + verify (Hard Floor)
- [ ] Delete `sandbox/recipes/*.py`, `sandbox/repo/{src,tests}/*.py`, `sandbox/runner.py` (already gone on `python2ts`? confirm), `_helpers.py`, `__init__.py` markers — keep only the TS twins. Surface the bulk-deletion diff for explicit confirmation.
- [ ] Verify: `git ls-files '*.py'` returns only the 3 intentional `internal/` fixtures + the 4 `tests/hooks/fixtures/concern_*.py`; full vitest green incl. golden replay; `grep -rn python3` → 0 invocation sites.
- [ ] Reconcile + archive `road-to-py2ts-teardown.md` (flip the now-done Phase 0/2/3/5/6/7 items reflecting actual state; this roadmap closes its Phase-5 fork).

## Gotchas (discovered during analysis)

- vitest must be reachable from the copied temp workspace — the python version
  relied on a globally-available `pytest`; pin the TS equivalent explicitly.
- Re-captured baselines differ from the locked python ones by construction
  (vitest vs pytest wording in transcripts/delivery-reports) — that is expected
  under option 2, not a regression.
- The `.ts` work_engine is the replay subject; `invoke_engine` must call it the
  same way production does (`./scripts-run` → tsx, `.ts`-first) so the replay
  exercises the real engine, not a fork.
