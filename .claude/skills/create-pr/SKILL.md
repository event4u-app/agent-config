---
name: create-pr
description: "create-pr"
disable-model-invocation: true
---

# create-pr

Uses `/create-pr-description` → creates PR via GitHub API.

## Instructions

### 1. Prerequisites

Not default branch. `git status` (warn uncommitted). `git log origin/{default}..HEAD --oneline` (verify commits). Push if needed (ask).

### 2. Generate PR content

Run `/create-pr-description`. **MUST use PR template.** User reviews.

### 3. Create PR

Head: EXACT `git branch --show-current` (NEVER reuse). Base: default branch. Ask:
  ```
  > 1. Create as draft
  > 2. Create as ready for review
  ```
Draft: Option 1 → `true`, Option 2 → `false`. Verify `draft: false` actually applied (`gh pr view {number} --json isDraft`). Fix with `gh pr ready {number}`.

### 4. After creation

Show PR URL. Jira linked → ask:
  ```
  > Transition Jira ticket {TICKET-ID} to "In Review"?
  >
  > 1. Yes — update status
  > 2. No — leave as-is
  ```

### Rules

- Always use PR template. Show content before creating. Push first if needed.
- Only create, never merge. Commit/push only with permission.
