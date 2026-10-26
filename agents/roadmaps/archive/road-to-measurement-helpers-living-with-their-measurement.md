---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner asked on 2026-10-25 for a roadmap on the three turn_end_refusals exports check_step_production_reach reported unreached during PR #2687. Search: grep -rlF -e collectShadowStats -e retryConditionedShare -e DISPATCH_CENSORED_DETECTORS over agents/roadmaps/*.md, later/ and stubs/ returned nothing. Four active roadmaps leave the WIP slot this takes."
---
# Road to measurement helpers living with their measurement

> **Source:** `check_step_production_reach` on PR #2687 (2026-10-25) reported
> three exports of `src/scripts/_lib/turn_end_refusals.ts` as tested but
> unreached from any production entry. The owner asked for a roadmap.

## Goal

The three helpers only the turn-end-gate measurement uses —
`collectShadowStats`, `retryConditionedShare`, `DISPATCH_CENSORED_DETECTORS` —
live where a production-reach check can see their one caller, so no later step
that names `turn_end_refusals.ts` is refused for them.

## Context

They are not dead. `src/scripts/measure_turn_end_gate.ts` imports all three and
is run by hand (last in `road-to-one-verification-classifier` 2.4). It is named
by no taskfile, workflow, command or skill, so `src/config/production-entries.json`
does not count it as an entry, and the shared library carries code the gate's
own path never reaches.

## Phase 1 — Pick the home, then move or wire

- [x] **1.1 Decide between two shapes and record why.** (a) Move the three into <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/turn_end_refusals.ts -->
      `measure_turn_end_gate.ts`, the only importer, with their tests. (b) Give
      the measurement a task in `taskfiles/` so it becomes an entry by the
      config's own rule. Recommendation: (a) — the helpers serve one maintainer
      tool, and a task only to satisfy a gate is a wiring nobody runs.
      verify: the `## Decisions` table names the choice and the reason.
- [x] **1.2 Apply the chosen shape.** For (a): move the code and its tests, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/turn_end_refusals.ts -->
      leave `turn_end_refusals.ts` exporting nothing the gate path does not use.
      verify: `npx vitest run tests/scripts/turn_end_refusals.test.ts tests/scripts/measure_turn_end_gate.test.ts` -> 0
      production entry: src/scripts/measure_turn_end_gate.ts
- [x] **1.3 Prove the reach finding is gone.** A fixture step naming <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/turn_end_refusals.ts -->
      `src/scripts/_lib/turn_end_refusals.ts` passes the reach check.
      verify: `grep -rn 'collectShadowStats' src/scripts/_lib/turn_end_refusals.ts` -> /^$/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Shape (a): the shadow rollup moves into `measure_turn_end_gate.ts`, its only importer. Rejected alternative: (b) a taskfile entry that makes the measurement an entry. | The three exports and their two types are read by that one script and its tests; a task added only to satisfy the reach gate is wiring nobody runs. | A second production reader of the shadow rollup appears. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Measurement drift | implementation | Moving the helpers changes what the measurement computes | Run `measure_turn_end_gate` on the same corpus before and after and compare | Phase 1 — Pick the home, then move or wire |

## Acceptance Criteria

- [x] AC-1 — No export of `turn_end_refusals.ts` is reported unreached by
      `check_step_production_reach`.
- [x] AC-2 — `measure_turn_end_gate` produces the same figures on the same
      corpus before and after.
