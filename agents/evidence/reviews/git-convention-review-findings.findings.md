# Findings: git-convention-review-findings
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 6e19fcf5e7d196b053b69955748071ddb454ad59642cc7684c0eb66c9c4cc91e | diff: 6f54d873a4b9043369810ad7fc379452d6742d8a | reviewer: r2-fresh-subagent-git-convention-review-findings | prompt_hash: 76311d79acafafbd8cce3b3f129530412384c3e4eaccbc192a2278699b3e6fe3 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-review-findings"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 6f54d873a4b9043369810ad7fc379452d6742d8a
  scope_hash: 6e19fcf5e7d196b053b69955748071ddb454ad59642cc7684c0eb66c9c4cc91e
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T15:23:21Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:581 | `checkPin` runs at the top of EVERY attempt of `integrateWithPinnedBase`, but merges happen inside the loop: on attempt 1 the stale refs are merged, the base moves, and on attempt 2 `checkPin` (main, line 1055) compares the new pin with the strategy-read SHA, re-reads the carrier and, if the strategy changed, returns `policyMovedStop`, whose text (line 939) says "nothing was merged". HEAD already carries attempt 1's merge, so the exit-1 line misreports the tree state and leaves a merge commit the caller was told does not exist. Either check only before the first merge, or word the stop by attempt (and name the merge already made). | open | |
| 2 | low | src/scripts/sync_pr_branch.ts:743 | The fetch set always contains `origin`, even when every ref in the integration order lives on another remote (`--base upstream/x`). A repo with no `origin`, or with `origin` unreachable while the target remote answers, gets `unverified — could not fetch origin` (exit 0, nothing checked), although the target was resolved and its remote is fetchable. The header comment says "no origin" is exit 1. Also `.map(...).find(...)` runs every fetch even after the first one failed. | open | |
| 3 | low | src/scripts/sync_pr_branch.ts:909 | `strategyGate` now runs before `sync()`. Offline with no `--base`, `defaultBranch` falls back to the local `origin/HEAD`, `remoteSha` returns null, and the run exits 1 with "base could not be resolved", even when no carrier exists and the developer layer or default is `merge`. `sync()`'s own `unverified — could not fetch` exit-0 path for the same offline condition can now be reached only when `ls-remote` succeeds and the fetch fails. The two classifications of "server unreachable" now contradict each other, and the exit-1 reason names the base rather than the network. | open | |
| 4 | low | src/scripts/check_branch_freshness.ts:711 | The behind remedy always prints `task push-ready BASE=…`. That target exists only in this package's `taskfiles/dev.yml`, but consumers run this script via `npx tsx node_modules/@event4u/agent-config/src/scripts/check_branch_freshness.ts` (`/pr:create` § 1b). Before this change they got a runnable `git fetch && git merge` line. Under a non-merge strategy, or when the strategy is not read, the nonexistent task is now the only concrete command printed. | open | |
| 5 | low | src/scripts/_cli/cmd_git_convention.ts:190 | `show` with no `--key` always resolves `update_strategy`: an `ls-remote` and, for a commit not yet fetched, a fetch that can take up to 60 s (`CARRIER_FETCH_TIMEOUT_MS`). A caller that only needs a local key, such as `commit_format` at HEAD, still pays the network cost and still gets exit 1 offline (`unresolvable`). `show` also accepts only `--base REF`, never `--base=REF`, which `check_branch_freshness` does accept, so the same flag spelling succeeds in one tool and is a usage error in the other. | open | |
| 6 | low | src/scripts/_lib/git_convention_measure.ts:296 | `readHistory` collects branch names from every remote under `refs/remotes`, so a branch present on both `origin` and `upstream` (or a fork) is counted twice. This inflates `sampled` toward `MIN_BRANCHES` and skews shares. `measureUpdateStyle` (line 220) recognises only `origin/` in base-merge subjects, so a default branch resolved on another remote is read as `linear`. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
