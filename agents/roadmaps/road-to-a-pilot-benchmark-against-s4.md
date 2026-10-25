---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner answered OQ-17 on 2026-10-25 by choosing the funded pilot. The subject is owned by stubs/road-to-assurance-benchmark only as an assurance ablation whose promotion probe needs three capabilities this pilot does not use; a head-to-head against a neighbour package has no other owner (search: grep -rlF -e 'neighbour arm' -e 'head-to-head' over agents/roadmaps/*.md, later/ and stubs/ found only that stub). Four active roadmaps leave the WIP slot this takes."
relates:
  - slug: road-to-assurance-benchmark
    relation: disjoint
    note: "That stub owns the assurance ablation (risk policy, bootstrap, mutation arms). This roadmap measures this package against a neighbour package on existing A/B task classes and touches none of its promotion conditions."
---
# Road to a pilot benchmark against S4

> **Source:** owner answer to OQ-17 (2026-10-25), after round
> `inbox-2026-10-au` — the fifth arrival of the demand that this package's
> effect be measured against a neighbour (deny group S4) before any claim of
> advantage.

## Goal

One pre-registered, cost-capped pilot answers, in both directions and with
intervals, whether this package beats the S4 package or no package on two
existing task classes and one host. A null or a loss is recorded exactly like a
win, and no headline number is taken from it beyond what it measured.

## Constraints from the source

- Identical model, budget, host, tasks and repeats per arm; a no-package arm is
  always present.
- Quality, efficiency and safety are reported separately — no composite score.
- Targets are aspirations; the pre-registration, not the result, fixes the bar.

## Phase 1 — Pre-register before any spend

- [ ] **1.1 Fix the arms.** `vanilla` (no package), `package` (this package),
      `neighbour` (S4 at a pinned commit), each through `bench_ab_v2_run`.
      verify: the pre-registration file names the three arms and the S4 commit.
- [ ] **1.2 Fix two task classes from committed corpora.** The Laravel twin in
      `internal/bench/corpora/ab-trackb-v2.yaml` and the review corpus
      `defect-finding.yaml`; no new task is written for this pilot.
      verify: the pre-registration lists the task ids.
- [ ] **1.3 Fix host, n, metrics and the decision rule.** One host, n pairs per
      arm, the existing discipline and defect-recall scorers, tokens per run,
      and a paired direction test (`_lib/paired_verdict.ts`) with its threshold.
      verify: `git log --oneline -1 -- agents/evidence/preregistration/s4-pilot.md` -> /\w+/
- [ ] **1.4 Estimate the cost from the prior run.** Tokens per run from
      `docs/benchmark.md` § Cost-factor sweep times arms × pairs × tasks.
      verify: the estimate sits below the owner's cap, or the plan shrinks n until it does.

## Phase 2 — Bring S4 in without trusting it

- [ ] **2.1 Supply-chain intake of S4** via the `supply-chain-intake` skill:
      pinned commit, licence, every hook and install script it would execute.
      verify: the intake record names each executable S4 installs.
- [ ] **2.2 Threat-model the neighbour arm.** It runs third-party hooks inside
      the benchmark sandbox: no credentials, no network beyond the model API, a
      throwaway clone per run.
      verify: the threat-model note lists the controls and each is asserted by `bench_ab_integrity`.
- [ ] **2.3 Add the `neighbour` arm to `bench_ab_v2_run`.** Installs S4 into the
      per-run clone instead of this package.
      verify: a dry-run of one task per arm shows S4's files present only in the neighbour clone.

## Phase 3 — Run within the cap, record both directions

- [ ] **3.1 Run the pre-registered pilot**, stopping at the cap.
      verify: the run log shows spend at or under the cap and every planned pair completed or named.
- [ ] **3.2 Record per arm and per axis** in `docs/benchmark.md`, intervals
      included, a loss or null stated as plainly as a win.
      verify: the section names arms, n, host, cap and the verdict per axis.
- [ ] **3.3 Record the outcome on the assurance-benchmark stub** as an arrival
      answer, so a sixth arrival meets a number.
      verify: the stub's `Arrivals:` line cites this pilot's section.

## Blockers

### blocker: pilot-spend-cap
- **Owner:** user
- **Status:** resolved
- **Blocks:** 1.4, 3.1
- **What to do:** answer OQ-17 in `agents/owner-questions.md` with one of: (a) $50, (b) $150, (c) $400 for the whole pilot, or another figure.
- **Recommendation:** (b) $150 — a rough estimate (about 72 runs at roughly $1–2 each, from the token counts in `docs/benchmark.md` § Cost-factor sweep) puts n=12 pairs per arm on two task classes under it; step 1.4 recomputes before any spend.
- **If you do nothing:** Phases 1.1–1.3 and 2 proceed without spend; 1.4 and 3.1 stay open and the pilot does not run.
- **Resolved when:** the owner names a spend cap for the pilot in `agents/owner-questions.md` (OQ-17).
- **Resolution:** 2026-10-25, the owner chose **$150** for the whole pilot (OQ-17, Answered).
- **Evidence:** `cost.budgets` is set in no settings file (`agent-config settings:get cost.budgets`, 2026-10-25), and the owner's answer chose the pilot without a figure.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | owner-reserved | owner | A $150-capped pilot on existing corpora and one host. Rejected alternative: the eight-class corpus the source plans. | OQ-17 answered "1"; the full corpus is owned by `stubs/road-to-assurance-benchmark`. | The pilot shows a lift worth confirming at a larger n. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Third-party code in the run | implementation | S4's hooks execute during the neighbour arm | Intake, pinned commit, credential-free throwaway clones | Phase 2 — Bring S4 in without trusting it |
| 2 | Underpowered pilot read as a verdict | product | Small n produces a confident-looking difference | Intervals recorded, pre-registered decision rule, no headline beyond it | Phase 3 — Run within the cap, record both directions |

## Acceptance Criteria

- [ ] AC-1 — A pre-registration committed before the run fixes arms, tasks,
      host, n, metrics and the decision rule.
- [ ] AC-2 — The neighbour arm ran only inside credential-free throwaway clones
      of a pinned S4 commit.
- [ ] AC-3 — `docs/benchmark.md` reports the pilot per arm and axis, with
      intervals and the cap, whatever the result.
