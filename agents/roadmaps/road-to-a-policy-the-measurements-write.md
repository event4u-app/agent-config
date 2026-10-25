---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
estate_offset_exempt: "Owner search: grep -rlF -e dispatch-policy -e review_by -e 'Measured in this release' over agents/roadmaps/*.md, later/ and stubs/ returned no roadmap whose goal is a dispatch-policy table, a claim review date or measured release notes. The nearest owners are archived (road-to-a-tier-the-dispatch-carries, road-to-a-tick-the-shipped-path-earns) or hold one lever each (later/road-to-a-cold-start-paid-once-carried: the reuse flip; later/road-to-experience-loop-owner-decisions: question 9.6). The owner asked in the same invocation for this round's roadmap to be executed, which is the one exception the 2026-10-24 directive names to parking a round in later/."
relates:
  - slug: road-to-a-learner-the-measurements-gate
    relation: extends
    note: "later/. Holds what needs a measurement window, a paid or subscription run, a new CI gate or a learner. This file builds the table, the review dates and the release section that one reads."
  - slug: road-to-experience-loop-owner-decisions
    relation: disjoint
    note: "later/. Its 9.6 question gets the owner's 2026-10-23 answer recorded as a pointer in this round; no step here consumes local experience."
depends: []
---
# Road to a policy the measurements write

> **Source:** `agents/tmp.old/inbox-2026-10-ar/` — one owner chat of 2026-10-23 and three
> supplied artefacts for it (a plan in this repo's format, a P0–P6 plan from a second
> reviewer, an annex). Tree facts re-read at `main@17e43fa94a` (release 18.1.0) on
> 2026-10-25; the plans were drafted at `ad30b6df` (17.0.0), 922 commits earlier.

## Goal

Every dispatch default AC ships — subagent tier and instruction skip per definition,
`max_parallel`, council rounds, the adversarial council — is one row of
`src/config/dispatch-policy.json`, and a test fails when a definition or config value
disagrees with its row. Each row names the claim that backs it, or says `unmeasured`
and carries the date by which it must be measured. The claim ledger reports which of
those measurements are overdue, and the release notes print which rows moved and which
are overdue — so the way AC works moves with the release, visibly.

## What this roadmap is not

Not a measurement run, not a CI gate that refuses a PR, not a local learner and not a
change to any shipped default. Those wait in
`later/road-to-a-learner-the-measurements-gate.md`, because each needs a window, a
paid or subscription run, or a ratified gate.

## Context — still true at `main@17e43fa94a`

| # | Defect | Evidence |
|---|---|---|
| M1 | **No dispatch default is bound to a claim.** The one binding the plan named (`ac-researcher-tier-follows-the-claim`) was removed and replaced by a guard that only forbids `lite` (`tests/scripts/subagent_contract.test.ts:171-176`). Unbound: `model_tier: inherit` (`src/subagents/ac-worker.md:7`, `ac-researcher.md:8`), `omit_project_instructions: true` (`ac-worker.md:35`, `ac-researcher.md:33`), `max_parallel: 3` and `adversarial_council: off` (`src/config/agent-settings.template.yml:846`, `:860`), council `min_rounds` 2 / `deep_min_rounds` 3 (`src/scripts/ai_council/config.ts:1515-1516`). |
| M2 | **Neither a PR nor a release has to show a measurement.** `.github/pull_request_template.md` has no measurement field; `release_highlights.ts` knows no measured section (`src/scripts/_lib/release_highlights.ts:38-44`). |
| M3 | **The ledger cannot say a measurement is overdue.** `last_verified` is parsed, never aged; no `review_by` field exists; unbacked entries are inventory and never fail (`src/scripts/check_claims.ts:15-16`, `:497`). |

Overtaken since the draft, and therefore not planned here: `ac-researcher` is back on
`inherit` (`e3f32ac44a`); the instruction skip was switched back on only after the
`subagent-constraints` carrier landed (`e4e82f9db0`, `src/scripts/hook_manifest.yaml:1444`);
the tier rerun ran pinned on 2026-10-23 and reads `underpowered` (`docs/CLAIMS.md:1403`);
egress (c) and (f) pass (`internal/bench/reports/egress-placeholders-identifier-roundtrip-2026-10-22.md`,
`…-engine-ci-2026-10-24.md`); `shadowAsk` has a production caller (`src/scripts/ask_transport.ts:281`).

## Phase 1 — One policy table and its binding test (M1)

- [x] **1.1 Add `src/config/dispatch-policy.json`.** One row per dispatch knob:
      `{ id, value, sink: { file, kind, key }, claim, review_by, local, note }` where
      `claim` is a claim id or `"unmeasured"`, and `local` is `fixed` or `learnable`.
      Seed rows: tier and instruction skip of `ac-worker` and `ac-researcher`,
      `max_parallel`, `adversarial_council`, council `min_rounds` and `deep_min_rounds`;
      plus the floors as `fixed` rows (`ac-researcher` with web tools never `lite`).
      Every row is `unmeasured` except `adversarial_council: off`, which cites its
      `resolved-null` claim.
      verify: the file parses and the test of 1.2 reads every row.
- [x] **1.2 One binding test.** `tests/scripts/dispatch_policy.test.ts` reads each
      row's sink — subagent frontmatter, settings-template key, council default in
      `config.ts` — and fails when the sink value disagrees with the row. A row citing a
      claim requires that claim to exist and to be closed (`backed` or `resolved-null`);
      an `unmeasured` row requires an ISO `review_by`; a floor row must be `fixed`.
      verify: the test passes on the tree, and each of a sink mismatch, a
      `learnable` floor and an `unmeasured` row without `review_by` is a failing
      fixture case.

## Phase 2 — The ledger says when a measurement is owed (M3)

- [ ] **2.1 `check_claims` reads `review_by:`.** Parsed beside `last_verified`; a
      malformed date is a finding; an `unbacked` entry past its `review_by` is printed
      under an `Overdue` heading without changing the exit code (report mode, decision
      A3).
      verify: the self-test covers a past-due entry (reported, exit 0) and a malformed
      date (exit 2).
- [ ] **2.2 `check_claims --status`.** Prints every open entry (`unbacked`,
      `measured-in-repo`) with status, `last_verified`, `review_by` and an overdue mark,
      one line each — the claim status listing the second reviewer asked for, without a
      new command.
      verify: `./scripts-run src/scripts/check_claims --status` lists the dispatch claims
      of 2.3 with their dates.
- [ ] **2.3 Date the open dispatch measurements.** Every open claim a policy row or
      `later/road-to-a-learner-the-measurements-gate` waits on gets a `review_by`:
      the two tier claims, `council-vs-solo-baseline`, the four free-hands and
      free-jury claims, `warm-worker-cold-start-relief`, `resume-non-inferiority`,
      `rate-limit-stops-per-drain` and `fresh-spawns-per-drain`.
      verify: `check_claims --status` shows a date on each of them.

## Phase 3 — Release notes and PRs carry the measurement (M2)

- [ ] **3.1 "Measured in this release" in the generated changelog.** A small module
      `src/scripts/_lib/dispatch_policy.ts` diffs the table at the previous tag against
      `HEAD` and lists moved rows (`row: old → new, claim`) plus `unmeasured` rows past
      `review_by`; `release.ts` renders it under the curated head when non-empty.
      verify: a unit test renders one moved row and one overdue row from fixtures, and
      renders nothing for an unchanged, dated table.
- [ ] **3.2 PR template gains a "Measurements" section** naming the policy row, the
      claim and the report a dispatch-default change rests on, with "none — no dispatch
      default changed" as the explicit empty answer.
      verify: the section exists in `.github/pull_request_template.md`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | Bind defaults with a vitest test, not a new CI gate script | a new gate needs a coverage row and a council ratification (`check_kernel_edit_ratified`); a test runs in the existing CI job | the PR-diff check of the later roadmap lands |
| A2 | reversible-technical | agent | No revert of the two 17.0.0 rows (draft Phase 0) | overtaken: `ac-researcher` is `inherit` again, and the skip came back only after its carrier shipped | the skip-quality claim of the later roadmap reads null |
| A3 | reversible-technical | agent | `review_by` reports overdue, never fails, for now | an overdue date nobody can satisfy inside a PR would block unrelated work; the release section makes it visible | two releases list the same overdue row |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The table drifts from a sink the test does not read | implementation | A default moves in a file no row names, and the table looks complete. | 1.1 seeds every knob listed in M1; a new knob without a row is the later roadmap's PR check. | Phase 1 — One policy table and its binding test (M1) |
| 2 | Review dates become decoration | product | Dates pass and nothing happens. | 3.1 prints overdue rows in every release; decision A3 names when report mode ends. | Phase 2 — The ledger says when a measurement is owed (M3) |

## Acceptance Criteria

- [ ] AC-1 — Every dispatch default named in M1 is a row of `dispatch-policy.json`, and a disagreeing sink fails a test.
- [ ] AC-2 — Every open dispatch claim carries a `review_by`, and `check_claims` reports the overdue ones.
- [ ] AC-3 — The generated changelog lists moved and overdue policy rows; the PR template asks for the measurement.
