---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Git history ops — never rebase/squash/amend without request; never drop/exclude/force-over commits you didn't author (parallel / shared-PR work); once pushed, re-push same turn"
triggers:
  - intent: "rebase the branch"
  - intent: "squash commits"
  - intent: "clean up commit history"
  - intent: "fold this into the previous commit"
  - intent: "tidy history after pushing"
  - intent: "reseat the branch base"
  - intent: "exclude these commits from the branch"
  - keyword: "git rebase"
  - keyword: "rebase --onto"
  - keyword: "reset --hard"
  - keyword: "fixup"
  - keyword: "--amend"
  - keyword: "force-push"
  - keyword: "--force-with-lease"
  - keyword: "squash-merge"
  - phrase: "branch diverged"
  - phrase: "pull --rebase failed"
  - phrase: "ahead and behind"
  - phrase: "unexpected commits on the branch"
  - phrase: "commits I did not create"
routes_to:
  - "skill:git-workflow"
workspaces:
  - engineering
packs:
  - engineering-base
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

## Iron Law — Inherited & shared-branch commits (never drop without asking)

```
COMMITS YOU DID NOT AUTHOR THIS SESSION ARE NOT YOURS TO DROP.
NEVER EXCLUDE, RESET-AWAY, REBASE-OUT, OR FORCE-PUSH OVER A COMMIT
THAT ALREADY EXISTS ON A BRANCH (LOCAL OR REMOTE) — WITHOUT ASKING
THE USER THIS TURN. PARALLEL WORK IS THE DEFAULT, NOT THE EXCEPTION.
```

The user often works in parallel with the agent, and multiple agents may
share one PR branch. A commit that looks "unrelated" or "stray" may be
deliberate in-flight work the user expects to keep. Reseating a branch onto a
different base, `git reset --hard`-ing away inherited commits, force-pushing
over a branch you did not create, or branching from a base with unexpected
commits and then "cleaning" them out all **silently discard work** — the exact
failure this law prevents.

Before ANY of these, STOP and ask (one numbered-options prompt per
[`user-interaction`](user-interaction.md)):

- reseating a branch's base (`git rebase --onto`, `git reset --hard <other-base>`)
  in a way that drops commits already on the branch;
- excluding / not-carrying-forward commits that were on the branch when you
  started this session;
- force-pushing (or `push <local>:<remote>`-replacing) a branch that carries
  commits you did not author;
- branching from a base with unexpected commits, then resetting them away.

**Preserve-first is necessary but not sufficient.** Even when you keep the
commits reachable (a save-branch / tag), you still **ask before** the branch
the user sees loses them — "I preserved them locally" is not a substitute for
the question, because the user may be mid-edit on the shared branch and a
force-push would clobber their in-flight work regardless of your local backup.

When in doubt about whether a commit is yours to touch: it is not. Ask.

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
- "My branch inherited some unrelated commits — I'll reseat it on `origin/main` so my PR is clean." → **don't, ask first.** They may be the user's parallel work or another agent's. Preserve them and ask which base the user wants.
- "The remote branch has commits I didn't author and no PR — I'll just force-push over it." → don't. No-PR is not no-owner; ask before replacing a branch you did not create.

## See also

- [`scope-control`](scope-control.md) — git-ops permission gate ("rebase" already named in the canonical list).
- [`non-destructive-by-default`](non-destructive-by-default.md) — `reset --hard past unpushed work` and force-push are Hard-Floor triggers; the shared-branch Iron Law above is their commit-level companion.
- [`user-interaction`](user-interaction.md) — the one-question-per-turn shape for the shared-branch ask.
- [`commit-policy`](commit-policy.md) — commits are the user's call; rewriting them is a stronger version of the same restriction.
- [`token-efficiency`](token-efficiency.md) — Iron Law on burning the user's tokens for cosmetic gain.
- [`skill:git-workflow`](../skills/git-workflow/SKILL.md) — Safe Squash-After-Push protocol and Divergent-State Recovery decision tree.
