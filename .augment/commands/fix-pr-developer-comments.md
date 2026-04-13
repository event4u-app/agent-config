---
skills: [coder]
description: Fix and reply to human reviewer comments on a GitHub PR
---

# fix-pr-developer-comments

## Input

PR URL or auto-detect: `git branch --show-current` → GitHub API search → confirm. Never reuse old PR numbers.

## Mode selection

```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```

- **Option 1** → follow the "Interactive flow" below.
- **Option 2** → follow the "Auto flow" below.

## Human reviewer detection

`type: "User"`, login not `[bot]`, not PR author.

## Instructions

Fetch `/pulls/{number}/comments` + `/pulls/{number}/reviews` (per_page: 100). Filter: human, no reply from author. Read affected code. Report count.

---

## Interactive flow

Per comment, present before acting: who, file/line, request, assessment. Numbered options (always include skip):

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

Wait for choice. Custom reply OK. Apply fix + post on GitHub. Repeat for all comments.

---

## Auto flow

Clear fix → fix + reply. Question → reply. Ambiguous → collect for user at end.

---

## Reply style

Write as PR author — casual, short, natural. Vary wording. Be respectful.
Examples: `"Good point, fixed."`, `"Yep, leftover — removed."`, `"Fallback covers legacy data."`

### Bot icon prefix

`pr_comment_bot_icon` in `.agent-settings` → `true`: prefix `🤖 `. `false`: no prefix.

## Replying via GitHub API

`github_pr_reply_method` from `.agent-settings`. See `commands` skill for details.

## After all comments

`php -l` on modified files. Do NOT commit/push.

