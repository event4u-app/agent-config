---
complexity: structural
status: ready
review_by: 2026-12-10
tree_pin: 7713a5fd12
estate_growth_exempt: "Created on 2026-11-10 by the owner's instruction ('3, beides aktiv machen'): a roadmap of its own for the funded five-arm comparison and the measurement on real tasks, its steps moved out of later/road-to-a-start-as-light-as-the-field 1.4-1.7. No active roadmap owns a comparison against no rules; stubs/road-to-a-showcase-the-owner-paid-for and later/road-to-reach-cost-primary-bench are related, and neither runs it."
estate_offset_exempt: "Created on the owner's instruction with 11 of 25 active; its steps were moved, not duplicated, so start-as-light loses four open steps and nothing is archived to offset."
execution:
  mode: phase-checkpoints
relates:
  - slug: later/road-to-a-start-as-light-as-the-field
    relation: extends
    note: "Its 1.4-1.7 moved here on 2026-11-10. It keeps 1.1-1.3, the start cut itself, and reads this file's result before it cuts again."
  - slug: later/road-to-reach-cost-primary-bench
    relation: extends
    note: "Owns the cost contract (primary metric, minimum effect, maintenance ledger). Cost per solved task here is descriptive until that contract exists."
  - slug: stubs/road-to-a-showcase-the-owner-paid-for
    relation: extends
    note: "The published showcase. A BETTER reading here is the first backed number it could cite, scoped to this corpus and model."
---

# Road to a package measured against no rules

> **Source:** `agents/tmp.old/inbox-2026-11-wo/` — three sources asking whether
> the package beats no rules and a minimal prompt, and at what price per solved
> task. Funded by the owner on 2026-11-10
> (`agents/evidence/owner-directives/2026-11-10-five-arm-bench-budget.md`).

## Goal

A published, pre-registered answer to whether the package solves more tasks
than no rules and a minimal prompt, and at what price per solved task. The
answer comes first on this repo's corpus, then on real tasks.

## Context

The adapted layer is NON-INFERIOR to the full layer on Haiku 4.5 and Sonnet 5.5
(#2964). That compares the package with itself. Nothing in the tree compares it
with no rules, and every external review since 19.x asks for that number. The
corpus is mostly at the ceiling or the floor: two of seven held-out tasks
separated the arms on each model, so a task-selection stage comes first.

## Phase 1 — Five arms on one corpus (funded)

- [ ] **1.1 Stage A, the pilot.** Run the two-arm pilot on 38 tasks and apply the
      selection rule of
      `agents/evidence/preregistration/five-arm-comparison-protocol-20261110.md`
      § 2.
      verify: a selection note under `agents/evidence/metrics/` naming 6-12 tasks, each with its pooled pilot J inside [0.10, 0.90] or marked as a fill-up.
- [ ] **1.2 Stage B, the comparison.** Run all five arms on the selected tasks
      under § 3, at most $65.
      verify: the report names claude-sonnet-5-5, tree_dirty false and five arms, and its spend is at most 65 USD.
- [ ] **1.3 The reading.** A result file applies § 4: the primary
      `package − vanilla` reading, the four secondary contrasts, cost per solved
      task with its bootstrap interval, tokens, turns and wall time per arm.
      `docs/CLAIMS.md` changes only as § 5 allows.
      verify: `agents/evidence/metrics/five-arm-comparison-result-20261110.md` states BETTER, WORSE or INCONCLUSIVE against the frozen rule.
- [ ] **1.4 Tasks that discriminate.** Moved from start-as-light 1.4. If Stage A
      selects fewer than five tasks strictly inside (0, 1), write the tasks that
      are missing for the corpus so the next cut rests on more than two.
      verify: a pilot report listing per-task mean J per arm with at least five tasks inside (0, 1).

## Phase 2 — The two readings the confirmation left open

- [ ] **2.1 The dropped task, re-tested.** Moved from start-as-light 1.5. Write an
      ask rubric for `trapC-ambig-01` and re-run it with 16 seeds on the full and
      the adapted layer, pre-registered.
      verify: a result file under `agents/evidence/metrics/` citing its pre-registration.
- [ ] **2.2 Length as a primary.** Moved from start-as-light 1.6. Pre-register the
      padded-versus-reduced comparison on Sonnet as the primary endpoint, so the
      −0.052 secondary reading is confirmed or dropped.
      verify: a result file that states the reading against a margin fixed before data.

Both cost money and neither is funded: the 2026-11-10 budget covers Phase 1
only. Each one is put to the owner with its price once Phase 1 has read.

## Phase 3 — Real tasks

- [ ] **3.1 Pre-register a real-task set, no spend.** Use the review's six classes:
      a multi-file refactor, an unknown defect, a Laravel or TypeScript
      feature, a security fix, a UI change and a regression-prone change. Each
      class gets at least two tasks, independent tests written by a session
      that never sees an arm, and the same five arms and statistic as Phase 1.
      verify: a protocol under `agents/evidence/preregistration/` with the task list, the test authorship record and a price estimate.
- [ ] **3.2 Run it.** <!-- blocked-by: real-task-run-budget -->
      verify: a result file under `agents/evidence/metrics/` citing 3.1's protocol.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | deterministic | agent | 1.1's verify is checked by recomputing each selected task's pooled J from the Stage A report; a task outside the band without a fill-up mark fails it. | unfalsifiable-verify:45 | — |
| C2 | deterministic | agent | 1.2's verify reads three report fields and the spend; any one of them off fails it. | unfalsifiable-verify:50 | — |
| D1 | business-owned | owner | Fund Phase 2 and the 3.2 run? Asked with a price after Phase 1 reads. | Phase 2 note, blocker real-task-run-budget | — |

## Blockers

### blocker: real-task-run-budget

- **Status:** open, 2026-11-10.
- **Class:** 3 — human-only. Spend above the released budget.
- **Owner:** the repository owner.
- **Blocks:** 3.2.
- **What to do:** after 3.1 states the price, decide whether to fund the run.
- **Resolved when:** an owner directive names the budget for 3.1's protocol.
- **If you do nothing:** the only comparison against no rules is the corpus one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A corpus result read as a product claim | product | A BETTER on a discipline corpus could be quoted as "AC beats no rules" in general | § 5 of the protocol scopes any claim to this corpus, model and tree; Phase 3 is the real-task answer | Phase 1 — Five arms on one corpus (funded) |
| 2 | A pilot that selects too few tasks | implementation | If the corpus has under six tasks inside the band, Stage B rests on fill-ups near the ceiling | The fill-up rule is frozen, and 1.4 writes the missing tasks before the next cut | Phase 1 — Five arms on one corpus (funded) |
| 3 | Real-task tests written by the measured party | product | Tests authored with knowledge of an arm grade that arm | 3.1 requires tests from a session that never sees an arm, recorded | Phase 3 — Real tasks |

## Acceptance Criteria

- [ ] AC-1: Phase 1's reading is published whatever it says.
- [ ] AC-2: Every next step is chosen by task success per token, minute and
      correction loop, measured against no rules and a minimal prompt, not by
      adding rules or agents (the direction constraint of round inbox-2026-11-wo).
