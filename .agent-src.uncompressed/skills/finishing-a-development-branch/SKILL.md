---
name: finishing-a-development-branch
description: "Use when the feature is implementation-complete and the next step is 'ship it' — verifies, cleans up, and routes to merge/PR/park/discard — even when the user just says 'I'm done, what now?'."
source: package
---

# finishing-a-development-branch

## When to use

* Implementation of a feature or bug fix is complete on a development branch
* All planned commits are in, the user is ready to hand off
* You are about to say "done" and suggest the next action
* The branch has been idle and the user wants to decide its fate

Do NOT use when:

* Still implementing — use targeted verification, not the ship gate
* A PR already exists and is mid-review — use
  [`receiving-code-review`](../receiving-code-review/SKILL.md)
* Only documentation changed and no tests apply — simplify to
  commit + PR without the full gate

## Goal

Route a finished branch to its next state **with evidence** — merged,
pushed for PR, parked, or discarded. Never let a half-verified branch
become a PR. Never destroy work without explicit confirmation.

## The Iron Law

```
NO MERGE, NO PR, NO DISCARD WITHOUT VERIFIED TESTS + EXPLICIT CHOICE.
```

Skipping verification because "it worked a minute ago" is how broken
`main` happens. Discarding because "I assumed the user meant it" is
how work gets lost.

## Procedure

### 1. Inspect the current branch state

Before presenting any options, gather context. Do not assume — check:

* `git status` — clean, or still dirty?
* `git log --oneline <base>..HEAD` — what commits are actually on this
  branch?
* `git branch --show-current` — the branch name you will be operating on
* Remote state — is the branch pushed? Is there an open PR already?

If a PR already exists for this branch, **stop** — this is not a
finishing step, route to [`receiving-code-review`](../receiving-code-review/SKILL.md)
or [`fix-pr-comments`](../../commands/fix-pr-comments.md) instead.

### 2. Verify readiness

Run the full end-of-work gate before presenting any options — see
[`verify-before-complete`](../verify-before-complete/SKILL.md):

1. Targeted tests green
2. Full test suite green
3. Quality pipeline (PHPStan → Rector dry-run → ECS → PHPStan) green
4. `git status` clean — nothing unstaged, no stray files
5. Branch is pushed or explicitly marked local-only

If any step fails → **stop**. Report the failure, do not present ship
options. Fixing the failure comes first.

### 3. Determine the base branch

```bash
# Default: main
BASE=main

# Stacked PR: parent branch
BASE=$(git config branch.$(git branch --show-current).merge | sed 's|refs/heads/||')
```

If ambiguous, ask: *"This branch splits from `<guess>` — correct?"*
before presenting options.

### 4. Present the four options — numbered, no narration

Ask the user exactly one question:

```
Implementation is verified. What now?

1. Open a Pull Request on <base-branch>
2. Merge locally into <base-branch> (for projects without a PR flow)
3. Keep the branch as-is — I'll handle it later
4. Discard all work on this branch
```

Do not add recommendations unless the user asks. Each option leads to
a different sub-procedure (steps 5a–5d).

### 5a. Option 1 — Open a PR

1. Ensure the branch is up to date with the base →
   [`prepare-for-review`](../../commands/prepare-for-review.md)
2. Self-review the full diff → [`review-changes`](../../commands/review-changes.md)
3. Write the PR description → [`create-pr-description`](../../commands/create-pr/description-only.md)
4. Open the PR → [`create-pr`](../../commands/create-pr.md)
5. Confirm the PR opened green, not red

See [`requesting-code-review`](../requesting-code-review/SKILL.md) for
the surrounding discipline.

### 5b. Option 2 — Merge locally

Use only when the project policy is "no PR required" (solo repos,
spike branches, private tooling). For team repos, default to Option 1.

```bash
git checkout <base-branch>
git pull --ff-only
git merge --no-ff <feature-branch>
# Re-run the full test suite on the merged tree
<test command>
# Only if green:
git branch -d <feature-branch>
```

If the post-merge test run fails → `git reset --hard ORIG_HEAD`, fix
on the feature branch, restart from Option 1/2.

### 5c. Option 3 — Keep as-is

* Push the branch to origin if not already pushed (safeguards the work)
* Report the branch name and the last commit SHA back to the user
* Do not delete the worktree, do not force-push

### 5d. Option 4 — Discard

**Confirmation gate** — require a typed answer, not "y":

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

Log the discarded SHAs so the work can be recovered via `git reflog`
within the reflog TTL if needed.

### 6. Clean up worktrees

If the branch lives in a `git worktree`:

* Options 1, 2, 4 → `git worktree remove <path>` after the branch
  terminal state
* Option 3 → keep the worktree

## Output format

After the chosen option completes, report:

1. **What happened** — single sentence ("PR #123 opened", "Merged
   into main as `abcdef`", "Branch discarded")
2. **Evidence** — exit codes / PR URL / commit SHA
3. **Cleanup state** — worktree removed / kept, branch deleted /
   retained
4. **Next step** — e.g. "Awaiting review" / "Main is one commit ahead"

## Gotchas

* Option 1 (PR) on a red CI — the PR opens but is not actually
  reviewable; check the CI status before reporting success
* Option 2 (local merge) with fast-forward only on a diverged base
  silently fails — the merge command aborts but the report can look
  successful if the exit code is not checked
* Option 4 (discard) on a branch that is already the upstream of
  another local branch — the dependent branch is orphaned
* Force-pushing after a PR is opened can lose the reviewer's
  line-comments — prefer additional commits during review
* `git branch -d` vs `-D` — lowercase `-d` refuses unmerged branches,
  uppercase `-D` forces; only use `-D` inside the confirmed discard
  flow
* On stacked PRs, the base is **not** `main` — opening a PR to `main`
  invalidates the stack

## Do NOT

* Do NOT present ship options while tests or quality checks are red
* Do NOT add rationale or recommendations to the four numbered options
  — the user decides
* Do NOT discard a branch without a typed confirmation including the
  branch name
* Do NOT force-delete a remote branch without user confirmation
* Do NOT silently change the base branch between verification and ship
* Do NOT mix any other cleanup into the discard step

## Anti-patterns

* Presenting three options and phrasing the fourth as "or we can
  discard if you want" — buries the destructive option
* Running the full gate inside this skill *and* at the start of
  `create-pr` — duplicates work. Trust the gate result if nothing
  changed in between
* Merging local + opening PR at the same time — pick one
* Asking "ready to ship?" without listing the four concrete options

## When to hand over to another skill / command

* Final pre-merge verification → [`verify-before-complete`](../verify-before-complete/SKILL.md)
* Rebasing the stack before PR → [`prepare-for-review`](../../commands/prepare-for-review.md)
* Writing the commit for any last-minute tweaks →
  [`commit`](../../commands/commit.md),
  [`conventional-commits-writing`](../conventional-commits-writing/SKILL.md)
* Self-review walkthrough → [`review-changes`](../../commands/review-changes.md)
* Creating the PR → [`create-pr`](../../commands/create-pr.md)
* Processing review comments after the PR is open →
  [`receiving-code-review`](../receiving-code-review/SKILL.md)

## Validation checklist

Before reporting "done" after this skill runs:

* [ ] Full gate (tests + quality pipeline) verified green in this turn
* [ ] Base branch determined and confirmed with the user when ambiguous
* [ ] Exactly four numbered options were presented, no narration added
* [ ] User's choice recorded literally, not reinterpreted
* [ ] Sub-procedure for the chosen option completed end-to-end
* [ ] Worktree state handled per option (remove for 1/2/4, keep for 3)
* [ ] Destructive actions had typed confirmation including branch name
* [ ] Final report includes evidence (PR URL, SHA, or exit code)
