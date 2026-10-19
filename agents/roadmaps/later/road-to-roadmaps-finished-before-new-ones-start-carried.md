---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-roadmaps-finished-before-new-ones-start
entry_condition:
  what: five `/roadmap:process-full --all` runs have completed on a main that carries the parent's lane brief and drain queue
  when: after five drains run on that main, whenever the owner starts them
  who: owner
review_by: 2026-12-31
relates:
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Its step 2.3 re-decides the two-lane provision (D10 there, D2 of the parent) on cost and conflict figures. 6.1 here reads completion outcomes; neither re-plans the other."
---
# Road to roadmaps finished before new ones start — carried

> **Source:** carried by the archival sweep on 2026-10-19 from
> [`road-to-roadmaps-finished-before-new-ones-start`](../archive/road-to-roadmaps-finished-before-new-ones-start.md), which closed every other step.
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
      Read for OUTCOME, not only function (owner review 2026-10-19): the same
      file also states, against the 2026-09-20..10-19 baseline, roadmaps archived
      per drain, open steps left behind per drain (partial roadmaps the drain
      touched and did not close), and items carried out of a roadmap per
      archive. The contract works only if archives rise while left-behind and
      carried items fall; a higher lane complete-share with the same archive
      rate is not a success.
- [ ] **6.2 Make `complete` mean finished, not only zero open boxes.** Today a
      roadmap is `complete` at `count_open == 0` with an open PR on green CI.
      Owner review 2026-10-19 named four gaps, each to be closed in
      `/roadmap:process-full` § Terminal outcomes and in the archive sweep:
      every acceptance criterion is `[x]` with its evidence line (a `[~]` AC
      blocks `complete`); CI is green on the head that is merged, not an earlier
      one; the independent completion review the change class requires has a
      recorded verdict; and every item carried out of the roadmap is listed in
      the PR body with its destination and why it could not run — a carry of
      runnable work is refused, as it already is for `[~]` in template rule 17b.
      verify: a sweep test over a fixture roadmap with all steps `[x]` and one
      `[~]` AC refuses `complete`; a fixture carrying a runnable step is refused;
      both seen red with the new check neutralised.

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
