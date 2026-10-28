---
complexity: lightweight
status: later
tree_pin: 1e3869b03d
review_by: 2026-11-28
entry_condition:
  what: "the zero-cost foundation (Phases 0-4) runs now; the first paid showcase run needs an owner budget per tier (stubs/road-to-a-showcase-the-owner-paid-for)"
  when: "after road-to-a-bench-that-fails-when-nothing-was-done closes, and when a slot among the five active roadmaps frees"
  who: owner
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner invocation 2026-10-28 (analyse the round, process the roadmaps, one PR). Owner search: grep for showcase, parity, artifact task, bench:ui, examples over agents/roadmaps, later/ and stubs/ on 2026-10-28 — later/road-to-web-launch-readiness-benchmark owns one pre-registered web claim and later/road-to-reach-cost-primary-bench owns the cost thesis; neither owns with/without artifact tasks or the cost of parity. Parked in later/ because WIP is 5/5."
estate_growth_exempt: "Owner invocation 2026-10-28 asked for this inbox round to become roadmaps. This file parks in later/ because its paid run is owner-budgeted and WIP is 5/5; its sibling road-to-a-bench-that-fails-when-nothing-was-done is executed and archived in the same change, so the later/ count grows by this one file at merge."
relates:
  - slug: road-to-a-bench-that-fails-when-nothing-was-done
    relation: blocked-by
    note: "Artifact tasks are scored by the same harness; its validity gate lands first."
  - slug: road-to-web-launch-readiness-benchmark
    relation: overlaps
    note: "Owns claim web-launch-readiness-finds-more; T2/T3 reuse its fixtures, never its claim."
  - slug: road-to-reach-cost-primary-bench
    relation: overlaps
    note: "Owns the cost thesis; Phase 4 here measures cost-to-target, it does not restate the thesis."
  - slug: road-to-svg-witness-provenance
    relation: disjoint
    note: "Owns the SVG turn-end obligation; T1's render gate is a grader, not that obligation."
  - slug: road-to-benchmark-obsolescence-lifecycle
    relation: extends
    note: "Receives a task whose vanilla arm equals the package arm."
---

# Road to a baseline that has to catch up

> **Source:** `agents/tmp.old/inbox-2026-10-bh/` — the owner's transcript and two
> supplied plans, re-verified against `1e3869b03d` on 2026-10-28.

## Goal

Real, reproducible reports showing, per concrete task (SVG, page, form, login,
PHP endpoint, page and app copy), what the agent produces **with** agent-config
versus **without** it — quality by graders agent-config does not own, tokens and
turns of the first attempt, and the **cost of parity**: how many prompts, turns
and tokens the agent without agent-config needs to reach the same pre-registered
bar. Results are committed evidence bundles rendered into `docs/examples/bench/`,
with side-by-side images, startable on demand and as an opt-in release step.

**Non-goal:** a page that says "agent-config is better". The page says what was
measured, including losses and the extra cost.

## Context

Verified at the pin:

- **The harness exists.** `src/scripts/bench_ab_v2_run.ts` (arms incl.
  `vanilla`, `package`, `placebo`), `_lib/bench_ab_activation.ts`, paired stats
  `_lib/paired_stats.ts` + `_lib/paired_verdict.ts`, the position-swapped judge
  library `src/scripts/check_quality_regression.ts`, the reference-fidelity UI
  grader `internal/bench/ui/run.ts`, login twins under
  `tests/fixtures/account-surface/`.
- **No artifact tasks.** No corpus under `internal/bench/corpora/` asks for an
  SVG, a page, a form, a login, a PHP endpoint or a copy; the v2 corpus measures
  discipline on small edits.
- **Published numbers cannot be re-derived from a clone.** Pinned reports live in
  `internal/bench/reports/ab-v2/`, gitignored (`.gitignore:335`).
- **The headline is mixed and expensive.** `claude-haiku-4-5`: discipline
  0.333 → 1.000 at 90,534 → 992,044 mean tokens (`docs/benchmark.md:46`, `:52`);
  a strong host scored vanilla = package = placebo.
- **No release step, no front door, no examples page.** `src/scripts/release.ts`
  has 0 `bench` references; `docs/examples/` holds one file; `test` is an
  approved command verb (`src/config/discovery/command-verbs.yml`).
- **Login lift rides on skills.** `src/rules` has no hit for password hashing or
  session regeneration, so a login lift needs the skill to be invoked.

## Phase 0 — Pre-register before any task file exists

- [x] **0.1 Claims first.** One `### claim:` per task family in `docs/CLAIMS.md`,
      `status: unbacked`, naming metric, bar, falsification, scope and the
      primary grader. The commit carries claims and no task fixtures.
      verify: `task check-claims` (or `check_claims`) is green with the new entries.
- [x] **0.2 Predicted-lift map.** `internal/bench/showcase/PREDICTED-LIFT.md`
      lists, per task, the rules and skills that should make a difference
      (`file:line`). A task without a predicted asset is not a showcase task.
      verify: every task in 2.2 has at least one row.

## Phase 1 — Evidence that stays in the tree

- [x] **1.1 Bundle schema.** `internal/bench/showcase/<stamp>-<task>/summary.json`
      (arms, host, model id, k, per-run scores, four token buckets with coverage
      — `unknown` when telemetry is incomplete — turns, model requests, tool
      calls, priced USD with `pricing_sourced_on`, infra errors per arm —
      reported, never dropped from the rate — verdict) plus
      `artifacts.sha256` and size-capped thumbnails. Transcripts stay local.
      verify: a JSON-schema test accepts a fixture bundle and rejects one missing `pricing_sourced_on`.
- [x] **1.2 Renderer with drift check.** Bundles render into
      `docs/examples/bench/<task>.md` and an index; `--check` fails when a page
      and its bundle diverge.
      verify: the render test on a fixture bundle is byte-stable and `--check` reds on an edited page.

## Phase 2 — Artifact tasks in the v2 harness

- [x] **2.1 `kind: artifact`.** `internal/bench/corpora/SCHEMA-v2.md` and the
      loader gain `deliverable`, `graders[]`, `parity_bar`, `feedback_ladder[]`,
      `network: none|registry`.
      verify: the corpus loader test parses an artifact task and rejects one without `parity_bar`.
- [x] **2.2 Seed tasks, all fixtures written in-repo.** T1a SVG from a prompt,
      T1b SVG from a provided raster mascot (in-repo, original), T2 landing page
      from brief + tokens, T3 multi-step form, T4a login in a PHP framework
      skeleton, T4b plain-PHP login, T5 PHP CRUD endpoint with a hidden test
      suite, T6 page copy from a frozen in-repo page, T7 mini-app copy (in-repo
      fictional todo app with acceptance tests).
      verify: `bench:ab:v2 --dry-run` lists all nine tasks for both arms.
- [x] **2.3 Isolation contract.** Artifact runs use a per-arm temp HOME and
      config dir, a workspace outside the repo and `network: none` unless the
      task declares `registry`.
      verify: a runner test asserts HOME, config dir and workspace differ per arm and lie outside the repo.

## Phase 3 — Graders agent-config does not own

- [x] **3.1 Deterministic primary graders.** T1: render gate (parses, no
      raster/script/`foreignObject`, not blank, in canvas). T2/T3/T7: functional
      acceptance tests plus axe violations at three breakpoints when a browser is
      available, otherwise `unknown`. T4: functional tests and scripted exploits
      (enumeration, no throttle, session fixation, plaintext/fast hash, CSRF) →
      `sec_pass`. T5: hidden tests. T6: `bench:ui`. Agent-config's own linters
      appear only in a labelled secondary column. Renders use a frozen
      viewport, font set, locale and reduced motion.
      verify: grader unit tests pass on the planted good and bad references.
- [x] **3.2 Grader self-test.** Each grader scores its task's planted good and
      bad reference outputs before it scores any arm; a grader that cannot
      separate them does not run.
      verify: a test with a swapped pair makes the self-test exit non-zero.

## Phase 4 — Cost of parity

- [x] **4.1 Pre-written ladders.** Per task, two feedback ladders (naive user,
      informed user), 3-5 steps, written from the rubric before any run and
      never from the with-arm's output.
      verify: every artifact task in 2.2 carries both ladders and the loader rejects a missing one.
- [x] **4.2 Parity loop.** The runner resumes the same session with the next
      ladder step until the primary score reaches the task's `parity_bar`, or
      the cap K = 5. Both arms get the same ladder after a miss. Unreached runs
      are censored, never imputed.
      verify: a fake-host test reaches parity on step 3 and records a censored run at K.
- [x] **4.3 Parity metrics.** Per task: turns, prompts, tokens and USD to
      parity, share not reached by K, and total tokens to target for both arms;
      the with-arm's first-shot median is reported beside the bar.
      verify: the stats test renders all metrics for a fixture bundle.

## Phase 5 — Entry points

- [x] **5.1 Taskfile.** `bench:showcase` (full), `bench:showcase:quick` (one
      host, k=3, T1a/T2/T4a), `bench:showcase:replay` (re-grade kept artifacts
      at 0 USD), `bench:showcase:render`.
      verify: `task --list` shows the four targets and `:replay` runs green on the fixture bundle.
- [x] **5.2 Opt-in release step.** `task release` offers `:quick` once with the
      budget shown and attaches the report to the release PR as advisory;
      `:replay` always runs; a regression on a primary grader opens a release
      hold, never an automatic block; no data → `INDETERMINATE`, never green.
      verify: a release test with a stubbed runner shows offer, replay and hold paths.
- [x] **5.3 The front door.** A command under the approved verb `test` plans
      the run (tier, host, budget), launches the Taskfile target, reads the
      bundle and writes a short report; it never produces numbers itself.
      verify: the command-surface lints and the verb allowlist check are green.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | analysis:2026-10-28 | Parity is reached at a pre-registered per-task bar; the with-arm median is reported, not the target | a target read off the with-arm output is a moving bar fitted to the result | the bar proves unreachable for both arms on every task |
| D2 | product-owned | owner:2026-10-28 (transcript) | Examples live in `docs/examples/bench/`, as the owner asked for an examples folder of md files | owner transcript, turn 1 | — |
| D3 | product-owned | owner:2026-10-28 (transcript) | The front door is a command under an approved verb, no ADR-041 addendum | owner asked for an AI command; `test` is approved | the verb lint rejects the name |
| D4 | reversible-technical | analysis:2026-10-28 | An optimized-baseline arm (vanilla with a competent neutral prompt) joins `placebo` in the full tier | without it the comparison is a straw man | the arm doubles cost without changing any verdict |
| D5 | spend-exhaustion | owner | The first paid run and its budget per tier wait in `stubs/road-to-a-showcase-the-owner-paid-for` | spend is owner-reserved | — |
| D6 | deterministic | analysis:2026-10-28 | No "agent-config saves tokens" headline; savings only as total-to-target from Phase 4 | the measured first-shot cost is higher | — |

## Kill register

- **K1** No showcase number without a claim id. **K2** No cherry-picked run; all k runs, median marked.
- **K3** Agent-config's own linters never as the primary grader. **K4** No copying of real third-party sites or brand assets.
- **K5** No mandatory paid run per release; no hard block on a stochastic verdict. **K6** No second harness.
- **K7** No committed transcripts. **K8** No parity feedback generated from the with-arm output.
- **K9** Symfony feature, dependency-update and long-horizon families — beyond the owner's list; revisit after the nine tasks report.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The page reads as marketing | product | A showcase that hides losses repeats the honesty failure the benchmark page avoids | Claims first (0.1), all k runs shown (K2), nulls and losses on the index (1.2) | Phase 0 — Pre-register before any task file exists |
| 2 | Graders reward the package's own style | implementation | Agent-config linters as primary graders would score agent-config output by agent-config rules | Primary graders are independent; the native column is labelled secondary (3.1) | Phase 3 — Graders agent-config does not own |
| 3 | Parity feedback leaks the answer | implementation | Follow-ups written from the with-arm's output would hand the vanilla arm the solution | Ladders are written from the rubric before any run (4.1, K8) | Phase 4 — Cost of parity |
| 4 | Artifact runs escape the sandbox | implementation | The runner bypasses permissions; installs and browsers widen the blast radius | Per-arm HOME, workspace outside the repo, no network by default (2.3) | Phase 2 — Artifact tasks in the v2 harness |

## Acceptance Criteria

- [x] AC-1 A clean clone renders every example page from tracked bundles and `--check` is green.
- [x] AC-2 `bench:ab:v2 --dry-run` lists the nine artifact tasks, each with a self-tested primary grader and two ladders.
- [x] AC-3 `bench:showcase:replay` runs at 0 USD and `task release` offers `:quick` without blocking.
