---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Working with git history — never rewrite, rebase, squash, fixup, or amend without explicit user request; the linear/squashed shape is the user's call, not a tidiness reflex"
source: package
triggers:
  - intent: "rebase the branch"
  - intent: "squash commits"
  - intent: "clean up commit history"
  - intent: "fold this into the previous commit"
  - keyword: "git rebase"
  - keyword: "fixup"
  - keyword: "--amend"
  - keyword: "force-push"
  - keyword: "squash-merge"
---

# No Unsolicited Rebase

## Iron Law

```
NEVER REBASE, SQUASH, FIXUP, OR AMEND PUBLISHED OR LOCAL HISTORY
WITHOUT THE USER ASKING FOR IT THIS TURN.
LINEAR HISTORY IS A PREFERENCE, NOT A DEFAULT.
COMMIT-CHUNK ORDER IS NOT A CORRECTNESS GOAL.
```

Add the next commit on top. Never reorder, fold, drop, or rewrite earlier
commits to make the log "look right".

## Why this rule exists

Interactive rebase + fixup loops generate disproportionate token cost on
every iteration: re-running CI per replayed commit, resolving the same
content conflict in three derived files (`.compression-hashes.json`,
`router.json`, `.windsurfrules`), losing the working tree to a stash that
silently re-introduces older state. A single conflict can burn the budget
of an entire feature. The user pays for it. The "clean history" payoff is
cosmetic; reviewers read the diff, not the log.

## When rebase / amend / fixup IS allowed

Exactly three:

1. **User says so this turn** — "rebase onto main", "squash these two",
   "amend that". This operation only, not a standing rule.
2. **Standing instruction not yet revoked** — the user said earlier in
   the conversation "always squash before pushing"; honor it.
3. **Conflict resolution forced by `git pull --rebase`** — the user
   already invoked the rebase via pull; finish it.

Anything else — chunk-tidiness, "logical order", folding a follow-up fix
into its parent — **forbidden**. The follow-up ships as its own commit
(`fix: …`, `chore: …`).

## Equivalents that are also forbidden by default

- `git rebase -i` (interactive)
- `git rebase --autosquash`
- `git commit --fixup` / `--squash` (the helper that feeds the autosquash)
- `git commit --amend` on already-pushed commits
- `git push --force` / `--force-with-lease`
- `git reset --hard` past unpushed work the user might want
- Squash-merge of a PR via API or CLI when the user has not picked the
  merge strategy
- Cherry-pick rewriting that drops or reorders commits

`--amend` on the *current local* commit before the first push is the
narrow exception (treated as continuing to compose the commit, not
rewriting history).

## When you'd be tempted

- "I want commit 3 to come before commit 2 because the topic flows better."
  → don't. Reviewers read the PR diff.
- "There are two `chore: regenerate` commits, ugly." → don't. They are
  honest checkpoints.
- "A linter caught an issue in commit 2 — let me fold the fix in."
  → don't. Add `fix(scope): …` on top.
- "I want to drop the WIP commit before pushing." → ask the user first.
- "Squash-merge when I open the PR will clean it anyway." → also true,
  also irrelevant — let the merge strategy do that work, not you.

## Failure mode catalog

- **Rebase-conflict cascade.** Interactive rebase replays N commits. Any
  derived file (`.compression-hashes.json`, generated tool projections,
  index/catalog) carries a hash per commit and conflicts on every replay.
  Resolution time scales with N, not with the actual change.
- **Stash-pop reverts work.** A `git stash` issued during rebase recovery
  can re-introduce older edits that overwrite committed work after the
  rebase finishes. Hard to spot in `git status` because the file shapes
  match.
- **Force-push during review.** Rewriting history on a branch with an
  open PR invalidates review comments anchored to commits and forces a
  re-review.

## See also

- [`scope-control`](scope-control.md) — git-ops permission gate ("rebase"
  already named in the canonical list).
- [`commit-policy`](commit-policy.md) — commits are the user's call;
  rewriting them is a stronger version of the same restriction.
- [`token-efficiency`](token-efficiency.md) — Iron Law on burning the
  user's tokens for cosmetic gain.
