# Findings: git-convention-roadmaps
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: aaac7f5f216978758bfeba018d85de99a181e9e39ebfe256f9e7490d4135e3c2 | diff: ffdd8a710c6e56f2198f73c8d7a1fe16bc52c362 | reviewer: r2-fresh-subagent-git-convention-roadmaps | prompt_hash: 1a39f2022f602691501ff6e3de990ee5ccb213fa6fd1a0b441a5a5464ca7231a -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-roadmaps"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ffdd8a710c6e56f2198f73c8d7a1fe16bc52c362
  scope_hash: aaac7f5f216978758bfeba018d85de99a181e9e39ebfe256f9e7490d4135e3c2
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T09:18:50Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:921 | An unresolvable base now exits 4, not 1, which makes the documented exit-1 contract unreachable. With no open PR and no default branch, or an unresolvable target SHA, `readCommittedConvention` marks `update_strategy` `unresolvable`. The probe `sync()` then returns the "cannot resolve a base set" refusal, which does not start with `unverified`, and the line-927 `isRefusal` branch exits 4 with a `git-convention-unresolvable` reason. That contradicts the exit table in the header (`1` = base could not be resolved), the `cmd_git_convention.ts` docstring ("`1` conflict or no base") and `/pr:merge` § 2 ("exit `1` → … a base that could not be resolved stops this PR"). A caller that branches on the exit code reads a base failure as an unreadable strategy, and the convention reason names the wrong root cause. | fixed | fixed in 99eb78a5b946 |
| 2 | medium | src/scripts/_cli/cmd_git_convention.ts:284 | `_planSubject` exits 3 whenever a commitlint config exists, including when `_commitlintRejectsTicketLead` returns `false` (the config is compatible) or `commit_format` is the default. In such a repository `subject` can never exit 0. `/commit:in-chunks` § 4 (src/domains/git/commit/in-chunks/command.md:90) treats exit `3` as "stop and hand back", so the autonomous chunked-commit flow always halts in every repository that has a commitlint config and no installed hook, even for valid subjects. Before this change it validated with a regex and proceeded. | fixed | fixed in 3e8c6a0db473 |
| 3 | medium | src/scripts/_cli/cmd_git_convention.ts:112 | `commitMessageValidator` returns the `commit-msg` hook before it looks for a commitlint config. In the usual husky + commitlint setup the validator is therefore the hook, `_planSubject` validates against `git.commit_format` with only a note, and the config-conventional vs `ticket-conventional` disagreement check (`_commitlintRejectsTicketLead`) never runs. A committed `ticket-conventional` then passes `subject` with exit 0, and the hook rejects the commit. The disagreement is detected only when commitlint is NOT wired as a hook, which is the inverse of where it bites. | fixed | fixed in 3e8c6a0db473 |
| 4 | low | src/scripts/_cli/cmd_git_convention.ts:144 | `show` exits 1 when only a candidate (this checkout's working-tree `.git-convention.yml` or developer value) is in a refusal state, even though the value in force is valid. `sync` reads only the in-force value and proceeds. `/pr:merge` § 2 runs `show` first and says a refusal state makes "`show` exit `1` … and the script refuses it with exit 4", so an uncommitted broken carrier edit (or a malformed `commit_format` candidate, which is irrelevant to the sync) makes the merge flow stop on a PR that `sync` would have handled. | fixed | fixed in 1d3c055c3b4e |
| 5 | low | src/skills/git-workflow/references/branch-update.md:135 | The step 2 prose names three stops that come "before anything is rewritten", the third being commits on the branch you did not author. The `rebase-sequence: rebase` script enforces only the dirty tree and the merge commit. The authorship stop has no code, so an agent running the four blocks as "one script" gets no stop for inherited commits. | fixed | fixed in 49aff1ade648 |
| 6 | low | src/skills/git-workflow/references/branch-update.md:166 | The exit status of `git fetch -q "$REMOTE" "refs/heads/$RB"` is not checked. When the fetch fails (network, auth), the next line `git merge-base --is-ancestor "$EXPECTED" HEAD` fails because the object is missing and stops with "$REMOTE/$RB has commits this branch lacks". That is safe but names the wrong cause; the `origin $BASE` fetch two lines earlier is guarded with its own message. | fixed | fixed in 8d4fdf030bc2 |
