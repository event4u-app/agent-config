# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 14acaff482ccaf728d7079e6be4f62e90c123e9c137d9897e76df6fefbb48864 | diff: 13e9c80f4a34da8f29dad029a7d5f0dd7a6ae60e | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: c18ea29629b9a957ca46fb566eaafd9fb93b45af3a462d95e2ba732747482ea6 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 13e9c80f4a34da8f29dad029a7d5f0dd7a6ae60e
  scope_hash: 14acaff482ccaf728d7079e6be4f62e90c123e9c137d9897e76df6fefbb48864
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:42:46Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:193 | `RESOLVED_AFTER_RE`'s optional tail `(?:\s+(?:on\|in)\s+[\w-]+)?` accepts any one-word qualifier, so a partial or scoped resolution releases a live past-tense hold: "It was blocked by the fix, which has since been fixed in part." screens `runnable` (probe), as do "…which has since merged in staging." and "…fixed in theory.". The comment at :192 states "fixed in part" does NOT resolve; that is false. This is the release-a-real-hold failure the roadmap's Risk Register rank 2 names. | fixed | the only tail a resolution may carry is "on <ISO date>" — fixtures "fixed in part.", "merged in staging.", "fixed in theory." (red before, green after); "shipped on 2026-10-30." stays released |
| 2 | high | tests/scripts/roadmap_drain_queue.test.ts:242 | The "a partial resolution" fixture is insensitive to the behaviour it names. It stays `held` only because the `;` ends the sentence before `RESOLVED_AFTER_RE`'s `[.!?]?$` anchor; with a period ("…fixed in part.") the same step screens `runnable`. The guard that AC-4 / step 2.1 cite for this case passes without protecting it, which is why finding 1 survived review round 2. | fixed | the partial-resolution fixture now ends in "." and fails without the fix |
| 3 | low | src/scripts/roadmap_drain_queue.ts:207 | `citationRe` releases the whole dependency hold when a resolved blocker is cited anywhere in the hold's span, even when the same hold also names another dependency: "Blocked by blocker `settled` and the host binary." and "Blocked by the host binary, see blocker `settled`." both screen `runnable`. Not a regression (on `main` any resolved named blocker suppressed prose detection entirely), and the citation forms are inherently ambiguous; noted because the hold names a second, unresolved object that the release ignores. | accepted-risk | not a regression from main; "see blocker `x`" is the citation form R2 round 2 asked to release. A hold naming a resolved and an unresolved object in one citation stays a known limit, named in the PR body |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
