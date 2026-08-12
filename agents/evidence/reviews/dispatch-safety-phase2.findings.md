# Findings: dispatch-safety-phase2
<!-- completion-review: v1 | reviewed: 2026-08-12 | scope: 944e948349d00ab0df3e6aa7e6002446edf7567e246981153c6d8b0aee180765 | diff: 75dbdb35fce020568fbeba978f14b521599aee67 | reviewer: r2-fresh-subagent-dispatch-safety-phase2 | prompt_hash: 3523670a817cef86e1b87ec8f36673fb3184368f07c0be45b2087c533fadcd19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 75dbdb35fce020568fbeba978f14b521599aee67
  scope_hash: 944e948349d00ab0df3e6aa7e6002446edf7567e246981153c6d8b0aee180765
  roadmap: agents/roadmaps/road-to-inbox-harvest-2026-08-b-dispatch-safety.md
  roadmap_hash: f0fa96bd44668ca642165d09033a0dd8101773a147840940b3dac9bfdfe3daac
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-12T00:18:42Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation_store.ts:109 | The new `isSafeToken` guard is applied to the three caller-facing read verbs but not to the two remaining sites where a token becomes a path. `putPending` joins the caller-supplied `stage.token` straight into `path.join(pendingDir(root), ...)` and `writeStageFile` then `mkdirSync(recursive)` + `writeFileSync` — an exported write primitive that, given a hand-built or deserialized `StagedAction` with `token: '../../../../tmp/x'`, creates directories and writes a JSON file outside the store. `pruneExpired` (:267-268) does the same with a token read off disk, and the hardened `isStage` (:79-91) still does not constrain the token shape, so any externally-written record carries an arbitrary token into that join. The doc comment added by this diff claims the token is checked before it reaches `path.join` and that the check removes the class; two unchecked `path.join` sites remain, so the stated guarantee is stronger than the change. Mirrored identically in the dist projection. | open | |
| 2 | medium | tests/scripts/staged_confirmation.test.ts:396 | The traversing-token spec does not fail if the guard it claims to pin is removed, for three of its four assertions. The planted `outside.json` contains `stage()`, whose token is the real derived hash, so with `isSafeToken` deleted `confirmOnce`/`declineStage` still return `token-mismatch` / `declined:false` for the `'../outside'` argument — the token comparison, not the new guard, produces those values. The existence assertion is unfalsifiable by construction: `pending/` and `resolved/` are siblings at equal depth, so both `../outside.json` joins resolve to the same path and the rename can never move the file away. Only the `readPending` assertion discriminates. To exercise claim/decline the planted record must carry `token: '../outside'`, and the assertion must be on the outcome, not on existence. | open | |
| 3 | low | src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation_store.ts:267 | `pruneExpired` rebuilds the source path as `pending/<token>.json` instead of using the filename `listPending` enumerated (which discards the name it came from). Any record whose filename differs from its token field therefore hits ENOENT on `renameSync`, is swallowed by the bare catch, stays in `pending/` permanently, is re-listed as expired on every gate render, and is omitted from the returned `moved` count. Conversely a traversing token makes source and target resolve to the same path, so the rename is a successful no-op that increments `moved` while removing nothing. | open | |
