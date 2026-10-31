---
complexity: lightweight
status: ready
tree_pin: 818dbb3dbe
execution:
  mode: autonomous
review_by: 2026-12-15
estate_offset_exempt: "Owner-invoked inbox round inbox-2026-10-bm with execution in the same change (owner, 2026-10-31: \"danach arbeite die roadmaps ab mit /roadmap:process-full\"); the file closes and archives in the PR that adds it. Owner search at 818dbb3dbe (grep -rlF for fix_loop_max, N=3, FIVE detectors, interruption_report, mission_record over agents/roadmaps, later, stubs): later/road-to-adversarial-verification-and-long-runs owns the delivery state machine (8.1) and the N=3 drift acceptance (AC-4), which this file feeds rather than replaces; nothing owns the doc drift itself."
relates:
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "Feeds its AC-4 (bound drift) and reopens its 9.1 with evidence; its 8.1 keeps the finish-line decision."
  - slug: road-to-residual-interruption-measurement
    relation: extends
    note: "Adds one reader class to interruption_report."
---
# Road to a run contract that agrees with itself

> **Source:** `agents/tmp.old/inbox-2026-10-bm/` (topic T2).
> **Arrivals:** 1 — `inbox-2026-10-bm` (2026-10-31). Owner demand
> (2026-10-22): `/roadmap:process-full` runs a whole roadmap to the end, no
> mid-run stops, extra PRs or questions; the same for "do X to the end".

## Goal

The run surfaces say one thing: the retry bound the docs name is the one the
rule enforces, the gate's header counts its real detectors, a run that ended
without reaching its terminal state is countable, and a step marked done is
done.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Docs name `execution.fix_loop_max` (default 10) and its ladder instead of N=3; the "five — and only five" halt wording stays. Options: reword / keep / delete | `autonomous-execution.md` default 10, ADR-268 § 7 | the rule's default changes |
| D2 | reversible-technical | agent | The finish-line detector, process-phase PR topology, halt-list shrink, run-start owner sheet and default flips stay with their owners; this file builds none of them | later/road-to-adversarial-verification-and-long-runs 8.1 owner question; council lock 2026-08-20 | the owner answers 8.1 |
| D3 | reversible-technical | agent | A step marked done whose deliverable is absent is reopened with its evidence, never silently rewritten | fix-what-you-see | — |

## Phase 1 — One bound, one count

- [x] **1.1 Bound drift test first.** `tests/e2e/adversarial-verification-fixtures.test.ts` <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      also scans `src/domains/product-basic/roadmap/**`,
      `src/agent-src/contexts/execution/*.md` and `src/domains/engineering-base/mission/**`
      for a stale N=3 retry bound; then the lines are reworded.
      verify: `npx vitest run tests/e2e/adversarial-verification-fixtures.test.ts` -> 0 after being seen red before the rewording.
- [x] **1.2 ADR-118 supersede note.** Rejection 3 carries "N=3 superseded by <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      ADR-268 § 7".
      verify: `./scripts-run src/scripts/adr_cite_check ADR-118` -> 0
- [x] **1.3 Gate header counts its detectors.** `turn_end_gate_hook.ts` header <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/turn_end_gate_hook.ts -->
      names every `DetectorId`; a test pins header count to the id list.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` -> 0
- [x] **1.4 process-full row says the invocation is the confirmation.** The <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      scope-delta table in `roadmap-process-loop-close.md` agrees with
      `roadmap-execution-contract.md` for process-full (ADR-237).
      verify: `npx vitest run tests/scripts/process_full_lane_brief.test.ts` -> 0 with an assertion on that row.

## Phase 2 — A run that ended silently is countable

- [x] **2.1 `unterminated` reader class.** `src/scripts/interruption_report.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/interruption_report.ts -->
      joins a run's roadmap with its open-step count and `RUN_TERMINAL_STATES`
      and reports runs that ended neither complete nor blocked.
      verify: `npx vitest run tests/scripts/interruption_report.test.ts` -> 0 with three runs (met, blocked, silent).
- [x] **2.2 Reopen a done step with no writer.** If <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json -->
      `_lib/mission_record.ts` has no production writer, long-runs 9.1 goes back
      to `[ ]` with that evidence.
      verify: `grep -rn "mission_record" src/scripts --include=*.ts` -> /typed_op_grant/ names the importers; `./agent-config roadmap:progress` green.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-31 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Rewording loosens a halt | governance | Touching the halt prose could weaken the five-halt list a fixture pins | Only the retry-bound sentence changes; the pinned wording stays | Phase 1 — One bound, one count |

## Acceptance Criteria

- [x] AC-1 — No run surface names a retry bound other than `execution.fix_loop_max`, enforced by a test.
- [x] AC-2 — `interruption_report` counts a silently ended run.
