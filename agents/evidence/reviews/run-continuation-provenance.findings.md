# Findings: run-continuation-provenance
<!-- completion-review: v1 | reviewed: 2026-08-19 | scope: e9301c79f8548790983bfcf64205e4a565d473107d3e9c551a0c768732cee5f4 | diff: 4f493467a502614abc001ccec8d10abbc2a0a3f2 | reviewer: r2-fresh-subagent-run-continuation-provenance | prompt_hash: ee9f8fd3053529b70b53d489a10f887af96d150c27eda9744d79af2fba7a4cea -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 4f493467a502614abc001ccec8d10abbc2a0a3f2
  scope_hash: e9301c79f8548790983bfcf64205e4a565d473107d3e9c551a0c768732cee5f4
  roadmap: agents/roadmaps/road-to-run-continuation-observation.md
  roadmap_hash: 8e61b5c243d20aaa25cdd081550aabef807f088bad04882ef8669000f8e7b83d
  ac_hash: bb34537a4ce90a2ac144c0346d9d3817fc8ddd788722900f17cdb6b7ed59bea7
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-19T19:01:22Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/hooks/run_continuation_hook.ts:888 | Round 6's halt-preserving guard covers only `driven?.halted`, so a transient roadmap read failure on a run with a LIVE budget still clears the state at :911 — an autonomous worktree run at iteration 20 whose agent switches to a branch without the roadmap (or whose roadmap is rewritten non-atomically) at the stop fire gets `halt-roadmap-absent` plus `rmSync(stateFile)`, and once the file returns the next fire starts at iteration 1 with a fresh 4 h clock, repeatable indefinitely — the same unbounded-loop leak round 6 finding 1 closed for the halted half only. | open | |
| 2 | high | src/scripts/hooks/run_continuation_hook.ts:874 | The absent branch reads the session-id-keyed state with no `roadmap` discriminator (the guard round 6 finding 2 added at :1014 on the main path), so its documented premise "state only exists if THIS concern engaged on this roadmap before" is false after a re-claim: session claims autonomous A and engages 5 iterations, then claims B whose file is absent from the authoritative tree → the ledger gets `halt-roadmap-absent roadmap=B iterations=5` (A's count under B's slug, exactly the round 6 finding 2 shape) and A's live state file is deleted at :911, so re-claiming A begins with a fresh 25-iteration budget and clock. | open | |
| 3 | medium | src/scripts/hooks/run_continuation_hook.ts:1014 | Nulling `prev` on a slug mismatch makes a halt stamp non-durable, defeating "a halt must NOT clear it": state stamped `halt-stall` for A, session then claims autonomous B → `prev === null` → fresh state → the engage write at :1109 overwrites A's stamp (or `complete` at :1082 unlinks it) → re-claiming A engages again with a full 25-iteration budget and a fresh wall clock despite A having already halted. | open | |
| 4 | medium | src/scripts/hooks/run_continuation_hook.ts:906 | `readState` returning null — the truncated/malformed state the round 6 finding 5 comment explicitly names as "the interrupted-write case" — makes `driven?.halted` read `undefined`, so the branch emits `iterations: null` and deletes the file at :911; since the halt write at :1095 is one of only two writes that can be interrupted, an interrupted halt stamp plus one absent-roadmap fire erases both the stamp and the budget, restoring the leak the presence check was added to close. | open | |
| 5 | low | src/scripts/hooks/run_continuation_hook.ts:935 | An over-cap transcript returns EXIT_ALLOW with no ledger event and no state change, so in the long-run regime this concern targets (4 h cap) a session whose transcript crosses 8 MB silently goes inert for the rest of the run while the state file keeps a live budget — the one termination rung that writes no named event, contradicting the header's "every rung a named event" enumeration and leaving an inert mechanism indistinguishable in the ledger from a healthy idle run. | open | |
| 6 | low | src/scripts/hooks/run_continuation_hook.ts:241 | The `history_source` guard in `isDuplicateFire` reads a pre-upgrade state file (field absent) as a changed source, so on the first fire after upgrade a genuine duplicate stop fire for one reply is not recognised as a duplicate: it consumes an iteration and appends an extra `engage` line to the ledger the acceptance criteria count from, the same false count round 5 finding 6 added the guard to prevent. | open | |
