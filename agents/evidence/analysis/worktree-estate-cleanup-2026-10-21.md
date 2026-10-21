<!-- evidence-type: analysis -->

# Worktree estate before and after the first removal pass — 2026-10-21

> Measured by `worktree_cleanup_check` on this repository's main checkout, on
> 2026-10-21, for `road-to-worktrees-that-leave-after-the-merge` step 4.3. The
> trunk ref passed was this run's branch (`--trunk=refs/heads/feat/advisories-fixes-worktree-cleanup`),
> which contains `origin/main` whole plus the `.gitignore` declarations this
> change adds; every merge proof against it is therefore also a proof against
> `origin/main`. Merge evidence came from one `gh pr list` call.

## Counts

| Reading | Registered | safe | review | live |
|---|---:|---:|---:|---:|
| inventory before `apply` | 71 | 17 | 26 | 28 |
| `apply` | — | 17 removed, 0 refused | — | — |
| inventory after `apply` | 54 | 0 | 26 | 28 |

All 17 removals were `merged-pr` (squash-merged PR, branch tip equal to the PR
head) and all sat beside the checkout as `../agent-config-*`. Before this
change every one of them classed `review: unmerged work`. Two were checked by
hand before the pass: clean status, PR `MERGED`, head equal to the local tip.
No branch was deleted; the removal journal in the common git dir carries each
tip SHA.

The owner's "~250" is not this machine's current figure: a read-only count of
every git repository under the owner's project root finds 54 here after the
pass, 3 in one sibling project and 2 in another. The session register knows no
other repository.

## What stayed, and why

| Reason (primary) | Trees |
|---|---:|
| branch is not an ancestor of refs/heads/feat/advisories-fixes-worktree-cleanup — unmerged work | 14 |
| unsaved work — 1 dirty or untracked path(s) | 3 |
| unsaved work — 4 dirty or untracked path(s) | 2 |
| local-only files — 1 ignored path(s) a rebuild would not restore: agents/state/ | 1 |
| non-standard location — outside the conventional worktree roots | 1 |
| local-only files — 2 ignored path(s) a rebuild would not restore: agents/tmp.old/, agents/tmp/ | 1 |
| local-only files — 4 ignored path(s) a rebuild would not restore: agents/reports/neighbour-overlap.json, agents/reports/ | 1 |
| unsaved work — 10 dirty or untracked path(s) | 1 |
| unsaved work — 5 dirty or untracked path(s) | 1 |
| unsaved work — 9 dirty or untracked path(s) | 1 |
| live — a registered session or git activity within 48 h | 28 |

The 26 `review` trees are each kept for a reason the gate names: work that is
not on the trunk, uncommitted changes, or an ignored file a rebuild would not
restore (`agents/state/`, inbox files, a local report). The 28 `live` trees are
in use or were touched in the last two days; the daily pass reaches them once
they go quiet.
