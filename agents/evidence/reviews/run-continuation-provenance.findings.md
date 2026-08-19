# Findings: run-continuation-provenance
<!-- completion-review: v1 | reviewed: 2026-08-19 | scope: 8338cc3fb87412cc27b5ec3e65aee358029a72285675cfec739c168405d00154 | diff: 544f0fba55b3580a54234ccd0f8dd2592cdfead1 | reviewer: r2-fresh-subagent-run-continuation-provenance | prompt_hash: a88c00e330804f0e184ad7ae95cd2ac4ebc313d3bd9be7fb5db769459b0ffdac -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 544f0fba55b3580a54234ccd0f8dd2592cdfead1
  scope_hash: 8338cc3fb87412cc27b5ec3e65aee358029a72285675cfec739c168405d00154
  roadmap: agents/roadmaps/road-to-run-continuation-observation.md
  roadmap_hash: e88b1d528aa8d876fc4eaa2867448dd9f92a572eeaaa49d508fc434fb6bbefc2
  ac_hash: bb34537a4ce90a2ac144c0346d9d3817fc8ddd788722900f17cdb6b7ed59bea7
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-19T18:25:51Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/hooks/run_continuation_hook.ts:853 | The new `halt-roadmap-absent` rung deletes the state file unconditionally, including when `driven.halted` is set, so a single transient read failure of the roadmap (the agent's own tool rewriting it via unlink-then-write, a `git checkout`/`git stash`/`git mv` mid-run, an EACCES) erases the halt stamp and the budget — the next fire reads `prev === null`, builds `iterations: 0` with a fresh `started_at`, and re-engages with a full 25-iteration cap and a restarted 4 h clock, which is exactly the unbounded-loop failure the `RunState.halted` docblock says the R2 review found and the `halted` field exists to prevent. | fixed | 61e69100f |
| 2 | medium | src/scripts/hooks/run_continuation_hook.ts:782 | `stateRelPath(runId)` keys the run state on the session id alone with no roadmap component, while `resolve_claim` lets one session re-claim a different roadmap: after a session halts on roadmap A the stamp is never cleared (`ladder` returns `state.halted` before `complete`, and only `complete` unlinks), so a later legitimate claim of roadmap B in the same session emits a `halt-stall`/`halt-max-iterations` line naming B, never engages once, and — if B is unreadable — the absent rung reports A's `iterations` under B's slug. | fixed | 61e69100f |
| 3 | medium | src/scripts/session_register_hook.ts:358 | `claim_is_stale` still gates on the `!rel.includes('..')` substring test that round 5 finding 10 removed from `resolveRoadmap`, so for a legal slug such as `road-to-a..b` the register renders a live claim as `STALE — treat as no claim` and `foreign_sessions_block` drops it from the collision set (disabling the duplicate-work warning) while `run_continuation_hook` resolves the same string and engages on it — the two-functions-disagree-about-one-string defect finding 7 fixed for `.md`, reintroduced in the opposite direction by finding 10's one-sided fix, and pinned green by the new `accepts a legitimate slug containing a double dot` test which only exercises the hook side. | fixed | 61e69100f |
| 4 | medium | src/scripts/hooks/run_continuation_hook.ts:40 | The header block that declares itself the canonical ladder ("every rung a named event in `agents/runtime/state/run-continuation.jsonl`") lists eight rungs and omits the branch this diff adds: neither the unreadable-roadmap rung nor its `halt-roadmap-absent` event name appears, and the duplicate-fire rung's new roadmap-source condition is unstated — so a ledger consumer enumerating event names from the file's own contract statement will not know `halt-roadmap-absent` exists (`HALT_ACTIONS` deliberately excludes it too), which is the same enumeration drift rounds 2, 3 and 5 each caught on the field count. | fixed | 61e69100f |
| 5 | low | src/scripts/hooks/run_continuation_hook.ts:832 | The absent rung's discriminator is `readState(stateFile) === null`, and `readState` returns `null` for a state file that exists but is malformed (truncated by an interrupted `writeFileSync`, bad JSON, a missing required key), so in exactly the case where the state write was interrupted the branch stays silent, emits no line, and leaves the stale state file on disk — the leak the branch was added to close survives its own worst input. | fixed | 61e69100f |
| 6 | low | src/scripts/hooks/run_continuation_hook.ts:974 | Once `state.halted` is stamped the state file is immortal for the session, so every subsequent stop fire re-enters the non-engage branch and appends another `halt-max-iterations`/`halt-stall` line with the same `run_id` and `iterations`; a session that keeps ending turns after a halt writes an unbounded number of duplicate halt records into the ledger the acceptance criteria's `interruption_report` counts are derived from. | fixed | 61e69100f |
| 7 | low | agents/roadmaps/road-to-run-continuation-observation.md:26 | The `## Context` line and the step-0.0 bullet both state "22 cases" of integration testing "against the real dispatcher", but of the 22 `it(` cases in `tests/hooks/run_continuation_dispatch.test.ts` two (`is registered strictly after turn-end-gate…`, `is LAST on that chain…`) only parse the hook manifest and never call `dispatchStop` — a reader counting dispatcher-driven cases finds 20, so the number the bullet explicitly pins as falsifiable is wrong again in the revision that corrects the previous stale count. | fixed | 61e69100f |

## Where this stopped, and why the gate reports a stale review

Round 6 is the last round on this branch. Its seven findings are `fixed` on
`61e69100f`, and the fixes moved the reviewed content past the scope this artefact
is bound to — so `check_completion_review` reports `stale-review` rather than
green, and that is disclosed rather than worked around.

The alternative was a seventh round, and the reason for not running one is not a
convergence claim. Six rounds found **49** findings — 9, 7, 8, 7, 11, 7 — of which
five were `high`, and **every** high was in the newest code: round 3's in round 2's
fix, round 5's in round 4's, round 6's in round 5's. Round 6's fixes contain new
logic too (a preserved halt stamp, a roadmap-keyed state, a suppressed duplicate
halt), so a seventh round would probably find something. The loop does not
terminate by itself, and after that record the implementing session is not the
right judge of when it is finished — which is the reviewer-independence argument,
applied to the decision about the review rather than to the review.

So the position is stated instead of decided: the branch is at six rounds, the
trend is legible, and whether a seventh is required before merge is the
maintainer's call.
