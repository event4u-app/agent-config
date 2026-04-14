---
type: "always"
description: "User interaction — numbered options, progress indicators, summaries"
alwaysApply: true
---

# User Interaction

## Numbered Options — Always

When asking the user a question with predefined choices, **always present numbered options**.
The user should be able to reply with just a number (e.g., `1`) instead of typing a sentence.

### Format

```
> 1. First option — brief explanation
> 2. Second option — brief explanation
> 3. Third option — brief explanation
```

### Rules

- **Every question with choices** must use numbered options — no exceptions.
- **Keep options short** — one line each, with a brief explanation after the dash.
- **Always include a "skip" or "no change" option** when applicable.
- **Default/recommended option** can be marked: `1. Do X (recommended)`.
- **Use the user's language** for the question and options.
- **Accept both** the number and a natural language answer (e.g., "1" or "the first one").

### Examples

**Binary choice:**
```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```

**Multiple choice with skip:**
```
> 1. Fix the code
> 2. Fix the test
> 3. Skip
```

**Confirmation with context:**
```
> Found PR #1399 on branch `chore/refactor-agent-setup-2`.
>
> 1. Yes, that's the right PR
> 2. No, different PR — I'll provide the URL
```

### When NOT to use numbered options

- **Open-ended questions** where the answer is free text (e.g., "What should the class be named?").
- **Simple yes/no** can use numbered options OR accept "ja"/"nein" directly.
  Even for yes/no, prefer numbered options if there's additional context to show.

## Progress Indicators

When processing multiple items (e.g., review comments, test failures), show progress:

```
**Comment 3/7** — `filename.php:42`
```

## Summaries

After completing a batch of actions, provide a summary table:

```
| # | File | Action |
|---|---|---|
| 1 | `file.php` | Fixed null check |
| 2 | `test.php` | Updated assertion |
| 3 | `config.php` | Skipped (intentional) |
```
