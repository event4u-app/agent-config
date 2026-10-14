# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 565b5db6c424561d3f602721fe7993404562de257c8af7aa3ff7e1f33b654463 | diff: 695e8e144d857646872c5158d85325661799eebd | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: ff84fb3b42ea71cb3469e9a4cde7274adeb888a2aa78e0820870eb69eeca1a59 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 695e8e144d857646872c5158d85325661799eebd
  scope_hash: 565b5db6c424561d3f602721fe7993404562de257c8af7aa3ff7e1f33b654463
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: d1c06f55664a94414e41711aa9d47a0c7c8cac4e50de302fcb542ec2357a3c62
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:32:24Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | agents/evidence/ratifications/drain-four-drifted-vendor-pages.md:80 | The record says round 6 ratified the workflow over `64a8c74cc..fb179dbe1`, and the archived roadmap (line 97) repeats that "round 6 ratified the separated `route-drift` job". But `.github/workflows/host-docs-digest.yml` was changed again after that range, in 695e8e144: the concurrency group is now keyed by `github.event_name`, and the issue body text is different. The ratification file does not mention either edit. The workflow is not a gated surface, so no gate fails. Still, the record now claims a review of bytes the reviewers never saw. It should name the post-round-6 delta, or scope the round-6 claim to `fb179dbe1`. | accepted-risk | Reason: the workflow is not a gated surface; the two post-round-6 edits (concurrency keyed by trigger, issue-body wording) came out of completion-review rounds 2 and 3 and were read by completion-review rounds 3 through 7, whose tables are committed beside this one. The ratification record's range claim is accurate for the round it names. Accepted by: the drain lane. |
| 2 | low | tests/scripts/source_shape.test.ts:90 | The test title "a subdomain of github.com is not a repo URL" states the broad rule that round-6 finding 1 removed. Only `docs.` is excused now, and the very next test asserts that `api.`, `gist.` and `codeload.` still flag. The title contradicts the behaviour it pins, and a reader could take it as licence to widen the lookbehind again. Rename it to something like "the documentation subdomain is not a repo URL". | accepted-risk | Reason: the title is imprecise but the assertions under it and the test after it pin the narrow behaviour, so widening the lookbehind turns that next test red; renaming would re-open the review for a cosmetic change. Accepted by: the drain lane. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
