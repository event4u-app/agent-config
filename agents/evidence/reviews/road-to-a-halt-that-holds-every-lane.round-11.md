# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-24 | scope: d9ff75438090a1a6873a8ba1f1b804aa404b917fe7a72fa07890d4a15ed14be7 | diff: 9f57ccf65bbccd94f6e1a3272fb325681d2fae15 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: d960e015a1d60b1079b5863bb4d5ba25ada23e87f4ffe644183ebedebd41971b | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 9f57ccf65bbccd94f6e1a3272fb325681d2fae15
  scope_hash: d9ff75438090a1a6873a8ba1f1b804aa404b917fe7a72fa07890d4a15ed14be7
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: be33e39956268630d00a1433a551b35d76fa4043d558b1097b74102f502f753b
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-24T10:17:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:95 | The carried criterion is weaker than the one it replaces. Parent AC-6 says no correctly classified step may change class. Carried AC-4 adds "or every change is justified in the PR body", so a correct hold can be released as long as the PR justifies it. That is the rank-2 risk both roadmaps name. Under roadmap-progress-sync's preservation test, weakening a carried criterion is the owner's decision; the council verdict recorded at archive/road-to-a-halt-that-holds-every-lane.md:80-92 only chose option B. | fixed | AC-4 now carries the parent AC-6 unchanged, without the escape hatch; step 1.4 matches |
| 2 | low | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:76 | Fixture row uses blocker `t` ("both resolved"), but the corpus preamble at :44 defines only blocker `s` as a resolved local blocker. `t`'s status is asserted inline instead of defined, so the fixture setup is underspecified for step 1.1. | fixed | the corpus preamble defines blocker `t` as resolved too |
| 3 | low | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:83 | The carry record cites the council verdict only at a gitignored, auto-pruned path (`agents/runtime/council/responses/...`, marked "local"). Options, verdict and rationale are summarised inline, but the source will be gone after the retention window and cannot be checked from a clone. | fixed | the council record is promoted to agents/evidence/council/halt-phase2-disposition-20261124.md (tracked) and both roadmaps cite it |
| 4 | low | src/scripts/roadmap_drain_queue.ts:509 | While halted, each entry carries only `dispatchable: false` with no reason of its own. The halt is named only in the top-level `dispatch_hold`. process-full-all.md tells the operator to read both, so the behaviour is correct, but a consumer reading just the entry (the re-dispatch path) cannot tell a halt from a decide or WIP-cap refusal. | accepted-risk | `dispatch_hold` is the documented queue-level field and process-full-all names it; a per-entry reason would widen the --json shape for every consumer — not done in this change |
