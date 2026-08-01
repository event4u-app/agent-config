---
complexity: contained
status: draft
---

# Road to worktree hygiene — 209 worktrees, one prune, no inventory

> Planned, not scheduled, and deliberately kept out of the session that found it.
> A bulk branch/worktree sweep is exactly the kind of work that must not ride
> along on an unrelated change.

## The finding

`git worktree list` reports **209** entries in this checkout. They accumulate one
per feature branch and are never removed on merge; `git worktree prune` only
clears registrations whose directory is already gone, so it does nothing for the
real ones. Disk cost aside, the practical cost is that a stale worktree is a
second copy of the repo that can hold an old `.agent-settings.yml`, a stale
`node_modules` symlink, or a branch that looks alive in `git branch` long after
its PR merged.

Nothing here is broken. This is hygiene, and it is filed so the number does not
quietly become 400.

## Why it is not a one-liner

Every removal is a deletion, and deletions in this repo carry a verification
duty, not just a permission gate:

- A worktree's branch may hold commits that never reached `main` — a cherry-pick
  gives the same content a different SHA, so `git rev-list --count main..branch`
  alone proves nothing. Content has to be checked, as it was for the four
  branches removed on 2026-07-31.
- A worktree may hold **uncommitted** work. `git status --porcelain` per worktree
  is the floor before any removal.
- Some worktrees belong to concurrent sessions. A sweep run while another agent
  or terminal is working in one destroys live state.

## What a pass would do

- [ ] Inventory: per worktree — path, branch, dirty?, commits not on `main`,
      whether that content is reachable on `main` anyway, PR state if any.
- [ ] Classify: **safe** (clean, merged, content on `main`) · **review**
      (unique commits or dirty) · **live** (another session's).
- [ ] Present the safe set as a list and remove **only after explicit approval** —
      per `scope-control`, branch and worktree deletion is permission-gated, and
      a bulk sweep does not inherit a single earlier approval.
- [ ] Leave the review set untouched with its reason recorded, so the next pass
      starts from a shorter list rather than the same 209.
- [ ] Record whatever count remains, so a later pass can tell growth from
      residue.

## Non-goals

- **No automatic pruning on merge.** A hook that deletes worktrees is exactly the
  wrong place for irreversible cleanup; the sweep stays deliberate and reviewed.
- **Not a git-hygiene framework.** One inventory script and a reviewed list.

## Why `draft`

Nothing is failing. Promote when the count materially affects clone size, disk,
or a tool that walks worktrees — or simply when a maintainer wants the list.
