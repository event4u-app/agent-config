# Findings: feat-road-to-verified-stale-lock-reclaim
<!-- completion-review: v1 | reviewed: 2026-11-13 | scope: f0586ab6d63b4fde0a1a8c2fe94bb674c8eb1465894ace3acd288baf21d4b7fe | diff: 8e24a81947c72f0191589d01166879e436bd5e11 | reviewer: r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim | prompt_hash: de4bfb6f0777f21036f5e9a9893b376b4dc6b5f8a8ed7b9ba34013e2e9a37b52 | round: 4 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-13 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 8e24a81947c72f0191589d01166879e436bd5e11
  scope_hash: f0586ab6d63b4fde0a1a8c2fe94bb674c8eb1465894ace3acd288baf21d4b7fe
  roadmap: agents/roadmaps/road-to-verified-stale-lock-reclaim.md
  roadmap_hash: 2a26be338d5a6a274803615c1aa64e0a330b9d95c01ada69a13b2a3fd075e7db
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-13T14:47:05Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/hooks/state_io.ts:368-372 | The `_acquire_lock` docstring says the session-pin paths are taken by strict callers only, "so a pin holder is never superseded". The retention pruner in the same file (line 789) calls `tryAcquire(lock, { staleMs: LOCK_STALE_MS, ... })` with the default `breakStale: true` on every retired state file's `.lock.held` family, and `pruneStalePins` routes pin files through it. So a stale pin holder IS superseded, by a non-strict caller. The paragraph above it ("until the retention prune releases its generation") even relies on that. The absolute safety claim is false, and a reader judging whether a paused pin holder can write past a successor is misled. | fixed | 08958e9c17 |
| 2 | medium | src/scripts/_lib/generation_lock.ts:164-178 | `acquire` counts only requested sleep toward `waitMs` (`slept += spin`), not elapsed time. For `state_io` (`LOCK_ACQUIRE_DEADLINE_MS` 5,000 / `LOCK_SPIN_SLEEP_MS` 2, lines 339-342) that is up to 2,500 attempts. Each attempt does two `readdirSync` calls of the target's directory plus `stat`s, and the change itself makes that directory grow by one file per retired lock (step 3.6). Wall time past the "5 s deadline" therefore grows with directory size and `Atomics.wait` oversleep. The old loop compared `Date.now()` with the deadline. Roadmap step 2.1 requires "every retry bounded by the 5 s deadline and the non-blocking contract", which a blocking hook caller no longer gets as a wall-clock bound. | fixed | 08958e9c17 |
| 3 | medium | agents/evidence/ratifications/verified-stale-lock-reclaim-20261113.md:18 | The record ratifies the subject at commit `97eb163a17` (r15 question, line 9), where the `state_io` pruner removed `slice(0, -1)` of each family. The anthropic seat's verdict cites exactly that form. After ratification, commit `c8ea6fc20d` (in this branch) changed `state_io.ts` and `budget_guard.ts`. The pruner now takes the lock with `breakStale: true` and supersedes a stale holder, including a strict pin holder, then releases it. The ledger lock now refuses on any thrown error. The record's prose ("pruners that keep each lock's highest generation") and both seats' reasoning describe code that no longer ships, and no round reviewed the supersede-in-pruner behaviour. | fixed | The gated helper changed in 08958e9c17 (wall-clock deadline), so ratification runs again over the code that ships, pruner and ledger path included; the record is re-rendered from that round. |
| 4 | medium | agents/roadmaps/road-to-verified-stale-lock-reclaim.md:101 | "Closes when" requires "each Phase 2 site's harness run was seen red before its fix". Step 2.5, a Phase 2 step marked `[x]`, states that its three converted sites (`advisories`, `cli_call_budget`, `worktree_cleanup_check`) "are not in the site harness and were not run red first". Read literally, the close condition is unmet. If "Phase 2 site" means only the five originally listed sites, the condition is ambiguous exactly where it was narrowed. | fixed | 08958e9c17 |
| 5 | low | agents/roadmaps/road-to-verified-stale-lock-reclaim.md:74 | Step 2.6 cites `_lib/generation_lock.ts:21-23` as where the helper states the unfenced limit. In the shipped helper that statement is at lines 30-34, and lines 21-23 now describe the pruner / back-off invariant. | fixed | 08958e9c17 |
