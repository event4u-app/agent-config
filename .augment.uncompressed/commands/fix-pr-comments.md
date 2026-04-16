---
name: fix-pr-comments
skills: [php-coder]
description: Fix and reply to all open review comments (bots + human reviewers) on a GitHub PR
disable-model-invocation: true
---

# fix-pr-comments

This command runs `fix-pr-bot-comments` and `fix-pr-developer-comments` in sequence on the same PR.

## Input

The user may or may not provide a PR URL.

### PR detection

1. If the user provides a GitHub PR URL → use that PR.
2. If no URL is provided → **try to detect the PR automatically:**
   - Determine the current Git branch (`git branch --show-current`).
   - Search for an open PR on that branch via the GitHub API
     (`GET /repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=open`).
   - If exactly one PR is found → tell the user: "I found PR #{number} ({title}) on branch `{branch}`. Is that the one?"
   - Wait for confirmation before proceeding.
   - If no PR or multiple PRs are found → ask the user for the PR URL.
3. **Never** reuse a PR number from earlier in the conversation.

## Mode selection

After the PR is confirmed, ask the user:

```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```

The chosen mode applies to **both** phases.

## Execution

### Phase 1: Bot comments

Follow the full `fix-pr-bot-comments` instructions (see `.augment/commands/fix-pr-bot-comments.md`).
Use the already-confirmed PR and mode — do not ask again.

Report when done: "Bot comments done. Continuing with reviewer comments..."

### Phase 2: Developer comments

Follow the full `fix-pr-developer-comments` instructions (see `.augment/commands/fix-pr-developer-comments.md`).
Use the same PR and mode.

### After both phases

1. Run a PHP syntax check (`php -l`) on all modified files to verify nothing is broken.
2. Report a final summary: how many bot comments handled, how many developer comments handled,
   how many files modified.
3. **Do NOT commit or push.** Just apply the fixes locally and reply to all comments on GitHub.

