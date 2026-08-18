# Findings: feat-per-turn-hook-economy
<!-- completion-review: v1 | reviewed: 2026-08-18 | scope: 55cb4455fce5153a520c71502583b4e9646a34cf3c88d22c3fb1f4552eb731d6 | diff: bcd73ed2d74d62e7e7b58e1323dd982a130e1947 | reviewer: r2-fresh-subagent-feat-per-turn-hook-economy | prompt_hash: 57a2f07864c673afbc43110e62a49c4d09d77cc52e194dfc359e5931a7643b2e -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: bcd73ed2d74d62e7e7b58e1323dd982a130e1947
  scope_hash: 55cb4455fce5153a520c71502583b4e9646a34cf3c88d22c3fb1f4552eb731d6
  roadmap: agents/roadmaps/road-to-per-turn-hook-economy.md
  roadmap_hash: 11aab6bc2bd1f604ce9f1a1a3b15b0783f338a3a25ffdfa6ad75fdc7c1851364
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-18T15:35:00Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_progress_hook.ts:121 | `mark_dirty` does an unlocked read-modify-write with plain `fs.writeFileSync` under `agents/runtime/state/`, while `hook-architecture-v1.md:443` requires the `.dispatcher.lock` → tmp → rename sequence that `hooks/state_io.ts` already implements as `atomic_write_json`. Two parallel `post_tool_use` dispatches in one turn both read `[]` and the second write drops the first root; `mark_dirty` returns `true`, so the design's own net (an unwritable ledger regenerates inline) never fires. The outcome is exactly the silently-stale dashboard the debounce claims to prevent | open |  |
| 2 | high | src/scripts/hooks/dispatch_hook.ts:1320 | `_readStdin` and `hook_stdin.readHookStdin` still convert **any** read failure to `""`. The diff removed the known trigger but left the fail-open conversion: an exhausted EAGAIN budget, `EIO` or `EBADF` still yields an empty envelope, the chain runs with no `tool_name`, and the dispatcher exits 0 — including for `fail_closed: true` blocking guards, with nothing on stderr. `_lib/stdin.ts:20-26` names this exact shape as worse than the crash | open |  |
| 3 | medium | src/scripts/roadmap_progress_hook.ts:85 | `FLUSH_EVENTS` misses native aliases its own comment exists to cover: cline maps `TaskComplete`→session_end and `TaskCancel`→stop, gemini maps `AfterAgent`→stop. The write path keys on `tool_name`, not the event, so those hosts accumulate dirty roots nothing flushes | open |  |
| 4 | medium | agents/roadmaps/road-to-cost-parity-1-rule-payload-diet.md:294 | The census advertised as read straight off the manifest was taken BEFORE step 3.1's manifest edit in the same PR. Post-change: claude `stop` 11 (table says 10), claude `session_end` 4 (says 3), the five other hosts `stop` 6 (says 5) and `session_end` 4 (says 3). Step 4.3's `verify:` is therefore false | open |  |
| 5 | medium | src/scripts/hooks/end_review_nudge_hook.ts:406 | `fs.readFileSync` of every untracked non-doc file with no SIZE bound plus a per-byte JS loop, on the Stop slot. `UNTRACKED_FILE_CAP` bounds file count, not bytes, and the replaced `git diff --no-index` never materialised content in the hook process. One large untracked file now costs a full allocation plus O(n) iteration per turn end | open |  |
| 6 | medium | src/scripts/bench_hook_latency.ts:206 | `benchEvent` forces `AGENT_CONFIG_REPLAY=1` and `roadmap_progress_hook.run()` short-circuits on replay for BOTH paths, so the per-turn composite step 4.1 registers is structurally blind to the step-3.1 change it is meant to track — it can show neither the removed `post_tool_use` spawn nor the new `stop` flush cost | open |  |
| 7 | medium | tests/scripts/hooks/roadmap_progress_hook.test.ts:363 | The new debounce `describe` carries no `.skipIf(!tsx)` although five cases assert the tsx-run regenerator's marker; the sibling `run()` block carries that guard for exactly this reason | open |  |
| 8 | medium | src/scripts/bench_hook_latency.ts:73 | `BUNDLE_OVERRIDE` and `PAYLOAD_BYTES` are module globals never reset at the top of `main()`, while their measurement-only guard is per-invocation. Two `main()` calls in one process can write a foreign or padded reading into the budget row — the precise outcome the guard's message says must never happen | open |  |
| 9 | medium | tests/scripts/hooks/dispatch_large_payload_guard.test.ts:63 | `spawnSync` timeout is 120 000 ms against a 10 000 ms vitest `testTimeout` and a ~10 s EAGAIN budget, so a regression of the class this test exists to catch surfaces as a vitest timeout rather than the bypass assertion | open |  |
| 10 | low | src/scripts/hooks/end_review_nudge_hook.ts:232 | Two docstrings still describe the removed subprocess (`UNTRACKED_FILE_CAP` at :232 and `totalNonDocMutatedLinesWithMeasure` at :444) | open |  |
| 11 | low | src/config/hook-latency-budget.json:18 | `aggregation` and `definition` are never read — the bench hardcodes p50 and re-implements the formula, so editing either changes nothing while the printed label keeps asserting p50 | open |  |
| 12 | low | src/config/hook-latency-budget.json:22 | `_observe_only_note` says the composite sums six measurements; the definition sums four slots | open |  |
| 13 | low | docs/contracts/hook-architecture-v1.md:404 | "eight of the twelve claude concerns" contradicts its own enumeration of nine names — only three declare `tools:`, so 12 − 3 = 9. The cancellation conclusion holds; the number is wrong in a contract file presenting it as verified | open |  |
| 14 | low | src/scripts/bench_hook_latency.ts:137 | `TOOL_EVENTS` pads `tool_response` onto `pre_tool_use`, where that field never occurs, while the same comment rejects padding `stop` because the shape does not occur. The realistic large `pre_tool_use` field is `tool_input` | open |  |
| 15 | low | tests/scripts/hooks/dispatch_large_payload_guard.test.ts:47 | The test points `--project-dir` at `REPO_ROOT` with replay cleared, so three real 12-concern chains execute against the working repo during the suite; a temp project dir exercises the same property | open |  |
