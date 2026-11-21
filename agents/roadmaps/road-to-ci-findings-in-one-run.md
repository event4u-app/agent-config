---
complexity: lightweight
status: ready
review_by: 2026-12-21
tree_pin: 811cea61d6
estate_growth_exempt: "Created on 2026-11-21 on the owner's instruction to plan the P0 and P1 measures of that day's session retrospective as roadmaps and work them off; no open, later or stub roadmap owns the one-run collector, the aggregate regenerator or the receipt-writing flip."
estate_offset_exempt: "road-to-ci-findings-in-one-run is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
relates:
  - slug: road-to-gates-that-check-what-they-claim
    relation: extends
    note: "Its 2.7 measures the CI mirror's verdicts against real CI over 30 pushes. This file builds the one-run collector and the regenerator on top of that mirror and does not repeat the measurement; AC-1 here reads CI rounds per PR, not mirror agreement."
  - slug: road-to-component-granularity-vocabulary
    relation: disjoint
    note: "archive/. Lexical hit on \"one run\"; it names UI component granularity, not CI."
  - slug: road-to-eval-loop-runnability
    relation: disjoint
    note: "archive/. Lexical hit on \"one run\"; it closes the behavioural-eval orchestrator, not CI feedback."
  - slug: road-to-operator-runtime-harvest
    relation: disjoint
    note: "archive/. Lexical hit on \"one run\"; a closed cross-model harvest, no CI collector or regenerator."
  - slug: road-to-opt-measurement-unblock
    relation: disjoint
    note: "archive/. Lexical hit on \"one run\"; a closed measurement unblock, no CI gate work."
  - slug: road-to-release-truth
    relation: disjoint
    note: "archive/. Lexical hit on \"findings one\"; it owned release-review truth for 9.x, not per-PR CI rounds."
  - slug: road-to-sparring-critic-spike
    relation: disjoint
    note: "later/. Lexical hit on \"one run\"; a one-run falsification spike for a critic agent, unrelated to CI."
  - slug: road-to-worktree-hygiene
    relation: disjoint
    note: "archive/. Lexical hit on \"one run\"; worktree cleanup, not CI findings or derived pins."
---

# Road to CI findings in one run

> **Source:** the owner's session retrospective of 2026-11-21 over ~380 Claude
> Code sessions — pattern D, *CI ping-pong and derived artefacts* (at least 14
> chunks), and measure 9 of its P1 list — plus the AI council round of the same
> day (members: anthropic, openai). The council's openai seat warned that more
> pre-commit gates may only move the waiting earlier, so collected feedback in
> one run comes first and further pre-commit lints come only after it is
> measured. Drafted against `main@811cea61d6`.

## Goal

One local command reports every finding a pull request's CI would report, one
command regenerates every derived artefact and pin a drift gate checks, and the
roadmap step writer stamps the receipt its own gate demands — so the median pull
request needs fewer CI rounds than the Phase 1 baseline, measured on the same
replay.

## Context

From the retro (counts from the transcripts, not re-verified in the tree):
#2184 had 6 red checks at once, #2727 needed more than 10 CI runs, #2335 set
off a cascade over 7 gates (corpus pins, holdout hash), the verify-arrow trap
hit at least 4 PRs, and a missing step receipt reddened nearly every inbox PR
once. Owner on 2026-11-09: why do the CI runs keep failing.

Verified against the tree at the pin:

- **`task ci` stops at the first red.** It is one sequential `cmds:` chain
  (`Taskfile.yml:81-140`).
- **The retro's "22 of 200+" is the pre-push state before 2026-11-09.**
  `taskfiles/ci-fast.yml:17` still records preflight reaching 22 gates with 209
  unreached. Since 2026-11-09 `src/scripts/ci_mirror.ts` (header `:1-47`)
  replays the six jobs named in `src/config/ci-mirror.json` collect-all and
  stamps a green head; the pre-push hook only checks the stamp
  (`src/scripts/install-hooks.sh:347-386`, commit `3fa9288fa4`). That is the
  base this roadmap builds on, not new work.
- **CI itself still stops at the first red in two of the mirrored jobs.**
  `consistency.yml` has 91 `run:` steps and one `always()` (`:325`);
  `tests.yml` has 52 and five. `rule-backstops.yml` (96 of 98) and
  `standing-payload-delta.yml` (30 of 32) already collect. Commit `1225890e68`
  reverted collect-all from `consistency.yml` because
  `check_kernel_edit_ratified` watches that file whole and needs a ratification
  record.
- **Jobs outside the mirror** (`commit-subjects.yml`, `tests.yml`'s
  `node-tests`, and the other PR-triggered workflows) are reported by nothing
  locally, and no command lists them.
- **No aggregate regenerator.** `taskfiles/content.yml:433-553` holds eleven
  `generate-X` / `generate-X-check` pairs, and pins such as the holdout pin
  (`src/scripts/compile_trigger_evals.ts`) were re-taken by hand in sessions;
  no task chains the writers.
- **The step writer writes no receipt.**
  `src/agent-src/scripts/roadmap_set_step.ts:1-35` flips the glyph and, with
  `--verify`, only warns. The receipt line comes from
  `src/scripts/step_receipt.ts` and `src/scripts/check_step_receipts.ts:1-22`
  requires it on every newly ticked step.
- **The verify-arrow trap** is `src/scripts/check_verify_expectation_delta.ts`:
  an added command-bearing `verify:` clause without `-> <code>` or `-> /re/`
  (`src/agent-src/scripts/verify_clause.ts:85`) is refused in CI.

Owner constraint (2026-11-21): no hand-maintained or owner-written list or
context file. Every list below — jobs not mirrored, writers to run — is derived
from the workflow files, the Taskfile or the scripts at run time.

Out of scope: measuring mirror-vs-CI agreement (the related roadmap's 2.7);
calendar-triggered gates such as `check_corpus_staleness`, which need a
re-check and have nothing to regenerate.

## Phase 1 — Baseline

- [ ] **1.1 Measure CI rounds per PR.** Write
      `src/scripts/ci_rounds_replay.ts`: over the last 30 merged PRs (read-only
      `gh` calls), count CI runs per PR and the runs whose red check was green or
      absent on the previous run (a red revealed only after a fix-push). Write
      the table and its median to
      `agents/evidence/analysis/ci-rounds-baseline-2026-11.md`.
      verify: `grep -c '^| #' agents/evidence/analysis/ci-rounds-baseline-2026-11.md` -> /^(3[0-9]|[4-9][0-9])$/

## Phase 2 — Every finding in one run

- [ ] **2.1 Failing test first.** Add `tests/scripts/ci_all_findings.test.ts`:
      on a fixture workflow set with one mirrored and one unmirrored PR job, the
      report names both — the first with its findings, the second as
      `not covered locally: <workflow>:<job>` — and two failing steps in one job
      yield two findings. It fails because the script does not exist.
      verify: `npx vitest run tests/scripts/ci_all_findings.test.ts` -> 1
- [ ] **2.2 `task ci:all-findings`.** Write `src/scripts/ci_all_findings.ts`:
      it runs `ci_mirror --json`, then lists every PR-triggered job read from
      `.github/workflows/` that the mirror does not replay, and prints one flat
      list of failed steps (workflow, job, step, log path). Exit 1 on any
      failure. Wire it as `ci:all-findings` in `taskfiles/ci-fast.yml`.
      verify: `npx vitest run tests/scripts/ci_all_findings.test.ts` -> 0
- [ ] **2.3 Widen the mirror where it fits the budget.** First action: run the
      council on which unmirrored jobs to add (`commit-subjects.yml` and
      `node-tests` first) against the mirror's ~5-minute run, with the
      2.2 report as input. Add the chosen jobs to `src/config/ci-mirror.json`
      and record the verdict as row D1 under `## Decisions`.
      verify: `./scripts-run src/scripts/ci_mirror --check` -> 0
- [ ] **2.4 CI collects in `tests.yml`.** Give every `run:` step of the
      `static-checks` job `if: ${{ !cancelled() }}`, so the job shows all its
      reds on one push. Extend `tests/scripts/ci_mirror_plan.test.ts` with a
      case that fails when a step of a collect-all job lacks the condition.
      verify: `npx vitest run tests/scripts/ci_mirror_plan.test.ts` -> 0
- [ ] **2.5 CI collects in `consistency.yml`.** First action: run the
      ratification review that `check_kernel_edit_ratified` requires for this
      file, with commit `1225890e68`'s reason as input. On `ratified`, apply
      2.4's condition there with the record under the ratifications
      directory; on refusal, record it as row D2 under `## Decisions` and leave the
      mirror as the collector.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified` -> 0

## Phase 3 — One command for every derived artefact

- [ ] **3.1 Pick the derivation source.** First action: run the council on
      where `regen:derived` reads its writer list — the Taskfile's
      `generate-X` / `generate-X-check` pairs, a writer flag on each drift
      script, or both — under the owner's no-hand-kept-list constraint.
      Record the verdict as row D3 under a `## Decisions` table in this file.
      verify: `grep -q '^| D3 ' agents/roadmaps/road-to-ci-findings-in-one-run.md` -> 0
- [ ] **3.2 Failing test first.** Add `tests/scripts/regen_derived.test.ts`:
      for every drift check that `task ci` or a mirrored job runs and that has a
      writer under 3.1's source, the derived plan contains that writer, ordered
      after `sync` and `generate-tools`. It fails because the script does not
      exist.
      verify: `npx vitest run tests/scripts/regen_derived.test.ts` -> 1
- [ ] **3.3 `task regen:derived`.** Write `src/scripts/regen_derived.ts`: derive
      the writer list, run the writers in that order, then run each matching
      check, and print which files changed. A drift check without a writer is
      printed as `no writer: <check>`, and calendar-triggered checks as
      `needs a re-check, not a regeneration`.
      verify: `npx vitest run tests/scripts/regen_derived.test.ts` -> 0
- [ ] **3.4 The report names the fix.** When a failed step in the
      `ci:all-findings` report is a drift check that `regen:derived` covers,
      the line ends with `fix: task regen:derived`. Add the case to 2.1's test.
      verify: `npx vitest run tests/scripts/ci_all_findings.test.ts` -> 0

## Phase 4 — The step writer stamps its receipt

- [ ] **4.1 Failing test first.** Extend
      `tests/scripts/roadmap_set_step.test.ts`: a flip to `[x]` on a fixture
      repository writes the `<!-- receipt: … -->` line that `step_receipt`
      prints for the branch's range, and `check_step_receipts --enforce` then
      passes on the fixture. It fails because the writer writes no receipt.
      verify: `npx vitest run tests/scripts/roadmap_set_step.test.ts` -> 1
- [ ] **4.2 Write the receipt on the flip.** `roadmap_set_step` computes the
      receipt for `<base>..HEAD` and appends it on the step line when flipping
      to `[x]`. Where `step_receipt` is not resolvable (a consumer install
      without `src/scripts/`), it flips, writes no receipt and prints why.
      Update every caller `grep -rn roadmap_set_step src/` finds.
      verify: `npx vitest run tests/scripts/roadmap_set_step.test.ts tests/scripts/check_step_receipts.test.ts` -> 0
- [ ] **4.3 Name the arrow before CI does.** `roadmap_set_step --verify` reports
      a command-bearing `verify:` clause without an expectation with the same
      message `check_verify_expectation_delta` prints. Add the case to 4.1's
      test.
      verify: `npx vitest run tests/scripts/roadmap_set_step.test.ts` -> 0

## Phase 5 — More pre-commit lints, only after the measurement

- [ ] **5.1 Re-measure.** Run 1.1's replay over the first 30 PRs merged after
      Phase 4 closed and write
      `agents/evidence/analysis/ci-rounds-after-2026-12.md` with both medians
      and the remaining red classes, ranked by how many PRs they cost a round.
      verify: `grep -c '^| #' agents/evidence/analysis/ci-rounds-after-2026-12.md` -> /^(3[0-9]|[4-9][0-9])$/
- [ ] **5.2 Move only what the residual names.** First action: run the
      council on which of the top residual classes from 5.1 move into the
      pre-commit hook (`src/scripts/install-hooks.sh`), against a measured
      pre-commit latency, with the openai seat's objection as input. Implement
      the chosen ones, each with a case in a new
      `tests/scripts/precommit_residual_lints.test.ts`; record the verdict as row
      D4 under `## Decisions`.
      verify: `npx vitest run tests/scripts/precommit_residual_lints.test.ts` -> 0

<!-- Release holds — none. resequenced: no intermediate state is broken; every
     phase adds a new command, a new CI condition or a new writer path, and the
     existing mirror, stamp and gates keep working at each step, so no window
     was ever needed. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A collector that hides what it skips | product | `ci:all-findings` reads as "CI will be green" while unmirrored jobs run nowhere locally | The report lists every unmirrored PR job by name, derived from the workflow files, and exits non-zero only on real failures | Phase 2 — Every finding in one run |
| 2 | A regenerator that rewrites what a gate protects | implementation | `regen:derived` could refresh a pin whose drift was the actual finding (a moved holdout measurement) | Each writer is followed by its check and the changed files are printed; calendar-triggered checks are never regenerated | Phase 3 — One command for every derived artefact |
| 3 | A receipt that certifies too little | implementation | A receipt written by the writer could be computed over the wrong range | 4.1's test runs `check_step_receipts --enforce` on the written receipt; a missing range flips without a receipt and says so | Phase 4 — The step writer stamps its receipt |
| 4 | Waiting moved, not removed | product | New pre-commit lints could only shift CI waiting to commit time | Phase 5 adds lints only for residual classes the replay measured, against a measured latency | Phase 5 — More pre-commit lints, only after the measurement |

## Acceptance Criteria

- [ ] AC-1 — The median CI runs per PR in 5.1's artefact is lower than in 1.1's
      baseline, on the same replay script.
- [ ] AC-2 — One local command prints every failed step of every mirrored job
      and names every PR job it did not run.
- [ ] AC-3 — One command regenerates every derived artefact and pin a drift
      check reads, and names the checks it cannot regenerate.
- [ ] AC-4 — A step ticked with `roadmap_set_step` passes
      `check_step_receipts --enforce` without a hand-written receipt.
