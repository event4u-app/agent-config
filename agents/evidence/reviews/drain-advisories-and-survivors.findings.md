# Completion review — drain-advisories-and-survivors

**Skipped:** no code surface for this completion — the branch changes 5 files and 0 of them is a code path: one evidence record amended with a withdrawn claim and an independent verification, two roadmaps amended with the review findings that landed on them, one new roadmap, and one new stub, scope 0f518c3a280678847b6f068ab8ef2249dab960e2eaf21dd54aeb5b5d1bc0f583, declared 2026-08-27

## Why there is no code to review

The change answers the adversarial-review findings on PR #1681 and the
reconciliation that followed the merge. Every answer is prose: a withdrawn
claim, a verification recorded against instruments that already exist, a
roadmap that plans work, and a stub that names a defect rather than fixing it.
No script, schema, hook, template or projection is touched, and the gate itself
measures zero code paths of five changed files.

The two blocker-heading repairs are the closest thing to code here and are not:
each is one word added to a markdown heading so an existing parser can see a
section that was already written.

## What was verified instead, and how

The two blocking-advisory findings were answered against the tree, not argued.

**`74007388aa70` (high) — the 70% ownership claim.** Withdrawn rather than
recomputed. The denominator is now stated: 47 numbered sub-items in the source
program, 16 claims checked, 4 owned outright, 31 sub-items never checked. The
ownership count fell from 5 to 4 during the same pass, when one row's
`already-fixed` verdict was re-examined and did not hold — which is itself the
argument for withdrawing a percentage rather than restating it.

**`45e24dabfed9` (critical) — the authorization defect on one evidence file.**
Two independent legs added. A `<task-notification>` is stored as a user-role
turn **561 times across 92 of 167** session transcripts
(`grep -l`/`grep -ho` over the transcript store, both counts reported). The
writer rebuilds the ledger on every non-empty prompt and reads nothing about
origin (`git_authorization_hook.ts:468-513`). Verifying it surfaced a second
instance in the same function: `takePending` (`:427`, called `:499`) removes the
pending-refusal file at `:440` before any affirmative or origin check.

Four advisory findings were also answered: the step-3 classification, the
tmp.old sanitization premise, the composition roadmap's kill-criterion detector,
and its context-fingerprint and authority-citation gaps.

**One finding was made by this change rather than answered by it.** The
dashboard reported the new roadmap's blocker count as zero. `BLOCKER_HEADING_RE`
(`update_roadmap_progress.ts:439`) requires a literal `blocker:` prefix; six
headings across five roadmaps lack it, `open_blockers` is a ratcheted metric
running on the resulting undercount, and `lint_roadmap_blockers` reported the
affected file clean because a file with zero parsed blockers passes vacuously.
Two instances repaired, four recorded in
`stubs/road-to-blocker-parse-visibility.md`.

## Gates run

`check_estate_count` (active 10 → 11 on an offset exemption; `open_blockers`
42 → 44 on a growth claim stating the rise is a correction),
`check_roadmap_trackable` (7 violations against a baseline of 9),
`lint_roadmap_blockers`, `lint_plan_risk_register`, `check_references`,
`check_no_external_sources`, `lint_evidence_artifacts`, and the dashboard
regenerated. All green.
