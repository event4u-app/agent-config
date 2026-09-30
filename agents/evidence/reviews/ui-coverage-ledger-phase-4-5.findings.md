# Findings: ui-coverage-ledger-phase-4-5
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 76ce7e3f1fbed98ffc6f58dac2544e56d78813ea1dcfd00bb8f844be2c0a80a7 | diff: 72470f7bd351c6dfafcd2456825ecf8cc0ba8eb3 | reviewer: r2-fresh-subagent-ui-coverage-ledger-phase-4-5 | prompt_hash: e7e386758f76fbcae5b1da14f9ce1ecee604cf66598714cdb993330427390b4f -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-ui-coverage-ledger-phase-4-5"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 72470f7bd351c6dfafcd2456825ecf8cc0ba8eb3
  scope_hash: 76ce7e3f1fbed98ffc6f58dac2544e56d78813ea1dcfd00bb8f844be2c0a80a7
  roadmap: agents/roadmaps/road-to-a-ui-coverage-ledger-that-can-fail.md
  roadmap_hash: 363877aaa67e92935e4c6cc89ba51d998693bdad32660d2fa79f86f00fc27e9c
  ac_hash: 2b9a5747d5ce8bf179ba351b980d8e46e488266103280a8194853fbe5eb3f411
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T18:18:24Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-a-ui-coverage-ledger-that-can-fail.md:6-14 | `estate_growth_exempt` (line 6) was repointed this diff from the `active_roadmaps` counter to the `open_blockers` counter (+1, the new `shadow-release-window` blocker) — the field itself says so ("superseding this roadmap's earlier active_roadmaps claim"). The sibling `estate_offset_exempt` field (lines 7-14) was left unchanged: it argues only that no *roadmap* is available to archive or merge into, which is the offset story for the `active_roadmaps` dimension. It says nothing about whether an existing open blocker elsewhere could have been resolved/closed to net the new `shadow-release-window` blocker to zero — the offset question the new growth claim actually raises. The two fields no longer pair against the same estate dimension. | fixed | 101a1cf50 — `estate_offset_exempt` repointed to the `open_blockers` dimension its sibling now claims, and the offset question is answered rather than sidestepped: this roadmap held 0 open blockers before the diff (`grep -c blocked-by` on the base file reads 0, and it had no `## Blockers` section), so there is nothing of its own to net against, and the other 40 sit on other roadmaps where a blocker is cleared by its own `Resolved when` and never by a neighbour needing headroom — closing one for room is declined as the exact counter-walking the ratchet exists to catch, not reported as unavailable. The previous `active_roadmaps` prose is kept, now labelled as the reason no roadmap was retired, since that dimension is +0 here. `check_estate_count` re-run after the edit: estate within its ratchet. |
