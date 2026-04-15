---
name: fix-pr-developer-comments
skills: [coder]
description: Fix and reply to human reviewer comments on a GitHub PR
disable-model-invocation: true
---

# fix-pr-developer-comments

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

## Human reviewer detection

A comment is from a **human reviewer** if:
- The GitHub user `type` is `"User"` (not `"Bot"`).
- The login does NOT end in `[bot]`.
- The user is NOT the PR author (don't process your own comments).

## Instructions (shared)

1. **Fetch all review comments** from the PR using the GitHub API (`/pulls/{number}/comments`).
   Use `per_page: 100`. Also fetch **PR reviews** (`/pulls/{number}/reviews`) for top-level
   review comments. Filter for **human reviewer comments** that have **no reply yet** from the PR author.

2. **For each unresolved reviewer comment**, read the affected file and surrounding context
   to understand the code and what the reviewer is asking for.

3. **Report the total count** to the user: "Found X unresolved reviewer comments."

---

## Interactive flow

For each comment, present it to the user **before** taking action:

### 1. Summarize the comment

In the **user's language**, briefly explain:
- Who wrote the comment (reviewer name/login)
- Which file/line is affected
- What the reviewer is requesting or asking
- Your assessment: is it a valid concern, a question, a style preference, or a misunderstanding?

### 2. Offer options

Present numbered options. Always include a "skip" option. Adapt options to the comment type:

**For a change request:**
> **Comment 1/3** — @cjost1988 in `WorkingTimeService.php:108`
> Reviewer asks: Why is the fallback `float`? `$time` is `$hours * 60`.
>
> 1. Reply and explain why (no code change needed)
> 2. Adjust type annotation to `float|int|string`
> 3. Skip

**For a bug report:**
> **Comment 2/3** — @cjost1988 in `AbsencePlannerService.php:520`
> Reviewer says: Race condition when two requests book simultaneously.
>
> 1. Add locking mechanism (DB lock or cache lock)
> 2. Reply: not relevant in current scope, create a ticket
> 3. Skip

**For a question (no code change needed):**
> **Comment 3/3** — @cjost1988 in `KS21Client.php:42`
> Reviewer asks: Is this fallback ever reached?
>
> 1. Reply with explanation
> 2. Skip

### 3. Wait for the user's choice

- Do NOT proceed until the user picks an option.
- If the user wants to write a custom reply, let them dictate the text.
- If the user asks a follow-up question, answer it before proceeding.
- After the user chooses, apply the fix (or reply) and post on GitHub.

### 4. Move to the next comment

Repeat until all comments are handled.

---

## Auto flow

Process all comments without asking. For each comment:

1. Analyze what the reviewer is requesting.
2. **If it's a clear code fix** — fix it and reply on GitHub.
3. **If it's a question** — reply with a concise explanation on GitHub.
4. **If it's ambiguous or a design decision** — flag it to the user instead of guessing.
   In auto mode, collect these and present them at the end: "These comments need your decision: ..."

---

## Reply style — write like a human developer, not an AI

- The GitHub API token authenticates as the PR author. Write replies as if you ARE the developer.
- Keep it casual, short, and natural. Like a real dev replying to a code review.
- Vary your wording — never use the same opening phrase twice in a row.
- For reviewer questions: answer directly and concisely. Don't over-explain.
- For fixes: confirm briefly what was changed.
- Be respectful — these are colleagues, not bots. Don't dismiss feedback.
- Good examples: `"Good point, fixed."`, `"Yep, that was a leftover — removed."`,
  `"The fallback covers legacy data where getTime() returns a string."`
- Never start multiple replies with the same phrase. Mix it up naturally.

### Bot icon prefix

Read `pr_comment_bot_icon` from `.agent-settings`. If `true` (default), prefix every
reply with `🤖 ` so reviewers can see at a glance that the reply was bot-authored.

Example: `🤖 Good point, fixed.`

If `false` or `.agent-settings` doesn't exist, do NOT add the prefix.

## Replying via GitHub API

Read `github_pr_reply_method` from `.agent-settings` to determine the correct endpoint.
See the `commands` skill → "GitHub API: Replying to PR review comments" for full details.

## After all comments

1. Run a PHP syntax check (`php -l`) on all modified files to verify nothing is broken.
2. **Do NOT commit or push.** Just apply the fixes locally and reply to all comments on GitHub.

