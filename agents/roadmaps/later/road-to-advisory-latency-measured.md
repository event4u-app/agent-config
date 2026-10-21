---
complexity: lightweight
status: later
review_by: 2026-12-15
entry_condition:
  what: >
    Thirty days of real advisory data exist: the per-project advisory cache
    (`<git-common-dir>/agent-config/advisories.json`) of at least one project
    carries ledger entries whose `first_seen` spans 30 days or more, so a TTN
    reading is a history rather than one refresh. Checkable without judgement:
    `agent-config audit:deps show --json` on that project, oldest and newest
    `first_seen` 30 or more days apart.
  when: >
    Calendar-bound by construction: not before 2026-11-20, thirty days after the
    refresh shipped. `review_by: 2026-12-15` forces a re-read if nobody took the
    reading by then.
  who: >
    An implementer with access to a project that has run `audit:deps refresh`
    for 30 days. No owner decision is pending: the bars were pre-registered in
    `docs/CLAIMS.md` before any measurement existed.
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Adds one file to `later/` rather than moving one there: it receives the single time-gated step of road-to-advisories-heard-the-same-day (5.5, publish the measured TTN after 30 days), which no run can execute before 30 days of data exist. The parking allowance covers a move, and the parent cannot be moved — every other step of it is done in the same change and it archives."
estate_offset_exempt: "Receives the one time-gated step of road-to-advisories-heard-the-same-day, which closes in the same change. A grep over agents/roadmaps/{*,later,stubs} for advisory-time-to-notice and security-fix-time-to-remediation returns nothing outside the two claim rows, so no roadmap already owns the measurement; the alternative was leaving the parent open on a step that waits only for the calendar."
relates:
  - slug: road-to-advisories-heard-the-same-day
    relation: continues
    note: "Carries its step 5.5. The bar is that file's 0.1, pre-registered as `claim:advisory-time-to-notice`."
  - slug: road-to-security-fixes-carried-to-the-merge
    relation: continues
    note: "Measures `claim:security-fix-time-to-remediation` on the same 30 days, from the lifecycle stamps that file records."
---
# Road to advisory latency, measured

> **Source:** carried from `road-to-advisories-heard-the-same-day` step 5.5 on
> 2026-10-21, in the change that closed every other step of it.

## Goal

The two pre-registered latency claims — time-to-notice and time-to-remediation
— carry a status that a measurement set, never a sentence: `backed` when 30 days
of real data meet the bar written on 2026-10-21, `resolved-null` when they miss
it.

## Phase 1 — Take the reading, flip only on the bar

- [ ] **1.1 Measure TTN** over 30 days of one or more real projects: advisory
      publication → the ledger's `announced_at`, P50 and P90, and T0 separately
      where the daily CI schedule ran.
      verify: an evidence artifact under `agents/evidence/analysis/` records the
      projects, the window, the readings and the reproduce command.
- [ ] **1.2 Measure TTR** on the fixes made in the same window: accepted offer
      → first green settle of the fix PR, lockfile-only and runtime separately.
      verify: the same artifact carries the TTR readings per fix.
- [ ] **1.3 Set both claim statuses from the readings alone.** `backed` only on
      the pre-registered bar; `resolved-null` with the measured figures
      otherwise. A miss traced to the refresh cadence reopens the advisories
      roadmap's D6, not the bar.
      verify: `./scripts-run src/scripts/check_claims` -> 0

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reading is taken on one quiet project | product | A project with no advisories in 30 days measures nothing. | 1.1 names the projects and the number of findings; a window with none is recorded as no reading, not as a pass. | Phase 1 — Take the reading, flip only on the bar |

## Acceptance Criteria

- [ ] **AC-1** Both claim rows carry `backed` or `resolved-null` with the
      measured figures, and the evidence artifact the status rests on is
      committed.
