---
complexity: lightweight
status: later
tree_pin: ea21dd17a4
execution:
  mode: phase-checkpoints
entry_condition:
  what: the full-vs-reduced comparison (step 5.2 of later/road-to-a-setup-that-decides-itself-carried) has a result file (blocker start-cut-waits-on-full-vs-reduced)
  when: after that comparison runs; it waits on an observed effect row and on the release spend decision of round inbox-2026-11-zc
  who: the run that executes 5.2 there; then an implementer takes Phase 1 here on its result
review_by: 2027-01-31
estate_growth_exempt: >-
  Parked on arrival. An operator decision recorded in the same source set says
  no new large start-size architecture before the effect of the existing cut is
  measured; this file holds the start-size target that a later round of the
  same set asked for, so neither demand is dropped and neither overrides the
  other. Owner search (grep -rlF -e "session-start" -e "first-turn" over
  agents/roadmaps/) found the active session-start roadmap, which owns the
  ≤80k cut already landed; this file owns only what would come after it.
relates:
  - slug: road-to-a-session-start-under-the-host-limit
    relation: extends
    note: "That file landed the ≤80k cut (79,845 chars). This one holds the next target and waits on its measured effect."
  - slug: road-to-a-setup-that-decides-itself-carried
    relation: disjoint
    note: "Its step 5.2 is the comparison this file waits on."
---
# Road to a start as light as the field

> **Source:** `agents/tmp.old/inbox-2026-11-zc/` (topics t2 and t3: an external
> start-size comparison and the reviewer report relayed by the operator).

## Goal

A consumer session should start with a footprint comparable to the external
reference harnesses: about 40k characters for the full layer and about 20k for
the reduced one. This file holds that target. It does not start the cut. The
cut to ≤80k has landed, and nobody has measured whether it changed outcomes.
Cutting again before that measurement would repeat the mistake the operator
named in the same set: removing before proving.

## Phase 1 — after the comparison

- [ ] **1.1 Read the comparison before choosing a target.** <!-- blocked-by: start-cut-waits-on-full-vs-reduced -->
      If the reduced layer is non-inferior, the ≤40k/≤20k targets become this
      file's pre-registered thresholds. If it is inferior, record which
      obligations the loss traces to, and keep them in any further cut.
      verify: a pre-registration under `agents/evidence/preregistration/` cites
      the comparison's result file.
- [ ] **1.2 Count the first turn, not only the file.** <!-- blocked-by: start-cut-waits-on-full-vs-reduced -->
      Measure the characters a fresh session actually receives before the first
      user prompt, hooks included. The file size is a lower bound.
      verify: one census row per bound host, with the host version recorded.
- [ ] **1.3 Adapt before removing.** <!-- blocked-by: start-cut-waits-on-full-vs-reduced -->
      Before an obligation leaves the start layer, try a shorter form or a
      later carrier, and measure that form first. This is the operator's
      standing order for this set: delete only as a last resort.
      verify: every removal record names the adapted variant it measured.
      Note 2026-11-09: first adapted variant measured (contract stubs for two rules): INCONCLUSIVE by the per-task veto, see the blocker status. No removal was recorded on it.

## Blockers

### blocker: start-cut-waits-on-full-vs-reduced

<!-- asked: 2026-11-08 | record: agents/roadmaps/later/road-to-a-setup-that-decides-itself-carried.md -->

- **Status:** open, raised 2026-11-08 by round inbox-2026-11-zc. 2026-11-09: the comparison has a result file, `agents/evidence/metrics/full-vs-reduced-layer-result-20261109.md`. It reads **INFERIOR**, so by 1.1 a further cut is off the table: the loss has to be traced first. The blocker stays open until the owner decides how the inferior result is handled (keep the reduced default and trace the loss, or restore full). 2026-11-09, later: the owner chose to adapt first (1.3). The adapted form (startup contracts for `downstream-changes` and `think-before-action`) ran under `agents/evidence/preregistration/adapted-vs-full-layer-protocol-20261109.md` and reads **INCONCLUSIVE** (`agents/evidence/metrics/adapted-vs-full-layer-result-20261109.md`): primary LB −0.066 clears the −0.10 margin, but `trapE-scope-laravel-01` meets the per-task veto at Σd −5.0, where four adapted runs asked which currency to pass instead of updating the caller. The blocker stays open; the owner decides between further tracing and restoring full.
- **Class:** 1. The condition is a result another file produces; no decision is owed here.
- **Owner:** `road-to-a-setup-that-decides-itself-carried` step 5.2.
- **Run:** `ls agents/evidence/metrics/ | grep -i full-vs-reduced`. The blocker clears when a result file exists.
- **Blocks:** steps 1.1 to 1.3.
- **What to do:** nothing here until the comparison has a result; then start with 1.1.
- **Resolved when:** the 5.2 result file exists and carries the claims gate's honesty label.
- **Recommendation:** leave it. A target without the measurement would be a guess.
- **If you do nothing:** the start stays at the ≤80k layer, which is today's shipped state.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A target copied from another harness | product | The external harnesses' sizes reflect what those harnesses carry, not what this suite guarantees | 1.1 adopts a target only after the comparison shows the reduced form holds | Phase 1 — after the comparison |
| 2 | Waiting forever | implementation | The comparison waits on an effect row and on a spend decision | The blocker names its owner and the check; `review_by` re-raises it | Phase 1 — after the comparison |

## Acceptance Criteria

- [ ] AC-1: Any start-size target this file adopts cites a measured comparison, and every removal it records names the adapted variant it measured first.
