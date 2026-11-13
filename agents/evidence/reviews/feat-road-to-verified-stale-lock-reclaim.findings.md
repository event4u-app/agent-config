# Findings: feat-road-to-verified-stale-lock-reclaim
<!-- completion-review: v1 | reviewed: 2026-11-13 | scope: 68840ff399aabafa8973c3fdb884ec8341753ccb19c2f8e3f0ea6e5a996fecec | diff: 08da1d11a6c4942d1f0e3c09ee0d5d25b73dfe03 | reviewer: r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim | prompt_hash: bd49862308b09e692f3f544243bfbdd2175d0f5c805e592cb015e4b3c966acb1 | round: 3 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-13 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 08da1d11a6c4942d1f0e3c09ee0d5d25b73dfe03
  scope_hash: 68840ff399aabafa8973c3fdb884ec8341753ccb19c2f8e3f0ea6e5a996fecec
  roadmap: agents/roadmaps/road-to-verified-stale-lock-reclaim.md
  roadmap_hash: 58b076e0c019614568062ba058b5ffb04dbb2e2fba68e201ee87317f329ba70e
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-13T14:35:45Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/hooks/state_io.ts:365 | The strict-caller contract "A dead holder therefore blocks that session's pins, each attempt reported, until the retention prune" is no longer true. A crashed strict holder leaves a generation that is stale but not released (mtime ≠ 0); strict callers return `false` on it (`generation_lock.ts:119`), and the retention prune now keeps the highest generation of every retired lock (`state_io.ts:783-788`, and `session_pins.ts:698` skips `.lock.held[.<g>]` by name). So the stale generation survives the prune, and a session id that is resumed after retention cannot write its pins again. Before this change the pruner removed `.lock.held` together with the state file, which ended the block. Roadmap step 3.5 (line 86) repeats the same false "until the retention prune" bound for its leftover generation. The risk register (row 2, "blocks its callers for good") states the real behaviour, so the record contradicts itself. | open | |
| 2 | medium | src/scripts/ai_council/budget_guard.ts:649 | `_withLedgerLock` now lets `acquire` throw: a non-`EEXIST` create failure (EACCES, EROFS, ENOSPC) or a listing failure propagates. The old loop caught every open error and returned `null` once the wait ran out. `reserve_spend` (`return verdict ?? { ok: false, reason: 'lock' }`) and `close_reservation` therefore throw where their contract is a refusal or `false`, and `round_reservations.ts:70/103/112/121` calls them without a try. The other converted sites catch the throw and pick a behaviour (state_io, language_mirror, advisories, worktree_cleanup_check, cli_call_budget). The helper's doc says that choice "is the caller's decision", and this caller never makes it. | open | |
| 3 | low | src/scripts/hooks/state_io.ts:12 | Header step 1 still says writers "Acquire an exclusive lock on `<state_dir>/.dispatcher.lock`". The lock is now the `.dispatcher.lock.held[.<g>]` generation family, and `.dispatcher.lock` is no longer created at all, because the old `openSync(lock_path, "a")` sentinel is gone. The cross-platform note at lines 28-31 is correct, so the header contradicts it. | open | |
| 4 | low | agents/roadmaps/road-to-verified-stale-lock-reclaim.md:85 | Phase 3 lists step 3.6 before 3.5. | open | |
