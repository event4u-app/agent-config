# Findings: git-convention-roadmaps
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 18a66eb1df422523a5fb62e79f7c299e41d7529ae9b6dce9f36cdf6be7603d9c | diff: a67ef8d4c09a31809a49027dce28c0d91d2cadc9 | reviewer: r2-fresh-subagent-git-convention-roadmaps | prompt_hash: 8bcf0e83cf0ceab46af146d0e09786a69406cfb5ed36bc3110afc5264cf3d4d3 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-roadmaps"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: a67ef8d4c09a31809a49027dce28c0d91d2cadc9
  scope_hash: 18a66eb1df422523a5fb62e79f7c299e41d7529ae9b6dce9f36cdf6be7603d9c
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T09:40:06Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/domains/git/pr/merge/command.md:144 | § 2 runs `agent-config git:convention show` BEFORE `gh pr checkout <N>` and without `--base`, while the sync two lines later passes `--base origin/<base>`. `show` resolves its target from the branch checked out at that moment (`gh pr list --head <current>`), so the stop/go read of `git.update_strategy` (and its exit-1 refusal) is taken against the previous branch's PR base or the default branch, not PR N's base. For a PR into a release/stacked base whose carrier differs, the gate can pass or stop on a different target than the one `sync` then acts on. Run `show --base origin/<base>` after the checkout (same in the dist projection). | fixed | fixed in 8956675718a0 |
| 2 | medium | src/scripts/_lib/git_convention_carrier.ts:153 | `prBase` returns null for every `gh` failure (not installed, unauthenticated, network/timeout) exactly as for "no open PR", so `resolveTarget` silently falls through to the default branch and `update_strategy` is read from the carrier at the default branch with state `valid`. For a PR targeting a non-default base this is the silent fallback the module header rules out ("never the default"); `check_branch_freshness` reports the same forge failure as `unverified`, the carrier path does not distinguish it at all. | fixed | fixed in a8e19836e0f0 |
| 3 | low | src/scripts/_cli/cmd_git_convention.ts:292 | `_commitlintProposal` takes `commitMessageValidator(cwd)` = `validators[0]`, and `commitMessageValidators` pushes the `commit-msg` hook first. In the common husky setup (a `commit-msg` hook that runs commitlint plus a commitlint config) the first entry is the hook, so `v.kind !== 'commitlint config'` and the `ticket_keys` proposal from `issuePrefixes` is never offered. Should search the list for the commitlint entry. | fixed | fixed in e742e42abdc2 |
| 4 | low | src/scripts/_lib/git_convention_carrier.ts:314 | `commit_format` and `branch_pattern` are read from the carrier at `HEAD`, above every developer layer. The class-C fence for these keys is the path-based `block_config_weakening` guard, which only sees a file path a tool call names; a carrier written via Bash and committed on the branch overrides the developer's class-C value from the next read on, so the "agent cannot set it" property of class C is bypassable by a branch commit (unlike `update_strategy`, read at the target). | accepted-risk | pre-existing for every class-C file: block_config_weakening fences tool writes by path and does not see a Bash write or a commit; the carrier inherits that boundary rather than introducing it, and closing it is a hook change with its own ratification, outside this branch. Accepted by: implementing agent |
| 5 | low | src/scripts/sync_pr_branch.ts:863 | `strategyGate` runs its probe `sync(repo, base, true, false, targetDeps)` from `main` at line 942, outside the `try/catch` that maps an unexpected throw to exit 2 with the `internal error` line and a `reportScanned` record. Any throw in that probe path escapes as an uncaught exception instead of the documented exit-2 contract. | fixed | fixed in ad864ac974c2 |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
