# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: bda4e100c19500d6eb66b60d8c1f943c166525789a4d9826bae316a45c6d3480 | diff: 117c122adaf5b11db07f7eafb69d054bf4104fed | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 8fd0f2a997a652487a8e6266666069c93b911ffea388babd60297b7ccacb8848 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 117c122adaf5b11db07f7eafb69d054bf4104fed
  scope_hash: bda4e100c19500d6eb66b60d8c1f943c166525789a4d9826bae316a45c6d3480
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T08:14:00Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/check_release_pr_shape.test.ts:165 | The comment above this assertion claims a local-time stamping regression "reds here", but `censusDateStamp(new Date(Date.UTC(2026, 9, 5, 23, 30)))` separates UTC from local time only when the runner's local offset at that instant is at least +00:30. Under `TZ=UTC` and under every Americas offset a local-time implementation also returns `2026-10-05`, so the assertion stays green and the regression class it was added for is unmeasured in the likeliest CI environment. Line 166 is insensitive to the same class for the opposite reason: `Date.UTC(2026, 9, 5)` is midnight UTC, so a negative-offset local implementation yields `2026-10-04`, which still matches the glob. The sensitivity of the guard is therefore environment-dependent, which is the "never seen red" condition the branch is otherwise careful about. A TZ-independent pair exists and would close it: `2026-10-05T23:30Z` must stamp `2026-10-05` AND `2026-10-06T00:30Z` must stamp `2026-10-06` reds under any non-zero offset, and is observationally identical to the correct implementation only at offset 0, where there is nothing to detect. | fixed | 8cf6e9eed |
| 2 | low | src/scripts/check_release_pr_shape.ts:50 | The `????-??-??` justification is now carried near-verbatim in two places: this comment and the contract bullet at `docs/contracts/release-pr-gating.md:82`. The same diff deletes the blockquote's path-list copy on the stated ground that "a second prose copy went stale for months and named paths the code had already renamed", and then creates a second prose copy of the rationale. Nothing binds the two, so this is a new drift surface of exactly the class the diff names one hunk earlier. | fixed | 8cf6e9eed |
| 3 | low | docs/contracts/release-pr-gating.md:41 | Self-contradicting sentence. "That set is a summary and the enumeration below is the list; it is NOT restated here" follows immediately after a prose restatement of the set in the same sentence ("version manifests, the changelog and its era archive, pack metadata, ..."). The intended claim is narrower, that the path list is not restated; as written the clause denies what the preceding clause just did, and a reader checking the blockquote against itself finds the restatement the text says is absent. | fixed | 8cf6e9eed |
| 4 | low | docs/contracts/release-pr-gating.md:90 | The retained doc-to-`ALLOWLIST_GLOBS` duplicate is held only by the prose instruction "A change to either edits both" — the same class of mechanism the blockquote rewrite three hunks earlier declares insufficient on measured evidence. No parity check binds the doc list to the code constant, so the drift the paragraph correctly diagnoses stays unenforced, and one diff applies two different remedies to one defect (delete the copy, versus keep it and ask) without stating why the second site earns the weaker one. | fixed | 8cf6e9eed |
