# Findings: drain-road-to-drain-commands
<!-- completion-review: v1 | reviewed: 2026-08-21 | scope: 296c8627bf3e41ea1a7f52e73abd7d3d5657ee178d1ec7c8a59a1e5e305b20c9 | diff: e9d6c96f9b1ce695e0828e32058fc684c1f449fc | reviewer: r2-fresh-subagent-drain-road-to-drain-commands | prompt_hash: ab906deda2fc5a74e8100a8c109b7d0db648f97e28ae032d576354616fb963c4 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-21 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e9d6c96f9b1ce695e0828e32058fc684c1f449fc
  scope_hash: 296c8627bf3e41ea1a7f52e73abd7d3d5657ee178d1ec7c8a59a1e5e305b20c9
  roadmap: agents/roadmaps/road-to-drain-commands.md
  roadmap_hash: 983c6551f07be9fa1371a10fefbe264ea2ac92938543a0cddecbd64f6a33ba5a
  ac_hash: 188021fb998afe8f9cc88bcdcd23e8762e75b922de5a4b76cab8729d3de506a2
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-21T09:33:05Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | blocker | agents/roadmaps/road-to-drain-commands.md:31 | Stale pre-R2 text still asserts `--merge` ships ACTIVE, contradicting the shipped state and this same file's own blocker. The Goal says the PR command "prepares open PRs to mergeable and merges them"; the council table says "`--merge` does ship"; a paragraph head says "Why `--merge` ships despite the Q1/Q3 verdict". All three are refuted by ADR-239 § 3, by both command files' gate banners, and by the `merge-authority` blocker 250 lines below in the same file. This is the governance record for an owner-reserved safety gate and it states the opposite of the decision it records. | open | AC-4, AC-5 |
| 2 | major | src/domains/product-basic/roadmap/process-full/command.md:232 | The `--all` loop's list of loop-ending conditions marks a `/pr:merge` § 8 kill switch "always" live, but § 8 is scoped "Stop before the next merge on any of:" and nothing merges while the gate is closed. The same table correctly marks window expiry inert and does not apply that reasoning here. As written an autonomous estate sweep has exactly ONE live loop-ending condition. Either § 8 states its checks are armed during preparation too, or this row is marked inert like the expiry row. | open | AC-4 |
| 3 | major | agents/roadmaps/road-to-drain-commands.md:312 | Step 5.1 is closed and states the ADR records that `--merge` typed in the invocation "is the per-turn confirmation the Hard Floor requires". ADR-239 records the opposite: § 3 says merge authority is not extended, § 4 frames the design conditionally. The step's verify only checks the ADR exists and cites two sources, so the closed checkbox certifies a claim the artefact contradicts. | open | AC-7 |
| 4 | minor | src/config/estate-count-budget.json:526 | The `why` prose says "raised active_roadmaps 11 -> 12", but the record's own value is 11 and the same prose two sentences later says the +1 lands on 11/44. The move was 10 -> 11. A ratchet record contradicting its own numbers. | open | — |
| 5 | minor | agents/roadmaps/road-to-drain-commands.md:5 | Both the roadmap frontmatter and the budget record say "27 of 29 steps closed". Actual: 31 numbered steps, 29 `[x]`, 2 `[~]`. The dashboard agrees. Correct figure is 29 of 31, and the number is load-bearing — it justifies the `estate_offset_exempt` escape. | open | — |
| 6 | minor | src/scripts/hooks/block_unauthorized_git.ts:493 | The new header says the widened expression is deliberately not written out because a regression grep would match the guard's own prose — then recites the marker literal three sentences earlier. The principle was applied to the number and violated for the marker string in the same comment. | open | AC-1 |
| 7 | minor | src/scripts/check_hook_bundle_content.ts:98 | The `allowEmpty` reason carries none of the three prefixes `_lib/scan_scope.ts` requires, whose stated purpose is that a reviewer can classify the exemption from the diff alone. The sibling gate carries `OPTIONAL_INPUT:` for the identical condition. `assertScanned` does not enforce it, so nothing reds — an unenforced contract breach in a gate whose subject is unreviewable greens. | open | AC-2 |
| 8 | minor | src/domains/git/pr/merge/command.md:58 | Five relative links resolve to nonexistent paths. Round 2's finding 13 asked for the sibling's 3-level convention and was WRONG — measured on this tree, the sibling's own links do not resolve either (pre-existing debt, not a convention). Correct depths from this file are `../../../../rules/` and `../../../../../docs/`. `check_references` strips leading `../` before resolving, so no gate sees it. | open | AC-3 |
| 9 | minor | agents/roadmaps/road-to-drain-commands.md:331 | Step 5.3 is closed and claims the `roadmap` cluster head's `argument-hint` reflects the new flags. The head is unchanged; only its sub-command table row was edited. The step's verify checks the documented-commands linter and the catalog diff, neither of which inspects `argument-hint`, so the closed box certifies an edit that was not made. | open | AC-8 |
