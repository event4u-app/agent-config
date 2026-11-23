# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 7654007db9d998a331d51595805ad2ea7fb2d10d941fac600af4da38d182bdcf | diff: 316d3bd432e8a70a9ff2b2c28f73596596ce7a3e | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: 87010d9ac11179087d2470ad3bf19770c5d145698717d2f6b6569a624bfce2d4 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 316d3bd432e8a70a9ff2b2c28f73596596ce7a3e
  scope_hash: 7654007db9d998a331d51595805ad2ea7fb2d10d941fac600af4da38d182bdcf
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:56:14Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/roadmap_drain_queue.ts:193 | `RESOLVED_AFTER_RE` is tested against the whole rest of the sentence (`[^,.;:]*` spans `and …`), so a resolution clause attached to the LAST of several hold objects releases the whole hold: "It was blocked by the probe and the host, which has since shipped." and "Was blocked by both the probe and the host binary, which has since landed." both screen `runnable` (probe via `screenRoadmap`); `origin/main` kept them held. Release direction — the Goal's "held only when a hold is actually still in force" and Risk Register rank 2. Already carried as finding 1 of the follow-up `road-to-prose-holds-that-read-their-object`, so it ships known-open. | fixed | a regression from main in the release direction, so not deferred: RESOLVED_AFTER_RE now refuses an object list with and/or/both — two fixtures, red before; the follow-up roadmap now carries the fail-safe remainder (compound holds never release) |
| 2 | low | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:91 | Step 2.5 evidence says the estate-wide `--json` diff was taken "after the R2 round-1 parser fixes", but the parser kept changing through later rounds (the test file cites R2 round 2 and round 5 fixes), so the recorded AC-6 evidence does not describe the shipped parser. Re-run at the branch head reproduces the claim (per-step `screenEstate` classes and queue buckets/dispatchable/next/question counts identical between `origin/main` and HEAD, 383 open steps, 32 entries in the current estate), so nothing acts wrongly on it; the record's figures (384 / 31) and its round reference are stale. | fixed | the 2.5 record now states the diff was re-run on the final parser after round 7, without stale counts |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
