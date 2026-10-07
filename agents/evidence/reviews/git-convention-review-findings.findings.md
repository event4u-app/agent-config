# Findings: git-convention-review-findings
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: ef0ff6bbdbc13583344bbbfecc9bb0ee4ebe17aaa33f19ec8015c05ff74e7554 | diff: e119a8f7d9bb1b70c8387f5cd3ce561930234ee1 | reviewer: r2-fresh-subagent-git-convention-review-findings | prompt_hash: 498a7011e534ab89fdc17998fe9167ef2d763bb436913cb37a36c99873861fbc -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-review-findings"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e119a8f7d9bb1b70c8387f5cd3ce561930234ee1
  scope_hash: ef0ff6bbdbc13583344bbbfecc9bb0ee4ebe17aaa33f19ec8015c05ff74e7554
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T15:33:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/server/routes/settings.ts:497 | In global mode, a PUT for a missing user-global file now merges into `current.writeLayerRaw ?? ''`. `mergeIntoTemplate('', values)` finds no nested key in an empty body, so it writes every leaf as a flat dotted line under `# Wizard-added keys`. A probe returned `personal.autonomy: 'on'` / `project.audience: public`. YAML reads `personal.autonomy` as one top-level key literally named with a dot, and `load_agent_settings` (`_get_dotted`) and the server's own `readLayeredSettings` merge never resolve it. So the first global-mode save, when only a project file exists, writes a user-global file whose settings are all silently ignored. The test at `tests/server/git_keys_write_route.test.ts:204` only asserts that `git` is absent, never that the written file reads back. Seed an empty base from the template, not `''`. | open | |
| 2 | medium | src/scripts/sync_pr_branch.ts:1057 | `checkPin` reads the strategy again at `pinned.before`, the SHA the server reports when the pin is taken. The merge then runs `git merge <ref>` on the local remote-tracking ref, which `sync` fetched earlier (`:746`) and never fetches again. If the target moves between that fetch and the pin, the policy check covers a commit other than the one merged. Also, `integrateWithPinnedBase` retries after a detected base move without fetching. The retry merges the same stale local ref, sees no further server movement, and reports `integrated … on attempt 2` although the new server commit was never integrated. Pin by SHA (fetch the pinned SHA and merge it), or fetch before each attempt. | open | |
| 3 | low | src/scripts/sync_pr_branch.ts:970 | When `--base` or `--repo` has no value (or is followed by a flag), the script exits `1`. A blank `--base` exits `2`. The documented contract (header, `--help`, `branch-update.md` § exits) gives `1` to conflict or unresolvable base and `2` to usage. A caller that branches on exit 1 as "base unresolvable / conflict" misreads a usage error. `git:convention show` returns `2` for the same mistake. | open | |
| 4 | low | src/scripts/_cli/cmd_git_convention.ts:302 | `subject --format X` / `--family X` with an unknown value exits `1`, which documents as "a subject fails / format unreadable". `measure --family X` exits `2` (usage) for the identical mistake (`:430`). A caller cannot tell a bad flag from a rejected subject. | open | |
| 5 | low | src/scripts/_cli/cmd_git_convention.ts:370 | `ticketCommand` falls back to `git rev-parse --abbrev-ref HEAD`, which prints the literal `HEAD` on a detached checkout (CI, worktree on a SHA). That string is treated as the branch name and reported as `ticket none` with no hint that no branch was read. | open | |
| 6 | low | src/scripts/_lib/git_convention_measure.ts:297 | `readHistory` collects branch names from every remote without de-duplicating by name. A branch present on both `origin` and a fork remote is counted twice, which inflates `sampled` and skews the `MIN_BRANCHES` / `SHARE_BAR` verdict in multi-remote clones. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
