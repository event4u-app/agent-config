# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 4b900614a56622271b2e134cf29d5dd0fa46de8c0a2f51b22ad955bcf835d04f | diff: 6271c97bc096af30609423d1d6a93b57e37ec396 | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: 3d2948103c498a15b159ddf1c39094a1184b57af5ee3c86d30073e4edb50c5ff -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 6271c97bc096af30609423d1d6a93b57e37ec396
  scope_hash: 4b900614a56622271b2e134cf29d5dd0fa46de8c0a2f51b22ad955bcf835d04f
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: d69e16da6a2becf9cb51b36e1eeb4e0e9cd5018bca96030adf42f9ad20a0bc3f
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T19:54:21Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/check_finding_dispositions.ts:97-101 | The `TERMINAL_STATUSES` docstring still says a blocking row marked `still_open` "reports as an unknown status". The new branch in `missing_dispositions` (`:364-367`) now reports it with its own message, and the new test asserts `not.toContain('unknown status')`. The comment contradicts both the code and the test in the same file, so a reader is told the opposite of what the gate prints. | fixed | TERMINAL_STATUSES docstring now says a blocking still_open row is reported with its own message |
| 2 | low | src/scripts/check_finding_dispositions.ts:283 | `mediumSecurityBinds` compares the release by semver order, but the docstring states the intent as binding releases published after the decision ("the last one published before the decision"). A maintenance release on an older line that is published after 2026-10-07, such as 16.2.x, is ordered at or before 16.3.0 and is exempt. It could ship an undispositioned medium security finding even though the decision already existed. No test covers this case, and neither the comment nor the CHANGELOG names it. | fixed | the version-order limit is stated in the isBlocking docblock and pinned by a test (a later patch on an older line stays exempt); no such release line exists |
| 3 | low | agents/evidence/release-findings/16.3.0.json:348 | Row `1b661735687e` is `accepted_risk`. Its own rationale says the systemic gap remains: a dispatch can run without the roadmap when the roadmap is in the changed set, and the row does not claim that gap is closed. No roadmap carries the gap. D1 prefers `still_open` with a named carrier for unfinished work, and the residue stub collected comparable "historical artefact plus missing mechanism" rows (item 5). This row accepts the artefact half and leaves the mechanism half with no carrier. | fixed | 1b661735687e is still_open, carried by road-to-the-16-3-0-findings-residue item 6 (dispatch without the roadmap in the changed set) |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
