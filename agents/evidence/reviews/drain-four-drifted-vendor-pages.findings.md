# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 233bf91a0ad5934aa12ba79aeb0f0dd7ecdac4c040741548b3d2a6bc1cc12c3f | diff: d515b59bb3567339028f2ae71f10602b4b4906a5 | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: 72943a0c117781f3e31f026432516722b37f8756454e2c03373f23cd698aed6d -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d515b59bb3567339028f2ae71f10602b4b4906a5
  scope_hash: 233bf91a0ad5934aa12ba79aeb0f0dd7ecdac4c040741548b3d2a6bc1cc12c3f
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: dacc3667c999420e894f063fab11896f537c391828a9f9918a932c6da56696a1
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T14:59:32Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | .github/workflows/host-docs-digest.yml:117 | The route step is gated on `failure()`, which is true when ANY earlier step fails (checkout, setup-node, `npm ci` after its retry, or the offline scope report), not only the `--fetch` comparison. A broken runner therefore files or comments on the issue with a body that says "A changed digest means a cited page moved. Read each page the log lists as changed" -- the exact drift-vs-broken-runner confusion the `Install Node deps` comment in the same file says it exists to prevent. A 404/410 red (dead citation, per the header) also gets the "page moved" wording. Gate on the fetch step's outcome (`id:` + `steps.<id>.outcome == 'failure'`) or make the body not assert the cause. | open | |
| 2 | low | tests/scripts/host_docs_digest_workflow.test.ts:26 | The test pins that a `gh issue` step exists with `failure()` and the schedule guard, but not that it runs AFTER the `--fetch` step nor what it is conditioned on beyond the substring `failure()`; moving the step above the fetch, or the condition widening as in finding 1, keeps every case green. | open | |
| 3 | low | agents/evidence/ratifications/drain-four-drifted-vendor-pages.md:24 | The ratification artifact's gated-surface table and reviewed range (`55782c253..74942ec4f`) cover the lowering rows, the sibling page list, the comment string and the bundle, but not the later workflow change that adds `issues: write` and a token-using `gh` step; the roadmap states the council agreed on it in two rounds, but no artifact in the diff records that review, so the one write-grant change in the branch carries no recorded second pair of eyes alongside the others. | open | |
| 4 | low | src/scripts/hooks/host_lowering.yaml:384 | The codex row was re-dated to a 2026-10-14 read, but its comment still says "The installed build is 0.148.0 against a current 0.159.3, and the page that was read describes the current one" -- a present-tense claim about the current version taken from the 2026-09-29/10-01 reading that the re-read neither confirmed nor re-dated, unlike the three comments the change did re-tense. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
