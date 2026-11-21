---
model_tier: high
name: prepare-for-review
pack: engineering-base
visibility: internal
skills: [git-workflow, quality-tools]
description: Prepare a PR branch for local review — updates main and merges the full branch chain so the branch is up to date
argument-hint: "<pr-number | pr-url | ticket-key>"
suggestion:
  eligible: true
  trigger_description: "get this branch ready for review, rebase and prep for PR"
  trigger_context: "branch behind base or part of a PR chain"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# prepare-for-review

## Input

The user provides a PR number or ticket number (e.g. `DEV-1234` or `#42`).

### PR detection

The first source that yields exactly one PR wins:

1. **An explicit PR URL** or PR number from the user → that PR.
2. A Jira ticket number (e.g. `DEV-1234`) → the one open PR whose branch name
   contains it (GitHub API search).
3. **The session default target** — the `<session-prs>` block lists exactly
   one PR as `OPEN` and does not say its last read FAILED → that PR.
4. **The current branch** has exactly one open PR → that PR.
5. Otherwise (none, or several) → **ask the user once** for the PR number or URL.

Whichever source resolved it, name it in one line ("PR #{number} on branch
`{branch}` — from the ticket search") and continue; no confirmation question.

A **PR number recalled from the conversation** is never a source. The session
default target is not that: a hook records it from the `gh pr create` output of
this session and re-reads its state on every prompt.

## Instructions

### 1. Fetch the PR

- Use the GitHub API to get the PR details: base branch, head branch, and title.

### 2. Build the branch chain

- If **base branch is `main`** → chain is: `main → {head branch}`
- If **base branch is NOT `main`** → the base branch itself may have a non-main base.
  - Recursively fetch the PR for the base branch (search for an open PR with that head branch).
  - Keep going until you reach `main`.
  - Build the full ordered chain, e.g.: `main → feature/base → feature/sub → feature/target`

### 3. Update main

```bash
git checkout main
git pull origin main
```

If this fails, abort and report the error to the user.

### 4. Fetch all branches

Before any local checkout or merge, fetch all branches in the chain from `origin`:

```bash
git fetch origin {branch-1} {branch-2} ...
```

This ensures the branches exist locally and are up to date, even in a fresh clone.

### 5. Merge chain bottom-up

For each consecutive pair in the chain (starting from `main` upward):

```bash
git checkout {child-branch}
git merge {parent-branch} --no-edit
```

- **Under `git.update_strategy: rebase`** do not merge the chain: a merge
  commit on a feature branch is what that setting excludes, and this command
  must not leave one behind to be pushed later. Check the target branch back
  out, report which branches are behind their parent, and finish without error
  — the review then runs against `git merge-base HEAD origin/<parent-branch>`
  (the remote ref step 4 fetched; a local branch may be missing or stale), the
  target's direct parent in the chain, so parent PRs stay out of it. Updating the
  chain is a rebase the user asks for
  ([`branch-update`](../../../skills/git-workflow/references/branch-update.md)).
- If a **merge conflict** occurs at any point:
  - Run `git merge --abort`
  - Abort the entire process immediately
  - Report to the user exactly which branches conflicted
  - Do NOT proceed further

### 6. Check out the target branch

Once all merges succeed:

```bash
git checkout {head-branch-of-target-PR}
```

### 7. Report

One line on success:
`→ {branch} ready · {N} branches merged · {warnings or "clean"}`.
Warnings and errors are always surfaced.

## Rules

- **Do NOT push** any branch — only local merges.
- **Do NOT create manual commits** — only `git merge` may create merge commits as part of this workflow.
- **Abort immediately** on any conflict — do not try to resolve conflicts.
- **Always fetch fresh PR data** — never reuse stale data from earlier in the conversation.
