---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Five gates run somewhere other than where a pull request can hear them: one runs on every PR and cannot fail it, one runs in no workflow at all, one writes a tracked file on every read, one has no caller, and one contract names a required-check set the ruleset no longer has. Archiving or parking a roadmap does not buy this — each item is open and measured today. Merging into the nearest owner, stubs/road-to-main-protection-ruleset-changes, was rejected: that stub holds repository-admin writes to the ruleset, and every step here is a tree change that reads the ruleset and never writes it."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; no live roadmap owns the gap between where a gate runs and where a pull request is decided."
relates:
  - slug: road-to-main-protection-ruleset-changes
    relation: disjoint
    note: "Stub. Owns every admin write to the `main protection` ruleset; Phase 5 here reads that ruleset and compares, and changes nothing on it."
---
# Road to gates a pull request can hear

> **Source:** an external review round (opaque id inbox-2026-10-e), consumed
> into `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at
> `main` @ `a75bb3210` on 2026-10-06, and the line numbers are the ones that
> commit carries.

## Goal

A gate this tree treats as protection either can change the outcome of the
pull request that would break it, or says in its own prose that it cannot.
Nothing that only reads writes a tracked file. The one mutating proof run has
a caller that records when it last ran. The contract that lists the required
checks agrees with the ruleset, and a report says so when it does not.

## Context

- The workflow-security audit runs on every pull request and cannot fail one.
  `.github/workflows/consistency.yml:292-293` runs
  `./scripts-run src/scripts/lint_workflow_security` with no `--strict`; the
  comment above it (`:279-284`) says only `--strict` turns a HIGH into exit 1,
  that the severity model is council-locked (2026-06-13), and that promotion is
  "recorded unresolved". The record is
  `agents/evidence/analysis/workflow-security-net-degraded-decision.md`, titled
  "a decision taken with no council seat available" (`:2`). The gate-coverage
  row pins `argv: []` and states that a planted HIGH "would be REPORTED and the
  gate would still exit 0" (`src/config/gate-coverage.yml:3232-3244`). The
  16.3.0 release review filed it as finding `f733a2f9e542`
  (`agents/evidence/release-findings/16.3.0.json:46-51`).
- Pack boundaries run in no workflow. `grep -l lint_pack_boundaries
  .github/workflows/*.yml` returns nothing; the only caller is the
  `lint-pack-boundaries` task (`taskfiles/content.yml:439-442`) listed under
  `task ci` (`Taskfile.yml:379`), and the workflows themselves record that no
  workflow invokes `task ci` (`.github/workflows/skill-lint.yml:95`). It is green
  over a baseline of 203 violations
  (`src/config/gate-violation-baselines.json:77-80`), whose note ends: closing
  the base-into-narrow mismatch "needs a schema decision — an advisory edge this
  gate reads, or an exemption for base packs — and that is a product call, not
  cleanup."
- A read writes. `src/scripts/audit_user_type_axis.ts:271-272` writes
  `agents/reports/user-type-axis-audit.md` (`REPORT_PATH`, `:52`) on every run,
  unconditionally; the file is tracked, and the task `lint-user-type-axis`
  (`taskfiles/ci-fast.yml:779-782`) calls it as a lint.
- The mutating proof has no caller. `check_gate_coverage --canary`
  (`src/scripts/check_gate_coverage.ts:40`) is named by no task, workflow or
  `package.json` script; the gate itself prints "declared, not run — the
  mutating --canary path is operator-invoked and off the per-PR workflow"
  (`:418`). The last ledger is
  `agents/evidence/reviews/canary/gate-surface-2026-08-c1.md`, dated 2026-08-02.
- The required-check list disagrees with the ruleset it describes.
  `docs/contracts/branch-protection-policy.md:79` marks
  `Sync + Generate Tools Consistency` as "the only required one"; commit
  `540ee7a0b` (#2169) records that `main protection` requires two contexts, that
  one and `Standing payload delta + budget gate`.
  `src/scripts/print_required_checks.ts:132` hard-codes the one-element list and
  is contractually offline (`:126-130`), so nothing compares it to the live
  ruleset.

## Phase 1 — Control readings

- [x] **1.1 An injected HIGH, read under both argvs.** A test plants a fixture
      workflow carrying a `pull_request_target` untrusted checkout in a temp
      tree and runs the gate twice: under the argv
      `.github/workflows/consistency.yml` runs it exits 0 with the HIGH in its
      output; under `--strict` it exits 1. This is the reading every later
      step argues from.
      verify: `npx vitest run tests/scripts/workflow_security_argv_control.test.ts` -> 0
- [x] **1.2 Pack boundaries are run by no workflow, as a recorded fact.** The
      grep result and the `task ci` chain that holds the only caller are
      written to `agents/evidence/analysis/gates-a-pr-can-hear-2026-10.md`
      with its `evidence-type` marker, beside 1.1's two exit codes.
      verify: `grep -c 'lint_pack_boundaries' agents/evidence/analysis/gates-a-pr-can-hear-2026-10.md` -> /^[1-9]/

## Phase 2 — The workflow-security severity

- [x] **2.1 The step follows
      the decision.** Under (a): the CI step gains `--strict`, the
      gate-coverage row's `argv` becomes `["--strict"]` and its
      `no_canary_reason` is replaced by a canary recipe. Under (b): the step
      name and comment keep warn-only, and every sentence in `docs/` or
      `README.md` that says the audit can fail a pull request is corrected.
      verify: `npx vitest run tests/scripts/workflow_security_argv_control.test.ts` -> 0

## Phase 3 — Pack boundaries a pull request runs

- [x] **3.1 A pull-request step with the manifest's argv.** `consistency.yml`
      gains a step running `./scripts-run src/scripts/lint_pack_boundaries`
      with the argv a new gate-coverage row declares, so a new violation above
      the 203 baseline fails the PR that adds it.
      verify: `grep -c 'lint_pack_boundaries' .github/workflows/consistency.yml` -> /^[1-9]/
- [ ] <!-- blocked-by: pack-boundary-base-narrow-edge | asked: no — authored from an inbox round with no owner turn; the question is carried by the blocker below for /roadmap:resolve-blockers --> **3.2 Re-baseline
      under the decided rule.** The gate reads the chosen edge or exemption;
      the baseline count in `src/config/gate-violation-baselines.json` drops
      by the links that rule now admits, and the note names the decision.
      verify: `npx vitest run tests/scripts/lint_pack_boundaries_base_narrow.test.ts` -> 0

## Phase 4 — Reads that do not write, and a canary that runs

- [x] **4.1 The audit writes only when asked.**
      `audit_user_type_axis` writes `REPORT_PATH` only under `--write`; the
      `lint-user-type-axis` task keeps reading, and a regeneration task passes
      `--write`.
      A test runs it in a temp copy and asserts `git status --porcelain
      agents/reports/` is empty afterwards.
      verify: `npx vitest run tests/scripts/audit_user_type_axis_no_write.test.ts` -> 0
- [x] **4.2 A scheduled caller for the canary.** A scheduled workflow runs
      `./scripts-run src/scripts/check_gate_coverage --canary --ledger <file>`
      from `.github/workflows/gate-canary.yml`, at least as often as
      `adversarial-review-protocol` § 6 requires, and
      uploads the ledger as a run artifact, so "last run" is a date a reader
      can find. It is not a required check.
      verify: `grep -c 'check_gate_coverage --canary' .github/workflows/gate-canary.yml` -> /^[1-9]/

## Phase 5 — The required checks the contract names

- [x] **5.1 The contract names both contexts.**
      `branch-protection-policy.md` and `print_required_checks.ts:132` list
      the two contexts #2169 recorded, with the date the ruleset was read.
      verify: `grep -c 'Standing payload delta + budget gate' src/scripts/print_required_checks.ts` -> /^[1-9]/
- [x] **5.2 A read-only comparator.** A `report_` script reads
      `gh api repos/{owner}/{repo}/rulesets`, extracts the required status
      contexts of `main protection`, compares them to the contract's list and
      exits non-zero on a mismatch. It is run by hand or on a schedule, and is
      not wired as a required check; it writes nothing.
      verify: `npx vitest run tests/scripts/report_required_checks_drift.test.ts` -> 0

## What this roadmap deliberately does not do

- No write to the ruleset, no new required check, no merge-queue change — the
  stub in `relates` owns admin writes.
- No re-tiering of the workflow-security severity model by agent judgement;
  Phase 2 waits for the council.
- No pack-schema change chosen here; 3.2 waits for the product call.
- No full-pipeline local run as a step.

## Acceptance Criteria

- [x] AC-1 — A test shows, for the argv CI runs, whether an injected HIGH
      fails the job, and the CI comment states the same outcome.
- [x] AC-2 — A pull request that adds a pack-boundary violation above the
      recorded baseline gets a red check from a workflow.
- [x] AC-3 — Running `audit_user_type_axis` without `--write` leaves the
      working tree clean.
- [x] AC-4 — The canary path has a scheduled caller whose ledger carries a
      date.
- [x] AC-5 — The contract's required-check list matches the ruleset, and the
      comparator exits non-zero on a fixture where they differ.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Control reading before any argv change | The gate-coverage row already predicts exit 0; 1.1 turns the prediction into a test | — |
| D2 | reversible-technical | agent | Pack boundaries join `consistency.yml` rather than a new workflow | That workflow already hosts the audits moved out of `task ci` for the same reason (`:274-277`) | The step's runtime pushes the job past its timeout |
| D3 | reversible-technical | agent | The canary is scheduled, never per-PR | It plants real files; the gate's own prose keeps it off the per-PR path (`check_gate_coverage.ts:397-399`) | The canary is rewritten to plant only in a temp tree |
| D4 | reversible-technical | agent | The ruleset comparator is a report, not a required check | `print_required_checks` is contractually offline; a network read cannot sit in its place | The comparator is wanted as a gate after one release of reports |

## Blockers

### blocker: workflow-security-severity
- **Status:** resolved
- **Owner:** council
- **Blocks:** step 2.1, AC-1
- **What to do:** pick exactly one — (a) add `--strict` to the step in `.github/workflows/consistency.yml` and set `argv: ["--strict"]` on the `lint_workflow_security` row of `src/config/gate-coverage.yml`, or (b) keep warn-only and correct every sentence that claims the audit can fail a pull request, recording the reasoning in `agents/evidence/analysis/workflow-security-net-degraded-decision.md`.
- **Resolved when:** a council verdict with two seats is recorded in `agents/evidence/analysis/workflow-security-net-degraded-decision.md` naming (a) or (b), as a decision-revisit of the 2026-06-13 lock.
- **Recommendation:** (a) — the decision page records that the only reason not to was that no council seat was available, and `agent-config council:status` is the check that answers whether that still holds.
- **If you do nothing:** the audit stays a log line; a HIGH in a workflow change merges with a green check.
- **Resolution (2026-10-07):** option (a), AI council 2/2 (anthropic + openai, one round with peer review, $0.00 metered), recorded as a decision-revisit in `agents/evidence/analysis/workflow-security-net-degraded-decision.md` § Revisited 2026-10-07. The step runs `--strict`, the gate-coverage row's `argv` is `["--strict"]` with a canary recipe in place of `no_canary_reason`; tiers unchanged.

### blocker: pack-boundary-base-narrow-edge
- **Status:** open
- **Owner:** owner (product call), council advises
- **Blocks:** step 3.2
- **What to do:** pick exactly one — (a) add an advisory `suggests` edge to `packs.yml` that `src/scripts/lint_pack_boundaries.ts` reads as allowing a link, or (b) exempt base packs from the boundary rule in `src/scripts/lint_pack_boundaries.ts` and name them in the baseline note of `src/config/gate-violation-baselines.json`.
- **Resolved when:** the choice is recorded in the `lint_pack_boundaries` baseline note with its date and decider.
- **Recommendation:** (a) — it keeps the rule one-way and adds no install-forcing edge, which is the property the baseline note says `requires` lacks.
- **If you do nothing:** 3.1 still lands; base-into-narrow links stay de-linked to prose and stay inside the 203.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `--strict` reds a PR on a pre-existing HIGH | implementation | Promotion turns every existing HIGH into a failure on unrelated PRs. | The step's last recorded verdict was 0 HIGH over 34 files; 1.1 re-reads it before 2.1. | Phase 2 — The workflow-security severity |
| 2 | The pack step lengthens the consistency job | implementation | One more full-corpus scan on every PR. | D2 names the timeout as the revisit trigger. | Phase 3 — Pack boundaries a pull request runs |
| 3 | A scheduled canary leaves a plant behind | implementation | The gate refuses to overwrite and asks for manual removal on failure (`check_gate_coverage.ts:839`, `:899`). | The job runs in a throwaway checkout and uploads only the ledger. | Phase 4 — Reads that do not write, and a canary that runs |
| 4 | The comparator needs a token the tree does not hold | product | Reading rulesets needs repository read access. | It is a report run by hand or by a scheduled job with that scope; nothing gates on it. | Phase 5 — The required checks the contract names |
