# Worktree inventory — baseline pass

> Produced by `worktree_cleanup_check inventory` (the `road-to-worktree-hygiene`
> roadmap's Phase 1). Recorded so a later pass can tell **growth** from
> **residue** rather than re-deriving the same numbers. Nothing was removed:
> bulk worktree + branch deletion is a Hard-Floor action
> (`non-destructive-by-default`) and needs the maintainer's explicit
> this-turn approval.

## Why the roadmap's promotion trigger fired

The draft's own trigger: *"Promote when the count materially affects clone size,
disk, or a tool that walks worktrees — or simply when a maintainer wants the
list."*

| Signal | At filing | This pass (2026-08-05) |
|---|---:|---:|
| Registered worktrees | 209 | **249** |
| Disk under `.claude/worktrees/` | not measured | **40 GB** |
| Local branches | not measured | **692** |
| Registrations `git worktree prune` would clear | — | **0** |

Disk is the leg that fired: 40 GB is material, and the count grew by 40 in the
five days between filing and this pass. `prune` clearing nothing confirms the
roadmap's premise — every registration points at a real directory, so there is
no cheap cleanup path.

## Classification

Repo: this checkout · trunk: `refs/remotes/origin/main` · 249 registered.

| Class | Count |
|---|---:|
| safe | 143 |
| review | 78 |
| live | 28 |

`safe` requires **all** of: on a branch · merged into the trunk · clean
(including untracked) · inside a conventional worktree root · no git activity
for 48 h.

### Review set, by primary disqualifier

| Count | Reason |
|---:|---|
| 63 | non-standard location — outside the conventional worktree roots |
| 9 | unsaved work (7 × 1 path, 1 × 2 paths, 1 × 6 paths) |
| 4 | branch is not an ancestor of `refs/remotes/origin/main` — unmerged work |
| 2 | detached HEAD — no branch to judge reachability for |

The 63 non-standard-location entries are the largest single finding and are
**deliberately excluded from the safe set**: they sit beside the repo in the
parent package directory, where a worktree can be mistaken for a sibling
package. Removing them is a judgement call about the layout convention, not a
mechanical cleanup, so they stay for the maintainer.

The 4 unmerged branches are exactly the case the roadmap warns about — a
cherry-pick gives the same content a different SHA, so `rev-list --count` alone
proves nothing. The inventory does not guess: it reports them as review and
leaves the content check to a human.

## Honest limits of these numbers

- **The `live` count is transient and partly self-inflicted.** Liveness is read
  from per-worktree git-dir mtime. Two inventory runs made during this session's
  development — before the `--no-optional-locks` fix landed — refreshed the
  index in worktrees they touched, moving 10 of them from `safe` to `live`
  (151/80/18 → 143/78/28). The classification is stable across runs now, and
  the inflation decays on its own once the 48 h window passes. The **structural**
  figures (total, location, merge status, dirty, detached) are unaffected.
- **Liveness is a heuristic, not a lock.** A session that has a worktree open but
  has run no git command in 48 h reads as quiet. That is why the safe set is a
  proposal for review, never an automatic action.
- **Disk is measured for one root only** (`.claude/worktrees/`), not for the 63
  entries outside it, so 40 GB is a floor.

## Next pass

Re-run `worktree_cleanup_check inventory` and compare against the table above:
a rising **total** with a flat review set is growth; a flat total with the same
review reasons is residue. The review set should shrink as its named reasons are
resolved, so the next pass starts from a shorter list rather than the same 249.
