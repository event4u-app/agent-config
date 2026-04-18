---
name: prepare-for-review
skills: [git-workflow, quality-tools]
description: Prepare a PR branch for local review — updates main and merges the full branch chain so the branch is up to date
disable-model-invocation: true
---

# prepare-for-review

## Input

The user provides a PR number or ticket number (e.g. `DEV-1234` or `#42`).

### PR detection

1. If the user provides a GitHub PR URL or PR number → use that PR directly.
2. If the user provides a Jira ticket number (e.g. `DEV-1234`) → search for an open PR linked to that ticket:
   - Search via GitHub API for an open PR whose branch name contains the ticket number.
   - If exactly one PR is found → confirm with the user: "I found PR #{number} on branch `{branch}`. Is that the one?"
   - If none or multiple found → ask the user for the PR number or URL.
3. **Never** reuse a PR number from earlier in the conversation without confirmation.

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

Inform the user:
- Which branch chain was processed (in order)
- That the target branch is now checked out and up to date
- Any warnings (e.g. branch was already up to date)

## Rules

- **Do NOT push** any branch — only local merges.
- **Do NOT create manual commits** — only `git merge` may create merge commits as part of this workflow.
- **Abort immediately** on any conflict — do not try to resolve conflicts.
- **Always fetch fresh PR data** — never reuse stale data from earlier in the conversation.
