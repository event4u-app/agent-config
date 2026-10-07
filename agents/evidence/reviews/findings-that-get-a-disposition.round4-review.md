# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: dd03353e07c985615e40207f061d6951be7af9512bfe07f002f95202f7eeadf7 | diff: d68f55c4d0724d5927e2320d8d945db025fb8ebd | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: 5b6f00cabc8deb90bcc5655d3faf2913ade3ac1e0f0ccff31f1c9d9163f5d852 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d68f55c4d0724d5927e2320d8d945db025fb8ebd
  scope_hash: dd03353e07c985615e40207f061d6951be7af9512bfe07f002f95202f7eeadf7
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: cea8f233d3dfde0a8a915db888d75565a49d0205e6b32f831b8b78e0097f436e
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T19:58:26Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | agents/evidence/release-findings/16.3.0.json (row 1b661735687e, verified_by) | The rationale claims rounds 10 to 21 record `roadmap: none`, but the verification command globs `behavior-vocabulary-close-round1*.findings.md`, which matches round 1 and rounds 10-19 only. Rounds 20 and 21 are never checked and round 1 (outside the claim) is counted, so the recorded verifier does not reproduce the stated premise. | fixed | verified_by now globs rounds 10-19 and 20-21 explicitly (12 files) |
| 2 | low | agents/evidence/release-findings/16.3.0.json (row a2f0c4b87ade, verified_by) | The `fixed` disposition rests on a banner in delivery-set-result-2026-08-31.md, but `verified_by` greps that file for another finding's id (`237f203916c5`). Row 237f203916c5's own rationale places the note carrying that id on the holdout page, so the command neither checks for the banner text nor is guaranteed to hit; it does not evidence the claimed state. | fixed | verified_by now greps the banner text ('not the current one'); the banner does carry 237f203916c5, so the old command hit, but it checked the id rather than the claim |
| 3 | low | tests/scripts/check_finding_dispositions.test.ts:1103 | The cutoff-relative fixtures derive `earlier` as `${maj}.${Math.max(0, min - 1)}.0` and the older-line patch as `${maj}.${Math.max(0, min - 1)}.99`. If `MEDIUM_SECURITY_BLOCKS_AFTER` is ever moved to an `X.0.0` cutoff, `earlier` collapses onto the cutoff itself (the "earlier release" assertion silently stops testing an earlier release) and the "older line" case becomes `X.0.99`, which is after the cutoff and fails. The tests are written as cutoff-agnostic but only hold for a non-zero minor. | fixed | older-line fixtures derive from the major when the cutoff minor is zero |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
