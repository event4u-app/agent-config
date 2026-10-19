---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-roadmaps-finished-before-new-ones-start
---
# Road to roadmaps finished before new ones start — carried

> **Source:** carried by the archival sweep on 2026-10-19 from
> [`road-to-roadmaps-finished-before-new-ones-start`](archive/road-to-roadmaps-finished-before-new-ones-start.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-roadmaps-finished-before-new-ones-start deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-roadmaps-finished-before-new-ones-start

- [ ] **6.1 Read the next five `--all` runs.** Re-run the 2026-10-19 lane
      classification on the five drains after Phase 5 lands.
      verify: an evidence file with the same table shape as the 2026-10-19
      reading; complete-share, intermediate PRs per roadmap, and unstarted
      roadmaps started while a started one was runnable.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-19 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-roadmaps-finished-before-new-ones-start |

## Acceptance Criteria

- [ ] AC-2 — Over the five runs read in 6.1, no unstarted roadmap was started
      while a started roadmap had a runnable step and no lane.
      Deferred 2026-10-19 by D2: measured over five runs that start after this lands.
- [ ] AC-3 — Over the same runs, every roadmap that a lane completed landed as
      exactly one PR, and at least half of the drain lanes ended `complete`
      (baseline 8 %).
      Deferred 2026-10-19 by D2, same reason.
- [ ] AC-4 — Every owner-reserved step met in those runs was asked during the
      run and its answer recorded at the step; none was left only in a lane
      report.
      Deferred 2026-10-19 by D2, same reason.
