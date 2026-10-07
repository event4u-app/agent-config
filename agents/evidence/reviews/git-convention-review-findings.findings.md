# Findings: git-convention-review-findings
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 5cd79c73b0e461f5348facaf44c0106ca426a4036a7c37f6e7e21c1a7cab7758 | diff: 5840b15678d21191488f53824a04c425324700ad | reviewer: r2-fresh-subagent-git-convention-review-findings | prompt_hash: b78de1891bec9118b72a5e8e89e484b5bd19ace000dbac872c18c71db1bfe478 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-review-findings"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 5840b15678d21191488f53824a04c425324700ad
  scope_hash: 5cd79c73b0e461f5348facaf44c0106ca426a4036a7c37f6e7e21c1a7cab7758
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T14:23:37Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:797 | The memoized target deps do not reach the merge. `main` reads `git.update_strategy` at the target SHA through `memoTargetDeps`, and the comment on `memoTargetDeps` says it exists so one run cannot "judge the strategy against one commit and sync against another when the target moves in between". But `sync()` counts behind against the freshly fetched tracking refs (`countBehind('HEAD', ref)`, line 744ff), and `integrateWithPinnedBase` pins its merges via a new, un-memoized `makeGitDeps(repo).remoteSha`, which also ignores the injected `deps` parameter. If the target advances between the strategy read and the merge, the run merges a target commit whose carrier was never read. That is the gap the memo claims to close, and tests that inject `deps` cannot see it. | open | |
| 2 | low | src/scripts/sync_pr_branch.ts:887 | `strategyExit` returns exit 4 when the target reading is `unresolvable` and the developer layer is also a refusal. The printed line is `describeRefusal(reading)`, which names the unresolvable target, not the malformed, invalid or discarded developer file that actually produced exit 4. The reader is told the base could not be resolved and is never pointed at the file to fix. | open | |
| 3 | low | src/scripts/_lib/git_convention_measure.ts:256 | `_trunk` resolves the default branch from the local `refs/remotes/origin/HEAD` only. `parseSymrefDefault` in git_convention_carrier.ts documents this exact source as a measured defect (absent in some checkouts, worktrees among them). Here it falls back silently to `origin/main` or `origin/master`, else to `HEAD`. In a repository whose default branch is something else, or in a worktree on a topic branch, `measure` samples the wrong history and proposes a convention from it without saying so. | open | |
| 4 | low | src/scripts/_lib/git_convention_carrier.ts:103 | `resolveTarget` treats an explicit `--base` that `parseBaseRef` maps to null (empty or whitespace-only, git_base_ref.ts:35) as no override. It falls through to the default branch with reason `repository-default-branch`. A caller that passed a blank `--base` (for example an unset `origin/$BASE` expansion) gets update_strategy read at the default branch and the sync run against it, with no error. | open | |
| 5 | low | src/scripts/_cli/cmd_git_convention.ts:139 | `commitMessageValidators` locates the commit-msg hook with `git rev-parse --path-format=absolute`, which needs git 2.31 or later. On an older git the call fails, `_git` returns null, and `show` prints "commit-message validator: none in this repository" while a hook does run at commit. The doc's "named, never inferred" promise silently becomes a false negative. | open | |
| 6 | low | src/scripts/_cli/cmd_git_convention.ts:521 | `_stdin` skips reading only when stdin is a TTY. Any other stdin that is never closed makes `git:convention subject` wait forever instead of reporting `NO_SUBJECTS`: an agent shell or CI step that runs the verb without piping or redirecting input, with an inherited open pipe. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
