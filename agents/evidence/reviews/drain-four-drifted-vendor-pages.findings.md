# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 0ff81ac12ff76aace1aa02e04451b22e3087ccb408babf46280cef4b18be77b0 | diff: 25aee2a3c1764e03984243b74fd5c4762abc4608 | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: 97ae7dd9eaa9d7353bc3b9607e95e2c478cea1eee36898124d9c9a8991824d7b -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 25aee2a3c1764e03984243b74fd5c4762abc4608
  scope_hash: 0ff81ac12ff76aace1aa02e04451b22e3087ccb408babf46280cef4b18be77b0
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: dacc3667c999420e894f063fab11896f537c391828a9f9918a932c6da56696a1
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:12:29Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/host_docs_digest_workflow.test.ts:48 | The route-drift job only runs when digest-watch has FAILED (a drift exits non-zero), so its `if:` depends on the `always()` prefix: without it GitHub adds an implicit `success()` and the route never fires. No test pins `always()`. The test checks the `drifted` output and the `schedule` condition but would stay green if `always() &&` were dropped, which turns the route back into silence. | open | |
| 2 | medium | .github/workflows/host-docs-digest.yml:121 | `drifted=true` comes from grepping two literal message fragments that `check_host_docs_digest.ts:864/872` prints. Nothing ties the two together. The test only checks that the workflow contains `changed since the row was established`; it never checks the checker's real output or the `GONE (404/410)` branch. If either message is reworded, a real drift exits red but is no longer routed, and no test turns red: the same silent failure this change exists to remove. | open | |
| 3 | low | .github/workflows/host-docs-digest.yml:68 | `concurrency: cancel-in-progress: true` is shared by the schedule and `workflow_dispatch` triggers. A manual dispatch, for example from a branch, that starts while the Monday scheduled run is still going cancels it before `route-drift` can file, and the dispatched run never routes because it is not a schedule. That week's drift is then not routed. | open | |
| 4 | low | agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md:6 | `estate_offset_exempt` still says "It ships `status: draft`, so it is excluded from the gated active_roadmaps count", but the archived roadmap's frontmatter (line 3) is `status: ready`. The exemption text now contradicts the file it describes. | open | |
| 5 | low | agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md:43 | The windsurf `now` digest is abbreviated `b9e0cd47…1170`, but the committed digest ends in `…5c1170d` (host_lowering.yaml). Every other row abbreviates as first 8 + last 4 characters (`…5378`, `…37c2`, `…5f92`, `…4764`). Here the suffix is off by one character, so it does not match the hash a reader would compare it against. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
