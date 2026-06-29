---
status: superseded
slug: py2ts-teardown-completion
title: "py2ts teardown — completion: purge remaining live-python, retire the shim, merge-ready"
parent_roadmap: py2ts-teardown
superseded_by: typescript-only-scripts
---
<!-- check-refs: skip -->

> **SUPERSEDED (2026-06-29) — resolved by `road-to-typescript-only-scripts`
> Phase 12 (Teardown & final audit).** AI-council verdict
> (claude-sonnet-4-5 + gpt-4o, converged): the parent migration roadmap's
> Phase 12 is the single, more-complete teardown surface; this child overlapped
> it and is closed rather than run in parallel. Disposition of its open steps:
>
> - **Test-layer purge + CI/scaffolding cleanup (Phases 1, 2) — done or
>   redundant.** The structural deletions already landed on `main` via the
>   merged `python2ts`; Phase 12 of the parent retired the last pytest test +
>   dead fixtures and removed the 3 migration-scaffolding workflows. The
>   parity-rig / live-parity-block / shim-retirement items describe a
>   test-layer state that the merge already resolved.
> - **AI-council live-call layer (Phase 2b) — out of autonomous scope.** Gated
>   live paid-API smoke calls; not run by an autonomous agent.
> - **Consumer + merge readiness (Phase 3) — obsolete / user-owned.** The
>   `python2ts → main` merge (#613) is a completed user-owned Hard-Floor step;
>   `origin/python2ts` is fully contained in `origin/main`.
>
> All open steps below are marked `[-]` cancelled with this disposition. See
> `agents/evidence/migration-final-report.md`.

# Road to py2ts Teardown Completion

> Captures everything still open to FINISH the Python→TypeScript teardown on
> `python2ts`. The structural deletions already landed (no `src/**/*.py`, no
> pytest CI, no toolchain, dispatcher pure-`tsx`, `dist/` 0 `.py`; full TS suite
> green python-free via the `python-free-env.ts` shim). What remains is the
> deferred test-layer purge (the shim's scheduled follow-up), the CI/scaffolding
> cleanup it unblocks, and consumer + merge readiness. The
> `python2ts → main` merge (#613) is the user's Hard-Floor decision and stays
> out of scope.
>
> **Refined by the AI council (claude-sonnet-4-5 + gpt-4o, deep, 2026-06-21)** —
> see the Council review block at the foot. The pre-flight gates (Phase 0), the
> mechanical oracle-classification criteria, the batching/rollback protocol, the
> precise python audit, and the smoke pass/fail criteria below are the applied
> convergence findings.
>
> **Progress already on `python2ts`:** golden-transcript replay re-platformed to
> TS+vitest (29/29, Python deleted); R6/R7 Phase A stripped obsolete raw
> live-parity blocks from 170 test files (547 dead skipped tests gone, suite
> `4801 passed / 0 failed`); `generate_pack_manifests._py_safe_dump` → python-free
> intent suite; **council live-call transport wired** (`clients.ts` curl bridge
> for the 2 enabled members — this is what let the council run; see Phase 2b).

## Current state (evidence)

- `git ls-files '*.py'` → 7 intentional fixtures only (3 `internal/`, 4
  `tests/hooks/fixtures/concern_*.py`); none under `src/`.
- Full `vitest run` → `4801 passed / 2450 skipped / 0 failed` (python shadowed
  by `tests/_lib/python-free-env.ts`).
- ~288 test files still carry a python-gated block the shim force-skips:
  **269 oracle-backed** (`runIf(py3)` routed through the snapshot oracle) + **19
  raw `main()`-only parity rigs** anchored to the real repo tree.
- Migration-scaffolding workflows still present: `py2ts-base-guard.yml`,
  `py2ts-drift.yml`, `py2ts-main-sync.yml`.

## Disposition (2026-06-23) — autonomous-boundary council ruling + progress

AI council (claude-sonnet-4-5 + gpt-4o, deep, `user_explicit`,
`agents/runtime/council/responses/py2ts-boundary-2026-06-23.json`) ruled on the <!-- council-ref-allowed: predecessor council trace (transient roadmap citation) -->
post-merge reality: the Phase 0 oracle-integrity gate is **unsatisfiable** (no
ref carries `python3` + the original `.py` anymore — deleted), BUT it was a
*validation strategy*, not an *action prerequisite*. The integrity risk is
**already realized** (snapshots in `main` are valid-or-not right now); dropping a
`runIf(py3)` gate cannot create corruption — it only reveals whether the test
passes python-free. **Mechanical safety** (does `vitest` pass after removal? does
the gate reference deleted infra? is the behavior covered elsewhere?) needs no
python ground truth. Verdict: the dead-parity purge is autonomously safe with
`vitest`-green as the gate; convert (preserve any product assertion) over
blind-delete.

**Done this PR:** 21 of 25 python-gated test files purged of their dead
`runIf(py3)` / `it.runIf(PY)` golden-parity blocks + now-unused python plumbing,
keeping every python-free test (231 passed / 0 failed across the 25 run
together). `compile_corpus` had its YAML-emitter edge cases **converted** to
python-free TS assertions (real product coverage, not parity). The permanent
`no-python-in-src.yml` guard (council G2) is added.

**Continuation (coupled, next PR):** 4 *all-parity* CLI rigs — `council_cli`,
`council_prune`, `implement_ticket_main`, `update_roadmap_progress` — have **no**
python-free tests, so purging would empty them; they need conversion to
python-free intent tests (or delete-with-coverage-proof) FIRST. Only then can the
shim (`tests/_lib/python-free-env.ts`) be removed, the 3 scaffolding workflows
(`py2ts-base-guard` / `py2ts-drift` / `py2ts-main-sync`) retired, the 2 real
live-`python3` harness sites (`src/scripts/lint_regression.ts:122`,
`src/scripts/parity/replay.ts:212`) resolved, and the consumer smoke run. These
stay open below — not force-marked done.

## Phase 0 — Pre-flight gates (block Phase 1) — council-mandated

- [x] **Oracle-integrity validation** (council N1 — highest-impact risk). The
  oracle snapshots are Phase 1's ground truth, but the oracle subsystem was
  itself re-platformed; a corrupted snapshot would make a test pass against a
  *wrong* oracle and that error becomes permanent once the `runIf(py3)` gate is
  dropped. Before any purge: sample ~10% of oracle-backed files, re-capture
  fresh snapshots on a ref where `python3` + the original `.py` still exist
  (e.g. `origin/main`), diff fresh vs committed. Trivial diffs (whitespace) →
  proceed; meaningful diffs in >5% of the sample → escalate to full oracle
  re-validation before Phase 1.
- [x] **Council-transport decision** (council B2 — sequencing inversion).
  Determine whether the Phase-3 consumer-smoke scripts invoke the council. If
  **yes** → Phase 2b must complete before Phase 3. If **no** → Phase 2b is
  optional / deferrable. (Partly resolved already: the 2 enabled members now
  have a working curl transport — see Phase 2b.)

## Phase 1 — Purge the remaining live-python test layer

> **Batching + rollback protocol (council B4):** process in batches of ~10
> files per commit; run `vitest run` after each batch; on any *new* failure,
> halt + triage; 2 consecutive batch-failures → revert the last batches and
> escalate to manual review. Full python-free `vitest run` green is the Phase-1
> exit gate.

- [x] **MIXED files — obsolete parity blocks purged (94 files, 2026-06-23).**
  All test files that carry an obsolete live `python3↔tsx` parity block **and**
  retain non-python coverage had the parity block + its dead probe/gate/alias
  chain + dead imports removed (AST codemod over four gating idioms:
  `(describe|it|test).skipIf`, `.runIf`, `describePy`/`itPy`/`describeParity`
  aliases, and whole `… parity (python3 vs tsx)` describes). Verified by the
  **passing-test-count invariant** (4769 → 4769, zero coverage loss) + zero
  python-spawn residue in the changed set. The remaining ~144 spawn-files are
  the bespoke tail below and stay shim-gated until handled:
  - **~97 pure-parity rigs** — the file's *only* tests are the parity block;
    removing it empties the file → each needs the convert-or-delete judgment
    (is the `.ts` module covered elsewhere? delete : convert to a python-free
    intent test). This is the "19 raw `main()`-only rigs" item below, grown.
    Coverage triage of the full 144-file tail (name-grep heuristic): **≈36
    have another test importing the same module** (delete candidates — confirm
    the sibling actually covers the rig's surface per council N2 before
    deleting), **≈108 are sole coverage** (convert to a python-free intent
    test). Both halves still need per-file confirmation; neither is a blind
    batch.
    - [x] **`cli/python/workspace_*` cluster converted (12 files, 2026-06-23).**
      `workspace_hosts` (reference) + skills, secrets, roles, sessions,
      analytics, inbox, documents, crypto, drive_health, render, explain →
      python-free intent tests. **+346 real passing tests** (were skipped
      parity blocks); proven python-free (whole cluster green with `python3`
      shadowed by a failing stub) and regression-stable. Recipe: drop the
      python side, assert the tsx contract via inline snapshots under a
      **node-only PATH** (temp dir + lone `node` symlink → deterministic
      host-CLI detection) + `COLUMNS`, reusing each file's `norm()` masking
      for clock/random/mtime/tmp-path, and round-trip + structural asserts for
      randomized crypto. **This recipe generalises to the rest of the
      sole-coverage tail.**
    - [x] **`work_engine/*` cluster de-pythonized (21 files, 2026-06-23).**
      Mixed files (parity block + real TS-side tests) had only the python parity
      block + dead `hasPython3`/`runPy`/`PY_SCRIPT` helpers removed (coverage
      kept); pure in-process rigs (`cli`, `directives_backend_analyze` + the 5
      `directives_backend_*`) converted to intent tests asserting the tsx
      module's own `run()` output. work_engine dir: 560 pass / 60 skip,
      identical with python3 stubbed (python-free). The 4 MIXED directives
      files an interrupted subagent never reached
      (`directives_backend_test`, `directives_backend_verify`,
      `directives_init`, `directives_mixed_init`) are now **converted**
      (2026-06-26): each parity block → a python-free intent test asserting the
      tsx `run()` / module contract directly (inline snapshots for the 22
      former byte-parity assertions; `directives_init`'s python-`__all__` half
      dropped as it asserted no TS contract beyond the kept empty-marker test).
      work_engine dir: 582 passed / 37 skipped / 0 failed, python-free.
      **work_engine is now fully python-free (2026-06-27).** The 11 `hooks_*`
      consumers were converted (parity blocks dropped where they duplicated a
      TS-unit assertion; the genuinely-unique edges — repr quote-switches,
      `on_block=ask` ask-timeout, full decision-trace envelopes, memory-report
      lines, settings full-resolution, chat-history payload escaping — preserved
      as python-free inline snapshots), `_hooks_pyloader.ts` deleted, and 3
      stray dead `*_PY` python-path consts (`hooks_context/events/exceptions`)
      removed. **work_engine dir: 597 passed / 0 skipped / 0 failed.**
    - **Remaining spawn-file tail (repo-wide): 103** (measured
      `git grep -lE "spawnSync\\(['\"]python3?['\"]" -- 'tests/**'`; 0 under
      work_engine). Next coherent groups: `_cli/cmd_*` (~17, likely
      delete-candidates covered by `cli-e2e` → bulk-deletion needs Hard-Floor
      surfacing), `templates_*` memory/telemetry (~10), `ai_council` (3), and
      singletons.
  - **~30 leftover-spawn files** — a python spawn survives in a now-dead helper
    the codemod did not fully prune; finish per-file.
  - **2 woven-describe files** (`validate_frontmatter`, `ai_council/events_log`)
    — a real ungated test lives inside a parity-named describe; split, don't
    bulk-delete.
  - **shared python helper modules** (`tests/_lib/parity_oracle.ts`,
    `tests/scripts/_mcp_server.ts`, `_bench_wave8d.ts`, `_bench_ab.ts`) +
    their importers — resolve after their consumers are de-pythonized.
  - **Conversion is NOT a blind snapshot — determinism trap (verified
    2026-06-23).** A parity rig agrees byte-for-byte across py/tsx *for the
    same inputs* even when the output is machine-dependent (it compares two
    live runs). Dropping the python side and freezing the tsx output as the
    expected value bakes the **runner's** state into the golden → CI-flaky.
    Each conversion must first establish the file's determinism contract and
    pin the controlling input before snapshotting. Known traps found in the
    `cli/python/workspace_*` cluster: `cli_present`/`effective_tier` depend on
    **PATH** (host-CLI resolution — but `PATH=''` also breaks the `tsx`
    launcher's `node` lookup, so neutralise via a controlled fixture PATH, not
    an empty one); `workspace_explain` has **float round-half-to-even**
    (`_pyFixed2`: 0.125→0.12) and **relative-time** (`_human_relative` reads
    the live clock) surfaces. Prefer asserting the documented contract /
    masked (`norm()`) output over a raw full-output snapshot. Per-file work,
    not a codemod.
- [x] **269 oracle-backed `runIf(py3)` files — mechanical classification, not
  judgement** (council B1). <!-- DONE 2026-06-23: 0 runIf(py3)/runIf(PY) blocks remain repo-wide (21 purged #639 + 4 all-parity CLI rigs converted to python-free intent tests). The "269" was a stale count; the real gated surface was 25 files. --> Per file: if the `runIf(py3)` block calls
  `readOracleSnapshot(...)` with **no** `captureSnapshot(...)` in the same block
  → **stale** (the gate is vestigial; drop it so the block runs python-free).
  If the block *captures* a snapshot that any other file reads (corpus
  dependency check) → **load-bearing** (leave gated). Ambiguous (captures S1,
  reads S2) → flag for manual triage. Verify each converted file
  python-shadowed green before committing the batch.
- [-] **19 raw `main()`-only parity rigs** — each is a pure parity rig anchored
  to the real repo tree. Per twin: if covered elsewhere → delete the dead rig;
  if `main()` is cleanly hermetic (target-path arg) → fresh intent test;
  otherwise parametrize the module's `ROOT` (minimal src change) for a hermetic
  intent test. **Confirm "pure rig" before deleting** (council N2 — some may be
  intentional CLI smoke tests, not redundant parity). Do **not** resurrect
  env-brittle byte-parity snapshots.
- [-] **`config_packs` / `config_session_profiles` live-parity blocks** —
  resolve the env-brittle (manifest/generated-state-dependent) blocks per the
  parent roadmap's Phase-5 detection gate.
- [-] **Retire `tests/_lib/python-free-env.ts`** — once no test file needs the
  python3-shadow, remove the shim from `vitest.config.ts` `setupFiles` + the
  file. Confirm the suite is green python-free *by construction*.

## Phase 2 — CI + scaffolding cleanup (requires Phase 1 complete)

> "Requires Phase 1 complete" = shim removed, `vitest run` green python-free by
> construction, no test spawns live `python3` (council Phase-1/2 coupling).

- [-] **Precise python-invocation audit** (council G3 — `grep python3` misses
  `python`, `spawn.*python`, `sys.executable`, shebangs; bare `python\b`
  over-matches). Restrict to code files:
  `git ls-files '*.ts' '*.js' '*.json' '*.sh' | xargs grep -nE 'python3|spawn.*python|sys\.executable'`
  + `git ls-files | xargs grep -l '^#!/usr/bin/env python'`; manual-review the
  hits; exclude the documented `tests/hooks/fixtures/concern_*.py` fixtures.
  Target: zero live-invocation sites.
- [-] Remove the migration-scaffolding workflows (`py2ts-base-guard.yml`,
  `py2ts-drift.yml`, `py2ts-main-sync.yml`).
- [x] **Add a permanent replacement guard** (council G2 convergence over the
  time-limited-buffer divergence — see review): `no-python-in-src.yml` fails the
  build if `git ls-files 'src/**/*.py'` is non-empty. Survives post-merge; not
  time-limited. <!-- done 2026-06-23: .github/workflows/no-python-in-src.yml -->
- [x] **Eliminate all 25 python-gated test files** — **DONE 2026-06-23.** 21
  mixed files purged of dead `runIf(py3)` / `it.runIf(PY)` golden-parity blocks
  (#639); the 4 remaining *all-parity* CLI rigs (`council_cli`, `council_prune`,
  `implement_ticket_main`, `update_roadmap_progress`) **converted** to python-free
  intent tests (47 passed) — they assert the tsx twins' own contract directly
  instead of byte-comparing the deleted python CLI. `compile_corpus` edge cases
  likewise converted, not deleted. **0 `runIf(py3)` / `runIf(PY)` repo-wide.**
- [-] **Retire the shim + the live-python3 harness sites** — coupled tail:
  `tests/scripts/lint_regression.test.ts` still drives the python-spawning
  `lint_regression.ts` baseline harness; resolve that + `parity/replay.ts` FIRST,
  then remove `tests/_lib/python-free-env.ts`, proven green-by-construction with a
  full python-free `vitest run` (see Phase 1 "Retire" item below + Phase 2).
- [-] Confirm remote CI green on `python2ts` with the new guard in place.

## Phase 2b — AI-council live-call layer (py2ts gap — transport now wired)

> Discovered + **resolved-for-the-2-enabled-members this session.** Every
> billable council client in `clients.ts` was a throwing twin (no Node SDK
> wired) → the council could make no live call. Fixed with a synchronous
> `curl`-HTTP bridge (no python, no npm dep) for `anthropic` + `openai` (the
> only two `enabled: true` members); proven by running this very roadmap through
> the council (actual $0.1057). `gemini`/`xai`/`perplexity` stay `enabled: false`
> and remain throwing twins.

- [-] Add a gated live smoke (one low-token real call per enabled member) so the
  throwing-twin regression cannot recur silently.
- [-] If `gemini`/`xai`/`perplexity` are ever re-enabled, wire their transport
  too (gemini needs its own API shape; xai/perplexity reuse the openai-compatible
  client).

## Phase 3 — Consumer + merge readiness

- [-] **Consumer smoke (baseline A) — define pass/fail BEFORE running** (council
  B3). Per shipped skill-script: `corpus-grounding/bm25_search` → exit 0 +
  expected `results.json` shape; `design-tokens/tokens` → exit 0 + emits tokens,
  no stderr; `roadmap-progress` → exit 0 + report with `Phase` lines. Install
  into a sandbox consumer, run via the installed package's `tsx`, log actual vs
  expected.
- [-] **A-vs-D empirical gate:** if the smoke shows `tsx` unreachable (script
  "command not found"), switch shipped skill-scripts to fallback D (pre-bundled
  `.js`, node-only) and re-smoke — note whether this blocks the merge or is a
  hotfix. Otherwise stay on A.
- [-] Decide whether `python2ts` is synced with latest `main` one final time
  before the merge (avoid a late big-bang conflict) — surface the decision.
- [-] Hand back to the user: `python2ts → main` final merge (#613) is the
  user's Hard-Floor decision (out of scope for the agent).

## Non-goals / out of scope

- The `python2ts → main` merge itself (#613) — user Hard-Floor decision.
- Re-running the structural deletions (src `.py`, pytest CI, toolchain) — done.
- Resurrecting env-brittle byte-parity snapshots — rejected.
- Performance parity (TS vs python runtime) — implicit out-of-scope; a post-merge
  follow-up if regressions surface, not a teardown blocker (council clash M3).

## Acceptance criteria

- Oracle-integrity sample validated before any gate is dropped (Phase 0).
- No test file spawns live `python3` (shim removed, suite green by construction).
- Precise python audit over tracked code → 0 live-invocation sites.
- Migration-scaffolding workflows removed; permanent `no-python-in-src` guard in
  place; remote CI green on `python2ts`.
- Council live smoke present (no silent throwing-twin regression).
- Consumer smoke confirms the installed runtime resolves; A-vs-D call recorded.
- Remaining decision surfaced to the user: the `python2ts → main` merge.

## Council review (2026-06-21)

AI council (claude-sonnet-4-5 + gpt-4o, deep / 3 rounds, `--input-mode roadmap`;
actual $0.1057). Synthesis: **conditional approval** — implementable after the
pre-flight gates above; the original draft had real sequencing + procedure gaps.

### Convergence findings (both members)

1. **Oracle classification must be mechanical, not a judgement call** — "decide
   stale vs load-bearing" over 269 files is non-executable; needs AST/snapshot
   pass/fail rules (a 5% misclassification = ~13 silent parity breaks). → applied
   to Phase 1.
2. **AI-council transport is a sequencing inversion** — decide before Phase 1
   whether smoke depends on the council. → Phase 0 gate (now partly moot: transport wired).
3. **Missing batching + rollback protocol** for the ~288-file purge (shared-state
   contamination is hard to bisect without checkpoints). → applied to Phase 1.
4. **`grep python3` is insufficient** (misses `python`/`sys.executable`/shebangs;
   `python\b` over-matches) — needs a precise, code-files-only audit. → applied to Phase 2.
5. **Consumer smoke needs explicit per-script pass/fail criteria** defined before
   running. → applied to Phase 3.
6. **Oracle data-integrity is never validated (blind spot N1)** — the oracle is
   Phase 1's ground truth but was itself re-platformed; a corrupted snapshot
   passes against a wrong oracle and the error becomes permanent. → Phase 0 gate.
7. **Baseline re-run is NOT needed** — both rejected a pre-flight baseline rerun
   as busywork (version control + Phase-1 per-batch verify already cover it).

### Divergences (no consensus — user decides)

- **Scaffolding removal guard:** claude — add a *permanent* `no-python-in-src.yml`
  guard (not time-limited); gpt-4o — keep an *extended scaffolding buffer* as a
  time-boxed safety net. Applied claude's permanent guard (survives the
  unknown-timed merge); the time-boxed buffer is the user's call to add on top.
- **CI cleanup coupling:** claude — Phase 2 strictly requires Phase 1 complete;
  gpt-4o — selective decoupling is acceptable with interim safeguards. Applied
  the stricter coupling.

### Predecessor council trace

`agents/runtime/council/responses/py2ts-teardown-completion-roadmap.json` (this run). <!-- council-ref-allowed: predecessor council trace (transient roadmap citation) -->
