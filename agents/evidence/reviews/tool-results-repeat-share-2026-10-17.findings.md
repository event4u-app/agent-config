# Findings: tool-results-repeat-share-2026-10-17
<!-- completion-review: v1 | reviewed: 2026-10-16 | scope: f0fc34d7617e65f4c41ed034c1d4ebeba4124b5f6e201b6cbfe5de5d37b6da2c | diff: 5f5ed2264e4c9e7d879a7dcf8493a609ec3b4c1e | reviewer: r2-fresh-subagent-tool-results-repeat-share-2026-10-17 | prompt_hash: 44e35506aabbe6aa8a97326e84848ce82f2c386c5f3979c6b89f54529dd26f00 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-tool-results-repeat-share-2026-10-17"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-16 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 5f5ed2264e4c9e7d879a7dcf8493a609ec3b4c1e
  scope_hash: f0fc34d7617e65f4c41ed034c1d4ebeba4124b5f6e201b6cbfe5de5d37b6da2c
  roadmap: agents/roadmaps/road-to-tool-results-that-leave-a-handle.md
  roadmap_hash: 1ccaec15eca2d12a199a9d22d9e7f58f73db46dbfdb452468b43e54c747cda65
  ac_hash: 28424eb8fdba22c7b2887e4d49cf71d32ea3b3af2608f6cf96a2ab8318a01c14
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-16T22:03:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/_lib/cc_transcript.ts:718 | `session` is taken from the record's `sessionId` first, but `listTranscriptFiles` recurses into `<sessionId>/subagents/agent-*.jsonl` (module header, lines 24-27) and sidechain records carry the parent's `sessionId`. A subagent re-reading a file its parent already read, or two subagents reading the same file, then key as the same session and count as repeats, although that content was never in the reader's context. This inflates `repeatShare`, which contradicts the "lower bound" claim the roadmap (step 1.4 note) and the `repeatShare` docblock make, and it feeds the AC-4 decision. Session identity should account for `agentId`/`isSidechain` (or the file path) | fixed | ccda9f289 |
| 2 | low | src/scripts/report_reducible_classes.ts:306 | The sort comparator is not transitive when some timestamps are null: NaN pairs fall back to index order and the other pairs use time order (A(t=10,i=0) < B(NaN,i=1) < C(t=5,i=2) < A). Repeat counts per key do not depend on order, but which delivery counts as "first" does, so `repeats.advised` (and `repeat_bytes`, if sizes differ for one digest) can change with engine sort behaviour | fixed | ccda9f289 |
| 3 | low | tests/scripts/report_reducible_classes.test.ts:217 | The fixture comment says "a result without a digest cannot match", but the `Read:image` record inherits `digest: 'd1'` from the defaults and is excluded only because `Read:image` is not in `CONTENT_CLASSES`. The `r.digest === null` branch of `repeatShare` is never exercised, so the test does not cover what its comment claims | fixed | ccda9f289 |
| 4 | low | src/scripts/_lib/cc_transcript.ts:656 | `advised` is set by a literal substring `re-read guard: ` anywhere in any attachment's `stdout`. Nothing ties it to `reread_guard_hook` or to a PreToolUse event, and the only evidence of the real hook's output shape and prefix is a self-authored fixture. If the hook's wording or envelope (for example `additionalContext` stored outside `stdout`) differs, `advised` silently reads 0 and nothing reports it | fixed | ccda9f289 |
