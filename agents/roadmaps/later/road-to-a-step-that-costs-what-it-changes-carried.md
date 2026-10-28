---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-step-that-costs-what-it-changes
entry_condition:
  what: a drain over the largest active roadmap reads every closed step under 40 KB (blocker largest-roadmap-drain-under-forty-kb), or a step on the active depth table carries an active receipt (blocker five-drains-on-the-flipped-table)
  when: at the next process-full drain over the largest active roadmap, and from the first R0/R1 step whose every path is inside D18's scope
  who: none until a Run command of either blocker reads true; then an implementer ticks 1.3 or starts counting the five drains
review_by: 2026-11-24
estate_growth_exempt: >-
  Parked carry of road-to-a-step-that-costs-what-it-changes, archived in the
  same change: steps 1.3, 4.2, 5.1, 5.2 and AC-2..AC-4 wait on drains no run can
  produce (D22). The active count drops by one while the later count rises by
  one; both open blockers moved with the steps and were closed in the parent,
  so open_blockers is unchanged.
---
# Road to a step that costs what it changes — carried

> **Source:** carried by the archival sweep on 2026-10-26 from
> [`road-to-a-step-that-costs-what-it-changes`](../archive/road-to-a-step-that-costs-what-it-changes.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-step-that-costs-what-it-changes deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Context carried with the steps

- **D20** (2026-10-27): `probe_turnaround --steps` closes a lane's step at the
  commit that flipped its box; the join is the lane's dispatch prompt naming the
  roadmap file. Without it no lane-run drain was readable for 1.3 or 5.1.
- **D21** (2026-10-27): a drain counts toward 5.1's five only if one of its
  steps carries an `active` receipt; the window starts at the first one.
- **D22** (2026-10-27): 1.3 waits for the next drain over the largest active
  roadmap; § 5 step 1 is unchanged. The setup drain of 2026-10-24/25 read
  75.0 KB (4.10) and 68.2 KB (3.3+3.6+4.6c); a second such drain makes it a
  pattern to fix.

The parent's full Decisions table (D1-D22) stays in the archived parent.

## Phase 1 — Deferred steps carried from road-to-a-step-that-costs-what-it-changes

- [ ] **1.3 Read the current phase, `## Decisions` and `## Blockers` per step.** Contract changed 2026-10-21, verify pending: `--steps` counts roadmap text returned to `Read` and to shell reads per step (R2 finding 4 — an early tick on `Read` alone was withdrawn). Over 242 steps p50 0 KB, p90 33.7 KB; but the largest active roadmap had a step read 86.2 KB and the second 46.8 KB, over the target. The loop's § 5 step 1 now says: the step's own section by `grep -n` plus a ranged read, never the whole roadmap. Closes on the first drain over the largest roadmap reading < 40 KB per step; none since 2026-10-21 (2026-10-24). <!-- blocked-by: largest-roadmap-drain-under-forty-kb -->
      Other sections are read on demand. Decisions stay whole, as
      `roadmap-process-loop.md:162-173` requires.
      verify: a drain over the largest active roadmap reads < 40 KB of it per
      step (0.1 `ceremony` input bytes).
- [ ] **4.2 Rule depth by class, behind an A/B.** Waits per OQ-6 (a) (D19): mechanism and paid A/B are decided with the flip data in hand. R0/R1 steps receive the <!-- blocked-by: five-drains-on-the-flipped-table -->
      kernel plus rules whose triggers match the changed paths; R2/R3 keep
      today's delivery. Paired A/B on the benchmark's frozen tasks: discipline
      score not below the full arm's lower CI bound. No settings key.
      Note (2026-10-28, `road-to-a-bench-that-fails-when-nothing-was-done` 4.1):
      on those tasks a do-nothing `nop` arm scores discipline 1.0 on 23 of 33;
      this A/B reads `discipline_given_capability` and the per-task `nop` floor
      from `bench_ab_v2_stats`, both printed since that repair.
      verify: the A/B report is committed before the flip commit.
- [ ] **5.1 Read the Goal over five drains.** Speed and escape rate together; <!-- blocked-by: five-drains-on-the-flipped-table -->
      neither alone closes the roadmap.
      verify: a Decisions row with both figures.
- [ ] **5.2 Independent review of the reading.** One round. <!-- blocked-by: five-drains-on-the-flipped-table -->
      verify: findings or an honest null over denominators and windows.

## Blockers

### blocker: largest-roadmap-drain-under-forty-kb
- **Status:** open — 2026-10-27, with git-recorded flips joined to lane transcripts (D20): over the 11 stores of this repository (312 transcripts, 125 closed steps since 2026-10-21) the largest active roadmap, `road-to-a-setup-that-decides-itself` (79 KB), shows 5 closed steps from its 2026-10-24/25 drain, maximum 75.0 KB (4.10, one whole-file `Read`), then 68.2 KB (3.3+3.6+4.6c), 9.9 KB (4.9), 9.6 KB (4.7), 0.3 KB (5.1). Two steps read over 40 KB, so § 5 step 1 was not followed on that drain. Was: 2026-10-25, no drain
- **Class:** 0
- **Owner:** agent
- **Blocks:** step 1.3
- **Run:** `./scripts-run src/scripts/probe_turnaround --steps --store <every store of this repository, comma-separated>`, reading `roadmapReadBytes` per closed step of the largest active roadmap
- **Question:** none — this waits on a drain, not a decision; nothing in this run can produce a drain over another roadmap without executing that roadmap.
- **Recommendation:** close 1.3 on the first drain whose every step reads < 40 KB of the largest roadmap; if a step reads more, the § 5 step-1 instruction is not being followed and that is the defect to fix.
- **If you do nothing:** 1.3 stays open; nothing else here waits on it.
- **What to do:** after the next drain over `agents/roadmaps/archive/road-to-self-modification-that-a-council-must-pass.md`, run the **Run:** command and either (1) tick 1.3 with the per-step maximum, or (2) open the defect in `src/agent-src/contexts/execution/roadmap-process-loop.md` § 5 step 1.
- **Resolved when:** a drain over the largest active roadmap shows every closed step reading < 40 KB of it, and 1.3 is ticked with that reading.

### blocker: five-drains-on-the-flipped-table
- **Status:** open — 2026-10-27, the window has not started (D21): `--flip-readiness` reads R0 7, R1 0 (unchanged), and no receipt in the tree carries `active`: every R0/R1 tick merged since the flip touched a path outside the D18 scope, so no step has yet run at lowered depth. Was: 2026-10-25, the table went `active` (4.1, D19)
- **Class:** 0
- **Owner:** agent
- **Blocks:** steps 4.2, 5.1, 5.2; AC-2, AC-3, AC-4
- **Run:** `./scripts-run src/scripts/probe_depth_shadow --flip-readiness` and `./scripts-run src/scripts/probe_turnaround --steps --store <every store of this repository, comma-separated>`
- **Question:** none — this waits on five drains, not a decision. OQ-6 (a) places 4.2's mechanism decision after the flip data exists.
- **Recommendation:** count drains from 2026-10-25; at five, read 5.1 against D14 (1) and (4) and decide 4.2 on the same data.
- **If you do nothing:** the flipped table keeps running under 4.3's audit; Phase 5 stays open.
- **What to do:** (1) at each drain re-run the **Run:** commands; (2) after the fifth, write the 5.1 Decisions row with both figures; (3) put 4.2's mechanism to the owner with that row; (4) run 5.2.
- **Resolved when:** five drains on the active table, each with at least one step carrying an `active` receipt and counted from the first such receipt (D21), are read in a Decisions row and 5.1 is ticked. If safe-scope steps alone cannot fill that window, widening D18's scope is an owner question; nothing here acts on it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-step-that-costs-what-it-changes |

## Acceptance Criteria

- [ ] AC-2 — No R3 change ran below today's depth; receipts show it.
- [ ] AC-3 — Over five drains after the flip, p50 step wall-clock ≤ 50 % of the Phase 0 baseline and the escape rate on lowered classes ≤ the 0.2 threshold.
- [ ] AC-4 — Required CI red-after-merge rate over the same drains is not above the Phase 0 window.
