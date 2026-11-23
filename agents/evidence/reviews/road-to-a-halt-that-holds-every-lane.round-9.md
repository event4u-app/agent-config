# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 001a1e4bfed514e9441e4eaf5a54442df902b648e3b15db4f59b261297c8a94b | diff: 276176770b8c7c648b9bd3b8995df439d561a1c4 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: 84d2daf8d6aa71457184cf9c90f3ad7b1e54b8af4846896662e9088ddad9efb5 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 276176770b8c7c648b9bd3b8995df439d561a1c4
  scope_hash: 001a1e4bfed514e9441e4eaf5a54442df902b648e3b15db4f59b261297c8a94b
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: af8175100d6e8f597c8ad6f2fb77dea751730b5cf64327530e87f8d1773466bc
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T20:05:11Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:180 | Regression that releases a live hold: `PROSE_HOLD_RE` folds `only` into the phrase (`(?:still \|only )?waits on`), so for "Not only waits on the probe." the clause prefix handed to `NEGATED_BEFORE_RE` (line 187) is just "Not ", which counts as a negation, and the step becomes `runnable`. `main` holds it. Reproduced with `screenRoadmap` on the branch head (runnable) and on `main` (held), with and without a resolved blocker. The comment at lines 185-186 says "not only … still hold", and the test covers only the `blocked by` / `waiting on` forms. This is risk-register item 2. | fixed | a negation never releases a phrase that carries its own "only"/"still" — fixture "Not only waits on the probe.", red before (main held it) |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:187 | `NEGATED_BEFORE_RE` reads a restrictive negation as a release. "Not blocked by the probe alone, but also by the host." and "Not blocked by the probe alone." both come out `runnable`, but the step is still held. This was already the behaviour on `main`. It is the same "not only" class that the change itself names and guards against in lines 185-186 and in the tests, and the clause-scoped negation of step 2.2 leaves it open. | deferred | pre-existing on main, release direction; carried as finding 3 of agents/roadmaps/road-to-prose-holds-that-read-their-object.md (in this change) |
| 3 | medium | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:89 | The AC-6 evidence line says the diff was "re-run on the final parser after R2 round 7". The final parser is the R2 round 8 commit 276176770b (the tests cite "R2 round 8 finding 1/2"), so the line names the wrong round. The zero-diff result itself still holds: the reviewer re-ran `roadmap_drain_queue --json --today 2026-11-23` from `main` (aac7b506fd) and from the branch over this worktree's estate, and the two outputs were byte-identical. | fixed | the 2.5 record names no round; it states the diff was re-run on the final parser after every parser change (re-run again after this fix: zero differences) |
| 4 | low | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:11 | The provenance is stale. The `relates` note says "after six review rounds" and the Source line (16) cites only round 6, but finding 2 of the body describes forms the parent dropped "after R2 round 8". Eight rounds ran. | fixed | follow-up provenance now cites rounds 6–9 and states what it carries |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
