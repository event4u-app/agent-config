---
name: fix-pr-bot-comments
skills: [coder, quality-tools]
description: Fix and reply to bot review comments (Copilot, Augment, Greptile, etc.) on a GitHub PR
disable-model-invocation: true
---

# fix-pr-bot-comments

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

After the PR is confirmed, ask the user (use numbered options per `user-interaction` rule):

```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```

- **Option 1** → follow the "Interactive flow" below.
- **Option 2** → follow the "Auto flow" below.

## Bot detection

A comment is from a **bot** if the GitHub user has `type: "Bot"` or the login matches
known bot accounts: `Copilot`, `github-actions[bot]`, `greptile[bot]`, `augment[bot]`,
or any login ending in `[bot]`.

## Instructions (shared)

1. **Fetch all review comments** from the PR using the GitHub API (`/pulls/{number}/comments`).
   Use `per_page: 100`. Filter for **bot comments** that have **no reply yet** from a human user.

2. **For each unresolved bot comment**, read the affected file and surrounding context
   to understand the code and the suggestion.

3. **Report the total count** to the user: "Found X unresolved bot comments."

---

## Interactive flow

For each comment, present it to the user **before** taking action:

### 1. Summarize the comment

In the **user's language**, briefly explain:
- Which file/line is affected
- What the bot is suggesting
- Your assessment: is it valid, partially valid, or not applicable?

### 2. Offer options

Present numbered options. Always include a "leave as-is" option. Examples:

**If there's one clear fix:**
> **Comment 1/3** — `WorkingTimeService.php:108`
> Bot says: The guard condition only checks `job_start`, but the comment also mentions `job_stop`.
>
> 1. Fix the comment (only mention `job_start`)
> 2. Extend the guard condition (also check `job_stop`)
> 3. Leave as-is, dismiss comment

**If there are multiple valid approaches:**
> **Comment 2/3** — `AbsencePlannerService.php:520`
> Bot says: When an exception occurs mid-loop, log entries are missing.
>
> 1. `writeLogBulk()` in einen `finally`-Block verschieben
> 2. Die gesamte Schleife in eine DB-Transaction wrappen
> 3. Leave as-is, dismiss comment

### 3. Wait for the user's choice

- Do NOT proceed until the user picks an option.
- If the user asks a follow-up question, answer it before proceeding.
- After the user chooses, apply the fix (or skip) and reply on GitHub.

### 4. Move to the next comment

Repeat until all comments are handled.

---

## Auto flow

Process all comments without asking. For each comment:

1. Analyze whether the suggestion is valid.
2. **If valid** — fix it and reply on GitHub.
3. **If not valid** — reply on GitHub explaining why, do NOT change the code.

---

## Common patterns to watch for

- **Duplicate PHPDoc tags** → fix by keeping the more specific/typed version.
- **Split PHPDoc blocks** → merge into a single docblock.
- **Wrong PHPDoc tag order** → `@param` before `@return` before `@throws`.
- **Conflicting PHPDoc types** → remove incorrect PHPDoc, trust the method signature.
- **Broad ignore patterns / intentional config** → reply explaining rationale, don't change.
- **Validation/logic bugs** → fix the code.

## Reply style — write like a human developer, not an AI

- The GitHub API token authenticates as the PR author. Write replies as if you ARE the developer.
- Keep it casual, short, and natural. Like a real dev replying to a code review.
- Vary your wording — never use the same opening phrase twice in a row.
- Don't over-explain. A dev who fixed something doesn't write a paragraph about it.
- Good examples: `"Good catch, fixed."`, `"Yep, consolidated into one docblock now."`,
  `"Removed the duplicate 👍"`, `"That's intentional — [reason]"`
- Never start multiple replies with "Fixed". Mix it up: "Done", "Good catch", "Yep", etc.

### Bot icon prefix

Read `pr_comment_bot_icon` from `.agent-settings`. If `true` (default), prefix every
reply with `🤖 ` so reviewers can see at a glance that the reply was bot-authored.

Example: `🤖 Good catch, fixed.`

If `false` or `.agent-settings` doesn't exist, do NOT add the prefix.

## Replying via GitHub API

Read `github_pr_reply_method` from `.agent-settings` to determine the correct endpoint.
See the `command-routing` skill → "GitHub API: Replying to PR review comments" for full details.

## After all comments

1. Run a PHP syntax check (`php -l`) on all modified files to verify nothing is broken.
2. **Do NOT commit or push.** Just apply the fixes locally and reply to all comments on GitHub.

