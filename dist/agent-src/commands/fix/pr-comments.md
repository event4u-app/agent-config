---
model_tier: medium
name: fix-pr-comments
pack: engineering-base
tier: 2
visibility: internal
cluster: fix
sub: pr-comments
skills: [php-coder, quality-tools]
description: Fix and reply to all open review comments (bots + human reviewers) on a GitHub PR
suggestion:
  eligible: true
  trigger_description: "fix all PR review comments, resolve the review feedback"
  trigger_context: "open PR with unresolved comments (bot + human)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix pr-comments

Single surface for addressing all open PR review comments — **bot**
(Copilot, Greptile, Augment, …) and **human reviewers** — in one pass.
Each unresolved comment is classified by author type and handled with the
right detection and reply style. Dedupes by comment id + reply marker;
never replies twice.

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

The chosen mode applies to **every** comment, bot and human alike.

## Comment classification

- A comment is from a **bot** if the GitHub user has `type: "Bot"` or the
  login matches a known bot account: `Copilot`, `github-actions[bot]`,
  `greptile[bot]`, `augment[bot]`, or any login ending in `[bot]`.
- A comment is from a **human reviewer** if the user `type` is `"User"`, the
  login does NOT end in `[bot]`, and the user is NOT the PR author (never
  process your own comments).

## Instructions (shared)

1. **Fetch all review comments** from the PR using the GitHub API
   (`/pulls/{number}/comments`, `per_page: 100`). Also fetch **PR reviews**
   (`/pulls/{number}/reviews`) for top-level human review comments. Filter for
   comments that have **no reply yet** from the PR author.
2. **Classify** each unresolved comment as bot or human (rules above).
3. **For each comment**, read the affected file and surrounding context to
   understand the code and the suggestion / request.
4. **Report the totals** to the user: "Found X unresolved bot comments and Y
   unresolved reviewer comments."

---

## Interactive flow

For each comment, present it to the user **before** taking action.

### 1. Summarize the comment

In the **user's language**, briefly explain:
- Whether it's a bot or a named human reviewer (login)
- Which file/line is affected
- What is being suggested / requested
- Your assessment: valid, partially valid, a question, a style preference, or not applicable

### 2. Offer options

Present numbered options. Always include a "leave as-is" / "skip" option.

**Bot — one clear fix:**
> **Comment 1/3** — `WorkingTimeService.php:108`
> Bot says: The guard condition only checks `job_start`, but the comment also mentions `job_stop`.
>
> 1. Fix the comment (only mention `job_start`)
> 2. Extend the guard condition (also check `job_stop`)
> 3. Leave as-is, dismiss comment

**Bot — multiple valid approaches:**
> **Comment 2/3** — `AbsencePlannerService.php:520`
> Bot says: When an exception occurs mid-loop, log entries are missing.
>
> 1. `writeLogBulk()` in einen `finally`-Block verschieben
> 2. Die gesamte Schleife in eine DB-Transaction wrappen
> 3. Leave as-is, dismiss comment

**Human — change request:**
> **Comment 1/3** — @cjost1988 in `WorkingTimeService.php:108`
> Reviewer asks: Why is the fallback `float`? `$time` is `$hours * 60`.
>
> 1. Reply and explain why (no code change needed)
> 2. Adjust type annotation to `float|int|string`
> 3. Skip

**Human — question (no code change needed):**
> **Comment 3/3** — @cjost1988 in `KS21Client.php:42`
> Reviewer asks: Is this fallback ever reached?
>
> 1. Reply with explanation
> 2. Skip

### 3. Wait for the user's choice

- Do NOT proceed until the user picks an option.
- If the user wants a custom reply, let them dictate the text.
- If the user asks a follow-up question, answer it before proceeding.
- After the user chooses, apply the fix (or skip) and reply on GitHub.

### 4. Move to the next comment

Repeat until all comments are handled.

---

## Auto flow

Process all comments without asking. For each comment:

**Bot comments:**
1. Analyze whether the suggestion is valid.
2. **If valid** — fix it and reply on GitHub.
3. **If not valid** — reply on GitHub explaining why, do NOT change the code.

**Human reviewer comments:**
1. **Clear code fix** — fix it and reply on GitHub.
2. **Question** — reply with a concise explanation on GitHub.
3. **Ambiguous or a design decision** — do NOT guess; collect these and present
   them at the end: "These comments need your decision: …".

---

## Common bot patterns to watch for

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
- For reviewer questions: answer directly and concisely.
- Be respectful — human reviewers are colleagues, not bots. Don't dismiss feedback.
- Good examples: `"Good catch, fixed."`, `"Yep, consolidated into one docblock now."`,
  `"Removed the duplicate 👍"`, `"That's intentional — [reason]"`,
  `"The fallback covers legacy data where getTime() returns a string."`
- Never start multiple replies with "Fixed". Mix it up: "Done", "Good catch", "Yep", etc.

### Bot icon prefix

Read `personal.pr_comment_bot_icon` from `.agent-settings.yml`. If `true` (default),
prefix every reply with `🤖 ` so reviewers can see at a glance that the reply was
bot-authored.

Example: `🤖 Good catch, fixed.`

If `false` or `.agent-settings.yml` doesn't exist, do NOT add the prefix.

## Replying via GitHub API

Read `github.pr_reply_method` from `.agent-settings.yml` to determine the correct endpoint.
See the `command-routing` skill → "GitHub API: Replying to PR review comments" for full details.

## After all comments

1. Run a PHP syntax check (`php -l`) on all modified files to verify nothing is broken.
2. Report a final summary: how many bot comments handled, how many reviewer
   comments handled, how many files modified.
3. **Do NOT commit or push.** Just apply the fixes locally and reply to all comments on GitHub.
