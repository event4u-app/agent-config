# Findings: git-convention-review-findings
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 49a6c2fdc733f9d2ef0bc99a5897adb39ec03432f3c07ce564564afa5e78fb2f | diff: b6107dd95c93c32c0c349d83584f23d2c38436d4 | reviewer: r2-fresh-subagent-git-convention-review-findings | prompt_hash: fe7779fb7b867f5a96de836b0e026a01570101f30e3c7020ce9b6ee043a2c63e -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-review-findings"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: b6107dd95c93c32c0c349d83584f23d2c38436d4
  scope_hash: 49a6c2fdc733f9d2ef0bc99a5897adb39ec03432f3c07ce564564afa5e78fb2f
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T18:09:49Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:614 | The policy re-read at the pinned commit (`checkPin`) runs only on attempt 1. When the target moves during that attempt, attempts 2-3 re-pin and merge the newer commit without re-reading `git.update_strategy` there, so a commit whose carrier switched to `rebase` can still be merged. That breaks the invariant `policyMovedStop` states: never merge under a policy the integrated commit no longer carries. | open | |
| 2 | medium | src/scripts/_cli/cmd_git_convention.ts:540 | `init` looks for an existing carrier only in the working tree. Readers resolve the declaration at the default branch's commit. On a branch cut before the carrier landed, `init --yes` creates a second, divergent `.git-convention.yml` that only shows up later as a merge conflict or a silent override. This contradicts ADR-283 § Creation ("never overwrites"). | open | |
| 3 | medium | src/scripts/_lib/git_convention_grammar.ts:153 | The ticketless form for `ticket-prefix` is `^\S.*`. It accepts nearly every subject (`wip`, `fix stuff.`), so an approved `ticket-prefix` card stops validating the subject's shape. A malformed lead such as `DEV-1- fix` also fails the grammar, falls into this path and gets the wrong diagnosis "stands outside the leading position", although the ticket does lead. | open | |
| 4 | medium | src/scripts/_lib/git_convention_measure.ts:327 | `readHistory` collects branch names from every remote under `refs/remotes`, and excludes only the trunk remote's default branch. In a fork layout each branch is counted once per remote, and `upstream/main`/`upstream/HEAD`-style defaults of other remotes are counted as `other`. Both skew the share `measureBranches` compares against the 80 % bar, so the proposed `branch_pattern` can be wrong or missing. | open | |
| 5 | low | src/scripts/_lib/git_convention_grammar.ts:154 | `TICKETLESS_FORM['ticket-conventional']` is `FAMILY_ERE[0]`, which assumes by position that the first family is `conventional`. Reordering `FAMILY_ERE` would silently swap the ticketless grammar. Look it up by name instead. | open | |
| 6 | low | src/scripts/_cli/cmd_git_convention.ts:465 | `measure --family F` with a family absent from the sample writes a card with `dominant_share: 0.00`. The card also pairs `observed_n` (uncapped eligible count) with a share computed over the per-author-capped sample, so the two figures describe different samples. | open | |
| 7 | low | src/scripts/_cli/cmd_git_convention.ts:495 | The `measure` text says "already established — a declaration or an approved card is in force", but `_established` also returns true for a commitlint config alone. The message misstates why. | open | |
| 8 | low | src/scripts/_dispatch.bash:314 | The per-verb synopsis list adds `measure` but omits `init`, although the prose above it and the CLI USAGE both document `init --yes`. | open | |
| 9 | low | src/server/gitKeysGate.ts:119 | `refuseGitKeys` parses the template raw, while the settings route runs `substituteTemplatePlaceholders` before `parseYaml`. On any read or parse failure it silently falls back to empty defaults. A user-global finish then gets a 422 for every posted `git.*` value (template defaults included), with no hint of the real cause. | open | |
| 10 | low | src/scripts/_cli/cmd_git_convention.ts:278 | `_cardFamily` now matches an indented `dominant_family:` on any line of the card, body text included, not just the frontmatter key. A quoted or nested mention can be read as the approved family. | open | |
