---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Git history ops — never rebase/squash/amend without explicit request; once pushed, rewrites must pair with immediate re-push same turn"
source: package
triggers:
  - intent: "rebase the branch"
  - intent: "squash commits"
  - intent: "clean up commit history"
  - intent: "fold this into the previous commit"
  - intent: "tidy history after pushing"
  - keyword: "git rebase"
  - keyword: "fixup"
  - keyword: "--amend"
  - keyword: "force-push"
  - keyword: "--force-with-lease"
  - keyword: "squash-merge"
  - phrase: "branch diverged"
  - phrase: "pull --rebase failed"
  - phrase: "ahead and behind"
routes_to:
  - "skill:git-workflow"
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Git History Discipline

## Iron Law — Gate (no unsolicited rewrites)

```
NEVER REBASE, SQUASH, FIXUP, OR AMEND PUBLISHED OR LOCAL HISTORY
WITHOUT THE USER ASKING FOR IT THIS TURN.
LINEAR HISTORY IS A PREFERENCE, NOT A DEFAULT.
COMMIT-CHUNK ORDER IS NOT A CORRECTNESS GOAL.
```

Add the next commit on top. Never reorder, fold, drop, or rewrite earlier
commits to make the log "look right".

## Iron Law — Protocol (once authorized)

```
ONCE PUSHED, A COMMIT IS PUBLISHED.
ANY REWRITE OF PUSHED HISTORY MUST PAIR WITH AN IMMEDIATE RE-PUSH
IN THE SAME TURN — OR DON'T REWRITE.
NEVER END A SESSION WITH REWRITTEN-BUT-UNPUSHED LOCAL HISTORY.
```

## When rewrite is allowed

Exactly three:

1. **User says so this turn** — "rebase onto main", "squash these two", "amend that". This operation only, not a standing rule.
2. **Standing instruction not yet revoked** — the user said earlier in the conversation "always squash before pushing"; honor it.
3. **Conflict resolution forced by `git pull --rebase`** — the user already invoked the rebase via pull; finish it.

Anything else — chunk-tidiness, "logical order", folding a follow-up fix into its parent — **forbidden**. The follow-up ships as its own commit (`fix: …`, `chore: …`).

## Two protective stops (for the protocol phase)

1. **Pre-rewrite stop.** Before any squash / amend / rebase on a branch that is on origin: `git fetch && git rev-list --left-right --count HEAD...@{u}`. If **either** side is non-zero — STOP and route to `skill:git-workflow § Divergent-State Recovery`. A blind `git pull --rebase` in this state is the documented failure mode.

2. **Post-rewrite stop.** After the rewrite, push in the **same turn** with `--force-with-lease=<branch>:<fetched-sha>` and verify `git rev-parse origin/<branch>` equals `git rev-parse HEAD`. If the push fails (hook, network, token budget) — fix the cause and re-push **before** ending the session, committing new work, or handing off.

If either stop fires and resolution is not immediate → tag the state (`git tag local-rewritten-tip-<ISO-date>`) and hand control back to the user. Do not let a new session inherit a dirty divergence.

## Equivalents that are also forbidden by default

- `git rebase -i` (interactive)
- `git rebase --autosquash`
- `git commit --fixup` / `--squash` (helpers that feed autosquash)
- `git commit --amend` on already-pushed commits
- `git push --force` / `--force-with-lease` (unless paired with the protocol)
- `git reset --hard` past unpushed work the user might want
- Squash-merge of a PR via API or CLI when the user has not picked the merge strategy
- Cherry-pick rewriting that drops or reorders commits

`--amend` on the *current local* commit before the first push is the narrow exception (treated as continuing to compose the commit, not rewriting history).

## Why this rule exists

Interactive rebase + fixup loops generate disproportionate token cost on every iteration: re-running CI per replayed commit, resolving the same content conflict in three derived files (`.condensation-hashes.json`, `dist/router.json`, `.windsurfrules`), losing the working tree to a stash that silently re-introduces older state. A single conflict can burn the budget of an entire feature.

A previous session squashed a pushed branch, the push hook failed at the token boundary, the session ended — and the next session saw local and origin pointing at different SHAs for the same logical work. A blind `git pull --rebase` cascaded into conflicts across every derived file. Recovery required forensic SHA-archaeology. The pre/post-rewrite stops make that sequence structurally impossible.

## When you'd be tempted

- "I want commit 3 to come before commit 2 because the topic flows better." → don't. Reviewers read the PR diff.
- "There are two `chore: regenerate` commits, ugly." → don't. They are honest checkpoints.
- "A linter caught an issue in commit 2 — let me fold the fix in." → don't. Add `fix(scope): …` on top.
- "I want to drop the WIP commit before pushing." → ask the user first.
- "Squash-merge when I open the PR will clean it anyway." → also true, also irrelevant — let the merge strategy do that work, not you.

## See also

- [`scope-control`](scope-control.md) — git-ops permission gate ("rebase" already named in the canonical list).
- [`commit-policy`](commit-policy.md) — commits are the user's call; rewriting them is a stronger version of the same restriction.
- [`token-efficiency`](token-efficiency.md) — Iron Law on burning the user's tokens for cosmetic gain.
- [`skill:git-workflow`](../skills/git-workflow/SKILL.md) — Safe Squash-After-Push protocol and Divergent-State Recovery decision tree.
