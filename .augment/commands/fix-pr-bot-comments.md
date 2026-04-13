---
skills: [coder, quality-tools]
description: Fix and reply to bot review comments (Copilot, Augment, Greptile, etc.) on a GitHub PR
---

# fix-pr-bot-comments

## Input

PR URL or auto-detect: `git branch --show-current` → GitHub API search → confirm. Never reuse old PR numbers.

## Mode selection

After the PR is confirmed, ask the user (use numbered options per `user-interaction` rule):

```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```

- **Option 1** → follow the "Interactive flow" below.
- **Option 2** → follow the "Auto flow" below.

## Bot detection

`type: "Bot"` or login matches `Copilot`, `github-actions[bot]`, `greptile[bot]`, `augment[bot]`, `*[bot]`.

## Instructions

Fetch `/pulls/{number}/comments` (per_page: 100). Filter: bot, no human reply. Read affected code. Report count.

---

## Interactive flow

Per comment: file/line, suggestion, assessment. Numbered options (always include "leave as-is"):

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

Wait for choice. Apply + reply. Repeat.

---

## Auto flow

Valid → fix + reply. Not valid → reply explaining why, no code change.

---

## Common patterns

- Duplicate PHPDoc → keep specific. Split blocks → merge. Wrong order → `@param`→`@return`→`@throws`
- Conflicting types → trust signature. Intentional config → explain. Bugs → fix.

## Reply style

Write as PR author — casual, short, varied. Examples: `"Good catch, fixed."`, `"Consolidated into one docblock."`, `"That's intentional — [reason]"`

### Bot icon prefix

`pr_comment_bot_icon` in `.agent-settings` → `true`: prefix `🤖 `. `false`: no prefix.

## Replying via GitHub API

`github_pr_reply_method` from `.agent-settings`. See `commands` skill.

## After all comments

`php -l` on modified files. Do NOT commit/push.

