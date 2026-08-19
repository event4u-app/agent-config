# Findings: run-continuation-provenance
<!-- completion-review: v1 | reviewed: 2026-08-19 | scope: 79e08771d69e389442e5a68c414c5f53a5717f2bdabe8a705030d10af52eb98f | diff: 4822ff6a6c8ba89253ca108e6a9809f1daf1eb3a | reviewer: r2-fresh-subagent-run-continuation-provenance | prompt_hash: bdbe8fe84ecc38f83c7f277976b6437173a4011568d613f05dd8aeadf990951b -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 4822ff6a6c8ba89253ca108e6a9809f1daf1eb3a
  scope_hash: 79e08771d69e389442e5a68c414c5f53a5717f2bdabe8a705030d10af52eb98f
  roadmap: agents/roadmaps/road-to-run-continuation-observation.md
  roadmap_hash: 321f80d1f5928fe09ae87bc6fd51307636a6033f73d77f2035f88811cb495861
  ac_hash: bb34537a4ce90a2ac144c0346d9d3817fc8ddd788722900f17cdb6b7ed59bea7
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-19T17:13:40Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/hooks/run_continuation_hook.ts:573 | `session_checkout` degrades silently to `workspace_root` whenever `payload.cwd` is absent or is not itself a checkout root, so a session started from a subdirectory of a worktree (`cd <worktree>/src && claude`, where `git_dir('<worktree>/src')` is null) emits `session_root === workspace_root` AND `git_dir === git_common_dir` for a genuine two-tree run — both documented discriminators read FALSE, which is exactly the R2-finding-1 false negative reintroduced through the degradation path, and no field in the line lets a reader tell "same tree" from "could not resolve". | open | |
| 2 | medium | src/scripts/hooks/run_continuation_hook.ts:415 | The docblock's third discriminator — `claim_path` under `git_common_dir` → "the fix working" — is vacuously true on a degenerate line: when the session root is not a repo both git fields are `''` (pinned as real emitted behaviour by the defer-branch case at tests/hooks/run_continuation_dispatch.test.ts:445-447) and any absolute `claim_path` satisfies `startsWith('')`, so a third-party reader applying the documented rule to that line concludes the contract crossed into the shared root when the line proves nothing. | open | |
| 3 | medium | tests/hooks/run_continuation_dispatch.test.ts:378 | The exact-string normalization pins added for R2 finding 3 cover only `workspace_root` (line 396) and `git_common_dir` (line 395); every `session_root` assertion wraps both sides in `real()` (lines 329, 378), so dropping `normalizeDir` from the `session_root` branch of `provenance` — passing the envelope `cwd` verbatim, the precise regression finding 3 fixed — leaves the whole suite green on macOS where `/var` resolves to `/private/var`. | open | |
| 4 | low | src/scripts/hooks/run_continuation_hook.ts:54 | The file header still enumerates the provenance contract as four fields (`workspace_root`, `git_dir`, `git_common_dir`, `claim_path`) and omits `session_root`, while `provenance()`'s docblock (line 397) and the call-site comment (line 562) both say five — the file's canonical statement of what every event carries now contradicts the code it describes, so a later edit dropping `session_root` would violate no documented contract and a ledger auditor reading the header would not look for the field. | open | |
| 5 | low | src/scripts/hooks/run_continuation_hook.ts:488 | `git_dir` and `git_common_dir` are each resolved twice per emitted event — once inside `session_checkout` (src/scripts/session_register_hook.ts:430-433) to validate the cwd, then again in `provenance` against the realpath of that same root — costing roughly six redundant `statSync`/`readFileSync`/`realpathSync` calls on every `stop` fire of an autonomous run, which is the same per-fire cost the R2-finding-6 comment cites as its reason for moving the call. | open | |
| 6 | low | src/scripts/hooks/run_continuation_hook.ts:570 | `roots` is built above the three transcript early-returns (`!transcriptPath` at 580, the over-cap `statSync` guard, and a throwing `readTranscriptTail`), so the R2-finding-6 rationale is only half applied: an autonomous-mode session with a transcript over `TRANSCRIPT_READ_MAX_BYTES` pays the full provenance resolution on every stop fire to build a value the next lines discard, and all `appendEvent` sites already sit below the turn-identity block. | open | |
| 7 | low | src/scripts/hooks/run_continuation_hook.ts:413 | The docblock labels `session_root !== workspace_root` "the shipped defect condition, now visible per event", but after the fix (claim written into the git common dir) writer!=reader is the normal healthy two-tree arrangement — the recorded 2026-08-19 run is exactly that shape — so a third-party reader following this docblock reads a healthy engagement line as evidence that the defect is present. | open | |
