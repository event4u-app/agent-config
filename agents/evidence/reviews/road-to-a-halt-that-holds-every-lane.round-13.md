# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-24 | scope: a29c0f133e8de5da523d44c2006ffd45b0aa3bbfeb06b3ca4b52299fdef5029e | diff: 8712556d5c264af4ca59805c3e560a7cd8a19a93 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: c0412689d4c0352bff03473b9c6248c7ec4d6cc9b54b5a943d73dc122599d63a | round: 2 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 8712556d5c264af4ca59805c3e560a7cd8a19a93
  scope_hash: a29c0f133e8de5da523d44c2006ffd45b0aa3bbfeb06b3ca4b52299fdef5029e
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: 43c173dfc27b822ad1223b10a5a521acf7e033e8904eecacf288181e7c5413ab
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-24T10:31:34Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/agent-src/contexts/execution/process-full-all.md:84 | Step 1.3 (marked done) requires the dead-lane re-dispatch to read the entry's `dispatchable` AND `dispatch_hold` and stop on a halt; the prose reads only `dispatchable` and labels every `false` as "(halt)". A dead lane's roadmap with no runnable step lands in bucket `decide` (`dispatchable: false`, `dispatch_hold` null), so the reader is told the halt is armed when it is not; the hold reason that distinguishes the two is never consulted. Same text in dist/agent-src/contexts/execution/process-full-all.md:84. | fixed | the halt rule now lives in one sentence where the doc explains `dispatch_hold`: naming the emergency halt, it stops every dispatch, re-dispatch and verdict resume — no inference from `dispatchable` alone |
| 2 | medium | src/agent-src/contexts/execution/process-full-all.md:139 | New clause "the verdict goes back to the SAME lane via its message channel, unless halted" is in no roadmap step and is undefined: this file also uses "halt" for the five run-halt conditions (§ Full is Full — halt detail), and it does not say which halt is meant nor what happens to the council verdict instead (dropped, held, delivered after disarm). A reader under either halt gets no instruction. Mirrored at dist/.../process-full-all.md:139. | fixed | the vague "unless halted" clause is gone; the same sentence names the emergency halt and covers the verdict resume |
| 3 | low | src/agent-src/contexts/execution/process-full-all.md:84-86 | The rewrite dropped "read its queue entry —", leaving "else `salvage: N commit(s) ahead, M uncommitted file(s)` — run …": the salvage readout now dangles with no verb, so the instruction to read the salvage line before re-dispatch is only implied. | fixed | the dead-lane sentence keeps main's "read its queue entry —" verb |
| 4 | low | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:17 | Source line says "after ten R2 completion-review rounds" and points to `road-to-a-halt-that-holds-every-lane.round-*.md`; that glob matches twelve round files (round-1..round-12). The figure was true at the council's decision time but the cited glob now contradicts it; heading at :42 repeats "ten". | fixed | the follow-up names rounds 1–10 as the parser rounds and says later rounds reviewed the halt-only diff |
| 5 | low | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:74 | Step 1.3's receipt reads `bound=production code touched: src/scripts/roadmap_drain_queue.ts`, but 1.3 changed only process-full-all.md (src + dist projection); the receipt names a file the step did not touch (copied from 1.1/1.2). | accepted-risk | `step_receipt --range` prints one range-wide receipt; step 1.3 now says so in prose |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
