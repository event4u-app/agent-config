---
name: prepare-for-review
description: "Prepare code for review — quality checks, test run, self-review"
disable-model-invocation: true
---

# prepare-for-review

## Input

The user provides a PR number or ticket number (e.g. `DEV-1234` or `#42`).

### PR detection

PR URL/number → direct. Jira ticket → search GitHub for PR with matching branch. Never reuse old PR numbers.

## Instructions

### 1. Fetch the PR

- Use the GitHub API to get the PR details: base branch, head branch, and title.

### 2. Build branch chain

Base = `main` → simple. Base ≠ `main` → recursively fetch PRs until `main`. Chain: `main → ... → target`.

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

Per pair (main upward): `git checkout {child}` → `git merge {parent} --no-edit`. Conflict → `git merge --abort` → report → abort entirely.

### 6. Check out the target branch

Once all merges succeed:

```bash
git checkout {head-branch-of-target-PR}
```

### 7. Report — chain processed, target checked out, warnings.

## Rules

- No push. Only `git merge` commits. Abort on conflict. Fresh PR data always.
