# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 26e6e408ead31074a7df385c5e7ebcb5bd80831534032905914ba7970c1fd450 | diff: e69d14bf7bcf1118e5e0a06f7f81ebe7104e00a9 | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: acdca566063de034dc9e19e7b9d3a7d746576ce501e48e2f65198c56571dfe3a -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e69d14bf7bcf1118e5e0a06f7f81ebe7104e00a9
  scope_hash: 26e6e408ead31074a7df385c5e7ebcb5bd80831534032905914ba7970c1fd450
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: c653ff6bcf563337d8b24fff9290df8dc386584feb9cedeb8c4a130b38ab01df
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:24:13Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | agents/evidence/ratifications/drain-four-drifted-vendor-pages.md:28 | The "What was proposed" row for `host_lowering.yaml` says "Three comment sentences re-tensed or extended", but the final gated diff changes four comment passages: the header "all nine carry" → "carried", the claude "repeated 2026-10-14", the augment "repeated 2026-10-14", and the codex "installed build was 0.148.0 against a then-current 0.159.3" (added later in `64a8c74cc`). The ratification record understates the gated bytes that `subject` pins. | fixed | a853e235e |
| 2 | low | agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md:109 | The "two-week silence" section says the change grants "`issues: write` granted to that job only" in `host-docs-digest.yml`. That describes the round-5 shape, where the grant sat on the single watch job. After `fb179dbe1`, the grant sits on a separate `route-drift` job and the watch job holds only `contents: read`. As written, "that job" reads as the job that runs the check, which is the design round 5 refused. | fixed | a853e235e |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
