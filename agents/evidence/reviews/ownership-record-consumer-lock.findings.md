# Findings: ownership-record-consumer-lock
<!-- completion-review: v1 | reviewed: 2026-10-18 | scope: 0bd760e1ccbd621e9ce545e0cbea6e882e2e4074b00fd3289770a2aad5e96c8d | diff: d99c735c6cfa6f6bd4f4959ab355f5f0ed5eb065 | reviewer: r2-fresh-subagent-ownership-record-consumer-lock | prompt_hash: c5302a91a108cb96e00b64a6074dac7e3c99b403c3017ab0b0a98a3e20c88821 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-ownership-record-consumer-lock"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d99c735c6cfa6f6bd4f4959ab355f5f0ed5eb065
  scope_hash: 0bd760e1ccbd621e9ce545e0cbea6e882e2e4074b00fd3289770a2aad5e96c8d
  roadmap: agents/roadmaps/archive/road-to-an-ownership-record-that-belongs-to-the-user.md
  roadmap_hash: 996cc658b2682ffa59cd72c7bd254c1f3b0f88c30ff54fca7cfd932df44c9716
  ac_hash: 92ef417c3c5a627b54dda38297f13839104a380260598be013fd5fd9761174ee
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-18T20:10:47Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/install/manifestFiles.ts:325 | `dropGlobalScopeFiles` runs on every lock write, including the project-scope write (`install.ts:4925`) and any teammate's install that is then committed, but only the global-deploy path records the ledger before the strip. A user whose global edits were recorded only in the lock's global `files[]` (a pre-ledger install, or a ledger lacking those digests) loses that digest on the first non-global write; the next global install then sees the path in neither lock nor ledger, takes the 'genuinely unrecorded' write arm, and overwrites the edit silently - the Phase 1 loss reintroduced through a migration gap. | open | Transfer stripped global digests into the ledger (or strip only on the global-scope write) before discarding them. |
| 2 | low | src/scripts/_cli/cmd_uninstall.ts:758 | The new guard catches a global entry only when it is NOT v2. A lock committed before this change still carries absolute global `files[]` until the next install, so a project `uninstall` of that entry goes down the v2 path and runs `_delete_tool_files` on `$HOME`-rooted paths - contradicting the new contract sentence in `install-layout.md` and `installed-tools-lockfile.md` that a project uninstall drops a global entry without touching any file. | open | Guard on `scope === 'global'` alone, or qualify the contract sentence. |
| 3 | low | src/scripts/_cli/cmd_uninstall.ts:762 | Under `--dry-run` the new branch prints 'global-scope entry removed' although nothing is removed; every sibling branch says 'would remove' / 'would purge' in dry-run, so the preview reads as an action taken. | open | Match the dry-run wording of the sibling branches. |
| 4 | low | src/scripts/_lib/neighbour_census.ts:546 | The census reads the ledger of the asking process (`packageClaimedPaths` default inventory) even when `opts.homeRoot` names a different home - the exact hazard `installed_layer.defaultInventoryPath` documents (a report about another home claiming by the wrong inventory). Only the new test passes `inventoryFile`; existing callers with a planted home silently read the real user inventory. | open | Derive the default inventory from `homeRoot` when one is stated. |
| 5 | low | src/scripts/_lib/skill_origin.ts:104 | `packageClaimedPaths` returns before the ledger is read whenever the project has no lock, and the census maps that `null` to no claims. In the ADR-020 global-only mode (no project settings, so no lock) the ledger therefore never claims global skills in the census, although the ledger is now the stated home of global ownership; the fix only applies to projects that happen to carry a lock. | open | Read the ledger independently of the lock's presence, or document the limit. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
