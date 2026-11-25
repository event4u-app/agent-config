---
complexity: lightweight
status: ready
review_by: 2026-12-09
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Ordered by the owner on 2026-11-25 after a release of main was refused; it carries a live release blocker's permanent fix and completes no roadmap it could archive. A grep over agents/roadmaps/{*,later,stubs} for release.yml source checks blocked by an owner override returns nothing; the neighbours below own the ratification gate and the bypass-record detection, not the release gate. Authorised by agents/evidence/owner-directives/2026-11-25-owner-override-release-roadmap.md"
estate_growth_exempt: "Owner request in session on 2026-11-25: release main, then 'eine Folgeroadmap, dass wir das Problem dauerhaft beheben müssen'. Authorised by agents/evidence/owner-directives/2026-11-25-owner-override-release-roadmap.md"
relates:
  - slug: road-to-review-loops-that-converge
    relation: depends-on
    note: "Its open owner blocker owner-override-satisfies-ratification-ci decides whether an owner record turns the ratification gate green — the root of this roadmap's defect. Phase 3 here waits for that answer."
  - slug: road-to-gates-that-check-what-they-claim
    relation: extends
    note: "Its 2.3 reports a red kernel merge without a bypass record and backfills the old ones; #3037 arrives there. This roadmap does not duplicate the detection."
---
# Road to owner overrides that do not block releases

> **Source:** the release dispatch of 2026-11-25 (run `45649636234`). Facts
> verified in the tree and on the forge the same day.

## Goal

An owner override of a refused or non-convergent ratification is recorded when
the merge happens. It then never blocks a later release. A release that skips
over the override's red check names the record that covers it.

## Context

- **What happened.** PR #3037 (`arena-route`) changed four gated hook files.
  Its modification review split, and the record
  `agents/evidence/ratifications/arena-route-20261125.md` carries
  `verdict: refused`. The owner overrode the split under ADR-282, wrote the
  decision into the record, and merged over the red required check
  "Sync + Generate Tools Consistency".
- **Why the release stopped.** The source-check job of
  `.github/workflows/release.yml` reads the required checks of the PR whose
  merge commit is `main`'s tip. Any red check there refuses the release with
  "Nothing was released." So an override that is correct by contract
  (`docs/contracts/ratification-artifact.md` § The owner-permission-route)
  blocks every release until some other green PR lands on top. The release
  becomes hostage to merge order. This time the unblock was
  `2026-11-25-standing-bypass-3037.md`, written after the fact.
- **What the neighbours own.**
  - Whether an owner record turns the ratification gate itself green is the
    open owner blocker `owner-override-satisfies-ratification-ci` in
    `road-to-review-loops-that-converge` (options a/b/c, recommendation b).
    Under (a) or (b), a future override of this kind would leave no red check.
    Under (c), the forge bypass stays and so does this defect.
  - Reporting a merge over a red kernel check that has no bypass record is
    `road-to-gates-that-check-what-they-claim` 2.3.
  - This roadmap owns what neither covers: the record is written at merge
    time, and the release gate's reading of a covered override.
- **Separate, smaller.** The `workflow_dispatch` endpoint for `release.yml`
  returned HTTP 500 five times over about three minutes, while GitHub status
  reported all systems operational. The sixth try went through.

## Phase 1 — close the #3037 case

- [ ] **1.1** Run the after-the-fact council review of the #3037 bypass. Commit
  it under `agents/evidence/council/` citing subject `b961654c…4477`, and set
  `council_review` in `2026-11-25-standing-bypass-3037.md`.
  verify: `check_platform_anchor` reports no finding for that record. Due by
  2026-12-09.

## Phase 2 — the record is written with the merge, not after a failed release

- [ ] **2.1** When `/pr:merge` routes a ratification path `needs-owner` and the
  owner chooses to merge over a red ratification step, the bypass record goes
  into the PR first, in the same turn, before the owner's merge.
  verify: a test on `classify_merge_risk`'s `needs-owner` route: a red
  ratification step with no record in the PR asks for the record before the
  merge; with the record present it hands the merge to the owner.

## Phase 3 — a covered override does not stop a release

- [ ] **3.1** Decide the rule (council question, owner-reserved if it touches
  the release gate's authority). Re-check it once
  `owner-override-satisfies-ratification-ci` is answered: under (a) or (b) only
  overrides from before that answer need this rule. The candidate: the
  source-check job accepts a red required check on the tip **only** when all
  of these hold:
  - the only failing step is the ratification step;
  - a bypass record committed at the tip names that merge commit and the
    record's `subject`;
  - the forge reports the PR's merger as a holder of the standing bypass role.

  The alternative is to release the newest commit on `main` whose source
  checks are all green or covered. That ships less, but never relaxes a check.
- [ ] **3.2** Implement the chosen rule in `release.yml`, and in `release.ts`
  for the local path, so both read the same rule. The job prints the covering
  record's path for every check it accepts.
  verify: a release preview against a tip with a covered override names the
  record and continues.
- [ ] **3.3** Tests:
  - a red ratification step plus a matching record → released, with the
    record named;
  - the same without a record → refused;
  - a second red step beside the ratification step → refused;
  - a record naming another commit → refused.

## Phase 4 — a dispatch error is not a stop

- [ ] **4.1** Where this suite dispatches `release.yml` (release docs, the
  release command), retry an HTTP 5xx from the dispatch endpoint with bounded
  backoff, and say so in the log. Check afterwards that a run was created, so
  a retry never starts two releases: `concurrency: release` queues a second
  run, it does not cancel it.
  verify: a test with a stubbed dispatch that fails twice with 500, then
  succeeds, finishes with exactly one dispatch and logs the retries.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The release gate learns to wave red through | product | A rule that accepts a red required check could accept more than the ratification step, or accept a record an agent wrote for itself. | 3.1 accepts only the ratification step, only with a record naming the merge commit and subject, and only for a forge-verified merger; 3.3 tests each refusal. | Phase 3 — a covered override does not stop a release |
| 2 | Two rules for one question | implementation | If the owner answers `owner-override-satisfies-ratification-ci` with (a) or (b), the release rule and the ratification gate could disagree about the same override. | 3.1 is re-checked against that answer before it is built, and is narrowed to pre-answer overrides if the gate goes green on its own. | Phase 3 — a covered override does not stop a release |
| 3 | A retry starts two releases | implementation | A dispatch that succeeded but answered 5xx, retried, queues a second release run. | 4.1 checks for a created run before each retry. | Phase 4 — a dispatch error is not a stop |

## Done when

- The #3037 bypass record carries a committed council review.
- A merge over a red ratification step through `/pr:merge` carries its bypass
  record before the merge.
- A release dispatched right after a recorded owner override succeeds and names
  the record. Without the record it is refused.
