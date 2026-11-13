# Findings: feat-road-to-verified-stale-lock-reclaim
<!-- completion-review: v1 | reviewed: 2026-11-13 | scope: 52d62b56d59becd52bcccd5b207464f93bcfa0ce14eaa63d9a5c9510b53929f0 | diff: ca023b350ab12ab018b1b1ee6c9b425b1dc1c38a | reviewer: r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim | prompt_hash: 35b46a69ea3b9b1f0faa09458491b1675f3b0542c41c16bc3eeb101c183eedee | round: 5 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-road-to-verified-stale-lock-reclaim"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-13 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ca023b350ab12ab018b1b1ee6c9b425b1dc1c38a
  scope_hash: 52d62b56d59becd52bcccd5b207464f93bcfa0ce14eaa63d9a5c9510b53929f0
  roadmap: agents/roadmaps/road-to-verified-stale-lock-reclaim.md
  roadmap_hash: 19474929c763ff7567351b4c5049bd27f947ebf4f3bce586b1fc11ca600e6dfe
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-13T18:13:45Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/hooks/state_io.ts:120 | The `_target_lock_path` doc (lines 120-124) and the pruner comment above the lock loop (lines 768-776) still describe the removed behaviour: "that pruner now removes them alongside the state file it prunes, so this does not trade a lock for unbounded sentinel growth", "Safe to remove unconditionally at this point", "a writer that arrives afterwards creates both anew", and "Without this ... would leave one sentinel per retired session forever". After this change the pruner removes nothing unconditionally (it acquires and releases), no `<digest>.json.lock` sentinel is created any more, and one released generation per retired lock now stays forever, the residue roadmap step 3.6 records. The comments contradict the code and the new paragraph appended directly below them in the same block. | open | branch diff of state_io.ts (pruner hunk at @@ -883 and the unchanged doc at lines 120-124); roadmap 2.5 and 3.6 |
| 2 | medium | src/scripts/hooks/state_io.ts:236 | The `atomic_write_json` doc still says "The lock file is `<target.parent>/.dispatcher.lock`". The change stopped creating that file: `_acquire_lock` no longer opens the `.dispatcher.lock` sentinel, and the lock is the generation family `.dispatcher.lock.held[.<g>]`, as the module header (line 12) and the cross-platform note (line 31) now say. The path is wrong, and the header updated in this diff contradicts it. | open | branch diff of state_io.ts, `_acquire_lock` hunk (removed `fs.openSync(lock_path, "a", 0o644)`) |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
