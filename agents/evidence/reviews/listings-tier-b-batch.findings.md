# Findings: listings-tier-b-batch
<!-- completion-review: v1 | reviewed: 2026-10-24 | scope: 15abccbbcc7d40298f65e30cb95d67e4f8449dee9b8ca5d5b0dd55fdb9517bee | diff: 70797c0f7833fed3397214589fd11483e60c3a3e | reviewer: r2-fresh-subagent-listings-tier-b-batch | prompt_hash: c212f1af0cb9b9c087164b9e5c06539d10503d2e31b7cc80bf0140dcb11d6b61 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-listings-tier-b-batch"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 70797c0f7833fed3397214589fd11483e60c3a3e
  scope_hash: 15abccbbcc7d40298f65e30cb95d67e4f8449dee9b8ca5d5b0dd55fdb9517bee
  roadmap: agents/roadmaps/later/road-to-listings-the-owner-submits.md
  roadmap_hash: 7a46e124f47bb5ac859619fb06d53cce8c85fa18ba4d5716b56808bd5037f1b5
  ac_hash: 6c2c44db4230ab0129bebde5691e26a90b2f30807a08e348951b7c1e6c7d9a82
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-24T05:00:33Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/later/road-to-listings-the-owner-submits.md:24 | The rewritten `estate_growth_exempt` string is a botched splice: it says "open blockers that already existed as owner-act queues" and then repeats "tier-b-go, topic-push-secret that already existed as owner-act queues", so it still lists `tier-b-go` as an open blocker in the same change that marks it resolved, and the net-zero swap claim is buried in contradictory prose. | fixed | 70797c0f78 — the claim names the two open blockers and the swap plainly |
| 2 | low | internal/docker/mcp-server/Dockerfile:6 | The header's "Ships:" list still names `dist/cli/` as the compiled output that is copied, while the runtime stage now copies the whole builder `dist/`; the header no longer describes the image contents. | fixed | 70797c0f78 — the header names the whole dist/ output |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
