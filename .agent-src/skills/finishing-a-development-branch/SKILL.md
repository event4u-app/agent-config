---
name: finishing-a-development-branch
description: "Use when the feature is implementation-complete and the next step is 'ship it' — verifies, cleans up, and routes to merge/PR/park/discard — even when the user just says 'I'm done, what now?'."
source: package
---

# finishing-a-development-branch

## When to use

* Implementation of a feature or bug fix is complete on a development branch
* All planned commits are in, user is ready to hand off
* You are about to say "done" and suggest the next action
* Branch has been idle and the user wants to decide its fate

Do NOT use when:

* Still implementing — use targeted verification, not the ship gate
* A PR already exists and is mid-review — use [`receiving-code-review`](../receiving-code-review/SKILL.md)
* Only documentation changed — simplify to commit + PR without full gate

## Goal

Route a finished branch to its next state **with evidence** — merged,
pushed for PR, parked, or discarded. Never let a half-verified branch
become a PR. Never destroy work without explicit confirmation.

## The Iron Law

```
NO MERGE, NO PR, NO DISCARD WITHOUT VERIFIED TESTS + EXPLICIT CHOICE.
```

## Procedure

### 1. Inspect branch state

Before presenting options, check:

* `git status` — clean or dirty?
* `git log --oneline <base>..HEAD` — what commits are actually on this branch
* `git branch --show-current` — branch name to operate on
* Remote state — is the branch pushed? Is there an open PR already?

PR already exists → **stop**, route to [`receiving-code-review`](../receiving-code-review/SKILL.md)
or [`fix-pr-comments`](../../commands/fix-pr-comments.md).

### 2. Verify readiness

Run the full end-of-work gate — see [`verify-before-complete`](../verify-before-complete/SKILL.md):

1. Targeted tests green
2. Full test suite green
3. Quality pipeline (PHPStan → Rector dry-run → ECS → PHPStan) green
4. `git status` clean — no unstaged files, no stray files
5. Branch pushed or explicitly marked local-only

Any step fails → **stop**. Report failure, do not present ship options.

### 3. Determine the base branch

```bash
# Default: main
BASE=main

# Stacked PR: parent branch
BASE=$(git config branch.$(git branch --show-current).merge | sed 's|refs/heads/||')
```

Ambiguous → ask: *"This branch splits from `<guess>` — correct?"*.

### 4. Present four options — numbered, no narration

```
Implementation is verified. What now?

1. Open a Pull Request on <base-branch>
2. Merge locally into <base-branch> (for projects without a PR flow)
3. Keep the branch as-is — I'll handle it later
4. Discard all work on this branch
```

No recommendations unless the user asks.

### 5a. Option 1 — Open a PR

1. Update branch → [`prepare-for-review`](../../commands/prepare-for-review.md)
2. Self-review → [`review-changes`](../../commands/review-changes.md)
3. Write description → [`create-pr-description`](../../commands/create-pr-description.md)
4. Open PR → [`create-pr`](../../commands/create-pr.md)
5. Confirm PR opened green, not red

Surrounding discipline → [`requesting-code-review`](../requesting-code-review/SKILL.md).

### 5b. Option 2 — Merge locally

Use only for no-PR projects (solo, spike, private tooling).

```bash
git checkout <base-branch>
git pull --ff-only
git merge --no-ff <feature-branch>
# Re-run the full test suite on the merged tree
<test command>
# Only if green:
git branch -d <feature-branch>
```

Post-merge test fails → `git reset --hard ORIG_HEAD`, fix on feature branch, restart.

### 5c. Option 3 — Keep as-is

* Push to origin if not already pushed
* Report branch name and last commit SHA
* Do not delete the worktree, do not force-push

### 5d. Option 4 — Discard

**Confirmation gate** — typed answer, not "y":

```
This will permanently remove:
- Local branch <name>
- Remote branch <name> (if pushed)
- Commits: <list of SHAs + subjects>

Type "discard <name>" to confirm.
```

Only on exact match:

```bash
git checkout <base-branch>
git branch -D <feature-branch>
# Remove remote only if the user confirms a second time
git push origin --delete <feature-branch>
```

Log discarded SHAs so work can be recovered via `git reflog`.

### 6. Clean up worktrees

Branch in a `git worktree`:

* Options 1, 2, 4 → `git worktree remove <path>` after terminal state
* Option 3 → keep the worktree

## Output format

After chosen option completes:

1. **What happened** — one sentence ("PR #123 opened", "Merged as `abcdef`", "Discarded")
2. **Evidence** — exit codes / PR URL / commit SHA
3. **Cleanup state** — worktree removed/kept, branch deleted/retained
4. **Next step** — "Awaiting review", "Main is one commit ahead", etc.

## Gotchas

* Option 1 on red CI — PR opens but not reviewable; check CI status
* Option 2 with ff-only on diverged base silently aborts — check exit code
* Option 4 on a branch that is upstream of another local branch — orphans the dependent
* Force-push after PR open can lose reviewer line-comments
* `-d` refuses unmerged; `-D` forces — only use `-D` inside confirmed discard
* Stacked PRs base ≠ `main` — opening PR to `main` invalidates the stack

## Do NOT

* Do NOT present ship options while tests or quality are red
* Do NOT add rationale to the four options — user decides
* Do NOT discard without typed confirmation including branch name
* Do NOT force-delete remote without user confirmation
* Do NOT silently change the base between verification and ship
* Do NOT mix other cleanup into the discard step

## Anti-patterns

* Three options + "or discard" — buries destructive option
* Running the full gate here *and* at start of `create-pr` — duplicate
* Merge local + open PR at the same time
* Asking "ready to ship?" without the four numbered options

## When to hand over to another skill / command

* Pre-merge verification → [`verify-before-complete`](../verify-before-complete/SKILL.md)
* Rebasing stack → [`prepare-for-review`](../../commands/prepare-for-review.md)
* Last-minute commits → [`commit`](../../commands/commit.md), [`conventional-commits-writing`](../conventional-commits-writing/SKILL.md)
* Self-review → [`review-changes`](../../commands/review-changes.md)
* Creating PR → [`create-pr`](../../commands/create-pr.md)
* Review comments → [`receiving-code-review`](../receiving-code-review/SKILL.md)

## Validation checklist

* [ ] Full gate verified green in this turn
* [ ] Base branch determined and confirmed when ambiguous
* [ ] Exactly four numbered options presented, no narration
* [ ] User's choice recorded literally, not reinterpreted
* [ ] Sub-procedure for chosen option completed end-to-end
* [ ] Worktree handled per option
* [ ] Destructive actions had typed confirmation with branch name
* [ ] Final report includes evidence (PR URL, SHA, exit code)
