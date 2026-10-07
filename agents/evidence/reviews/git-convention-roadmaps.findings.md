# Findings: git-convention-roadmaps
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: d44d76bb57c1f3a8ca0e9847ac53f5fc5ae82080713f30e6ca896d01f5ee39a8 | diff: 0439815f763a8ef4aee8657dc4859053a3a85cec | reviewer: r2-fresh-subagent-git-convention-roadmaps | prompt_hash: 839b5cad918f83ad7b1cee4fcfd321f50b80c285479a99dc07428903b71f2618 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-roadmaps"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 0439815f763a8ef4aee8657dc4859053a3a85cec
  scope_hash: d44d76bb57c1f3a8ca0e9847ac53f5fc5ae82080713f30e6ca896d01f5ee39a8
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T09:03:23Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:901 | `main` now reads `git.update_strategy` (via `readCommittedConvention` -> `remoteSha`, an `ls-remote`) before `sync` runs. When origin is unreachable the target SHA is null, the reading is `unresolvable`, and the script exits 4 with "Nothing was checked or merged", even in a repository with no `.git-convention.yml` and no developer value. Before this change the same offline run of a PR against the default branch reached `sync`, failed the fetch and exited 0 with the loud `unverified` warning. So the `unverified` path that `/pr:merge` section 2 and `branch-update.md` still document is now almost unreachable, an offline pre-push sync goes from warn to hard refusal, and the JSDoc at :822 ("Absent everywhere reads as `merge`") is false whenever the network is down. | open | |
| 2 | medium | src/skills/git-workflow/references/branch-update.md:146 | The rebase sequence's four fenced blocks share shell state: `REMOTE`, `RB`, `EXPECTED`, `SAVE`, the `stop`/`keep` functions, and `BASE`, which the page never tells the reader to set (it appears only as `${BASE:-}` at :117). The test harness (`tests/_lib/rebase_sequence.ts`) concatenates the blocks into one `bash -c` and injects `BASE` through the environment, so it cannot see the problem. An agent that runs the blocks as separate tool calls, or leaves `BASE` unset, gets this: `git fetch -q origin ""` fails without a check, `git rev-list --merges "origin/..HEAD"` errors to empty output so the merge-commit stop passes silently, and later blocks call an undefined `keep` and pass an empty `SAVE` to `git update-ref -d`. The page should state the required inputs (`BASE`) and that all blocks must run in one shell. | open | |
| 3 | medium | src/domains/git/pr/merge/command.md:174 | The classic-protection probe uses `--jq .required_status_checks.strict`. On a branch that is protected but has no required status checks (reviews only, for example), that prints `null` with exit 0. The outcome table classes "output that is not `true` / `false`" as Failed, and a failed read "is treated as required", so such a PR is wrongly left `blocked-external` ("requires an up-to-date branch") even though the forge requires nothing. `null` from a 200 response should be read as Absent. | open | |
| 4 | low | src/domains/git/pr/merge/command.md:176 | The rulesets probe `.[] \| select(.type == "required_status_checks") \| ...` prints one line per matching rule. A branch covered by more than one ruleset can therefore return `false\ntrue` (or `true\ntrue`), and the three-outcome table has no case for multi-line output: it is neither a single `true`/`false` value nor empty. The read needs to be reduced to one value (for example `any`), or the table needs to say how to read several lines. | open | |
| 5 | low | src/scripts/_cli/cmd_git_convention.ts:295 | With `--json`, `subject` still returns the plain-text `stop` lines on stdout for every stop plan: exit 3 for a commitlint config or a declaration disagreement, and exit 1 for an unknown format, an unknown family or an unreadable format. A caller that asked for JSON and parses stdout gets a parse error instead of the reason. `show`, `ticket` and `branch` keep `--json` output machine-readable. | open | |
| 6 | low | src/scripts/_cli/cmd_git_convention.ts:229 | `_commitlintRejectsTicketLead` uses raw substring checks on the config text (`includes('config-conventional') && !includes('headerPattern')`). A `headerPattern` that appears only in a comment, or a preset name mentioned in a comment, flips the verdict. Exit 3 ("the two disagree") versus the plain "run commitlint" exit 3 therefore depends on comments and formatting, not on the effective config. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
