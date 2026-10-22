---
complexity: structural
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-w verified at 5dcfa13a6 that the required Consistency job spends most of its 10-12 min CI runtime (PR #2569: 613 s runner time, of which the Gate coverage floors step 443 s) re-executing every gate in src/config/gate-coverage.yml one at a time, two tsx boots each, including check_static_parity's two whole vitest runs — while no active roadmap owns the cost of that step (grep over agents/roadmaps for check_gate_coverage cost, timeout-minutes, tsx boot returns nothing). Parking costs every PR the same 7 minutes on the only check that blocks a merge; folding it into road-to-ci-time-that-counts-the-queue would hold a deterministic, locally reproducible fix behind a measurement it does not need."
relates:
  - slug: road-to-ci-time-that-counts-the-queue
    relation: disjoint
    note: "Owns measuring CI time incl. queue. This file owns the required job's own runtime; its per-gate timings (1.1) are an input to that file's cost-contract pass."
  - slug: road-to-a-test-matrix-that-finishes-together
    relation: disjoint
    note: "Owns tests.yml placement and shard balance. Step 2.3 here edits one tests.yml step (collector-lifecycle's check_static_parity) and nothing else in that workflow."
  - slug: road-to-macos-where-the-platform-is-the-point
    relation: disjoint
    note: "Owns macOS tiering and merge-queue readiness. No overlap with the required job's internals."
---
# Road to a required check that does not re-run the gates

> **Source:** `agents/tmp.old/inbox-2026-10-w/` — one transcript and two supplied
> CI-speed plans, both pinned at `main@95dbe28`; verified here against
> `main@5dcfa13a6`. The owner's words, turn 1: *"Sicherheit schön und gut, aber
> es dauert ewig."* <!-- md-language-check: ignore --> (Security is fine, but it
> takes forever.) The binding constraint from the same turn and both plans: no
> gate, no covered platform and no required check is removed.

## Goal

The required check `Sync + Generate Tools Consistency` finishes in a fraction of
today's 10-12 minutes because `check_gate_coverage` no longer runs 118 gates one
after another through a double tsx boot and no longer re-runs a vitest suite that
`tests.yml` already runs — while every gate's `scanned:` floor is still asserted
on every PR, and a hang can no longer hold a runner for six hours.

## Context — verified at `5dcfa13a6`

- `consistency.yml` has one job, 96 steps, `fetch-depth: 0` (:138) and **no
  `timeout-minutes`** anywhere; the "300 s per-job ceiling" quoted at :498 exists
  only on paper.
- `check_gate_coverage.ts:365-383` (`run_gate`) runs `./scripts-run
  src/scripts/<id> …argv` per gate, sequentially, via `runCountedProbe` →
  `spawnSync`. `gate-coverage.yml` has 118 rows; 113 say `status: enforced`, the
  other 5 default to enforced (`:188,197`). The file header still says "115 rows".
- `scripts-run:9` execs tsx on `run.ts`, which resolves `<path>.ts` and
  **spawns tsx again** (`run.ts:50-51`): two tsx boots per invocation, on every
  `./scripts-run` call in every workflow, not only in this step.
- `check_static_parity.ts:249-250` runs `runSuite` twice, each a whole
  `vitest run --reporter=json` (:181-190). It also runs in `tests.yml`
  `collector-lifecycle` (:754).
- The wiring comment at `consistency.yml:498` still records "check_gate_coverage
  18.6 s"; CI measured the step at 443 s on PR #2569 (job 613 s, Actions API).

**Why the supplied plan's structural fix is not taken.** Both plans proposed
moving the floor check into each gate behind an env var. The floors in
`gate-coverage.yml` are calibrated to that row's `argv`; most gates run in
workflows with different arguments (only 26 of 118 rows carry `ci_invocation`),
so an in-gate floor would compare a count against a floor measured for another
invocation — red on correct scans or green on collapsed ones. The fixes below
keep the floor where it is calibrated and make running it cheap.

## Phase 1 — Measure inside the step

- [x] **1.1 Per-gate wall time in the meta-gate's output.** `check_gate_coverage`
      records each gate's elapsed milliseconds and prints them (text: the ten
      slowest; `--format json`: every row). Measurement only, no verdict change.
      verify: the `--format json` output of a full local run carries a numeric
      `elapsed_ms` on every executed row (the manifest path is fixed, so the
      check is the real run, not a fixture; corrected while executing).

## Phase 2 — Same proof, less work

- [x] **2.1 One tsx boot per `./scripts-run` call.** The shim resolves
      `<path>.ts` itself (repo-root-relative or absolute, the same rule as
      `run.ts`) and execs tsx on it directly; `run.ts` stays as the fallback for
      anything the shim cannot resolve, so exit 127 and its message are unchanged.
      verify: `npx vitest run tests/scripts/scripts_run_shim.test.ts` -> 0
- [x] **2.2 Run the gates concurrently.** `check_gate_coverage` runs gates on a
      bounded pool (`os.availableParallelism()`, overridable by
      `--jobs N`), keeps the bounded-output guarantee of `runCountedProbe`, and
      prints results in manifest order so the report is byte-stable regardless of
      completion order.
      verify: a test with a fixture manifest whose gates finish in reverse order
      asserts the printed order equals manifest order and the verdicts are
      unchanged from `--jobs 1`.
- [x] **2.3 Assert `check_static_parity`'s floor where it already runs.** A new
      `--from-output <file> --only <id>` mode parses a captured gate output and
      applies that row's floor without executing the gate; `tests.yml`
      `collector-lifecycle` tees the gate's output and runs that mode in the same
      job. The row gains `floor_asserted_in: .github/workflows/tests.yml`; the
      per-PR census skips executing such a row only after confirming that workflow
      contains the `--from-output … --only <id>` assertion — otherwise it executes
      the gate as today.
      verify: tests cover (a) a row with `floor_asserted_in` whose workflow
      carries the assertion is reported `delegated`, not executed; (b) the same
      row with the assertion removed from the fixture workflow is executed; (c)
      `--from-output` on a captured output below the floor exits 1.

## Phase 3 — A fence and a true cost record

- [x] **3.1 `timeout-minutes` on the Consistency job**, set from the measured
      post-Phase-2 duration with headroom, so a hang costs minutes, not the
      six-hour default.
      verify: `grep -n "timeout-minutes" .github/workflows/consistency.yml` -> 0
- [x] **3.2 Replace the stale cost note.** `consistency.yml:498` and the
      `gate-coverage.yml` header ("115 rows") state what this PR's CI measured,
      with the run id, instead of the 18.6 s / 115 figures.
      verify: `grep -c "18.6 s" .github/workflows/consistency.yml` -> /^0$/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | deterministic | evidence | Not a decision: the frontmatter reason describes a measurement, it performs no operation | `closure_scan` keyword match on prose | the line gains an imperative |
| C2 | deterministic | evidence | Not a decision: a `relates` note describing another file's scope | same | same |
| C3 | deterministic | agent | Verify tightened to a named test command with an exit code | step 2.1 | the test file is renamed |
| D1 | contested-technical | agent | The supplied plans' in-gate floor (env-var mode) is not taken; floors stay where they are calibrated, execution gets cheaper | 26 of 118 rows carry `ci_invocation`; floors are per-argv (`gate-coverage.yml`) | a per-invocation floor schema lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Concurrency changes a verdict | implementation | Gates that write shared temp state could interfere when run in parallel and report a false `silent`/`crashed` | 2.2 verifies verdict parity against `--jobs 1`; any gate that differs is pinned to a serial lane by a manifest flag rather than the whole pool reverting | Phase 2 — Same proof, less work |
| 2 | Shim resolution diverges from run.ts | implementation | A path form `run.ts` accepted (absolute, nested domain path) stops resolving and every workflow call breaks | The shim only handles the case it can prove and falls through to `run.ts` for everything else; 2.1's test covers relative, absolute and missing | Phase 2 — Same proof, less work |
| 3 | Delegated floor silently unenforced | product | A row marked `floor_asserted_in` loses its workflow assertion and nothing runs the floor | The census executes the gate whenever the named workflow lacks the exact assertion; 2.3 (b) proves it | Phase 2 — Same proof, less work |
| 4 | Timeout too tight | implementation | A slow but healthy run is killed and the only required check goes red | 3.1 sets the value from measured CI duration with at least 2× headroom | Phase 3 — A fence and a true cost record |

## Acceptance Criteria

- [x] AC-1 — Every enforced gate's floor is still asserted on every PR: executed
      in Consistency, or delegated to a named workflow that verifiably asserts it.
- [x] AC-2 — The Gate coverage floors step on this roadmap's PR CI run is measured
      and recorded below the 443 s baseline, with the run id. **96 s** on PR #2577
      (job 119596603743, run of head 6574d5311); the whole job reached its last steps
      in 3m00s against 613 s on PR #2569. The 25-min fence is 8× that.
- [x] AC-3 — The Consistency job carries a `timeout-minutes` fence.
