# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 70e4edb878e4e518f19f5bc6c191007a12c84ab7d29bff73fdf92a041889a118 | diff: 06961545555c5f8d131914774d0742b36bc4de1b | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: 2fd6212db4a48fba496d88c5baa9f4b0f36f7a7518b09207342ba041a872467a -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 06961545555c5f8d131914774d0742b36bc4de1b
  scope_hash: 70e4edb878e4e518f19f5bc6c191007a12c84ab7d29bff73fdf92a041889a118
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: 7aade69d32bf0308f0d4aa0c43ab5574c5bb79430e13d9a15248ac626e0641b8
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:15:40Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md:92 | The archived roadmap's Ratification paragraph says "four council rounds ... final `ratified` from both seats" and names only the round-1 and round-2 fixes, but the ratification artifact it points to records six rounds, including the round-5 `refused` on the workflow and the `route-drift` restructure that answered it. The closing record undercounts the review and leaves out the one refusal. | open | |
| 2 | low | agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md:138 | Step 1.3's `verify:` (`grep -c 'Host Docs Digest Watch' .github/workflows/host-docs-digest.yml` -> `/^[1-9]/`) is vacuous. It matches the pre-existing `name: Host Docs Digest Watch` on line 1, so it passed on the base before any routing change and proves nothing about the step it closes. The real evidence is `tests/scripts/host_docs_digest_workflow.test.ts`, which the verify does not run. | open | |
| 3 | low | src/scripts/_lib/host_listing_model.ts:18 | The header is still titled "THE MECHANISM, AS DOCUMENTED UPSTREAM" and still states "1% by default, ≈8,000 characters on a 200k window" in the present tense. Three lines above, the new parenthetical says the current page no longer prints the ≈8,000 illustration, so the paragraph contradicts itself. The `budget-unit-is-chars` `why` string was re-dated correctly; this sentence was not. | open | |
| 4 | low | .github/workflows/host-docs-digest.yml:147 | The routed issue body tells the reader to re-establish the row "with the ratification artifact host_lowering.yaml requires". The watch also covers `host_docs_pages.yaml` (this branch re-dated `claude-code-skills` there, and the ratification artifact lists it as not gated), so a drift only on a sibling page gets instructions that name the wrong table and an obligation that does not apply. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
