---
name: commands
description: "Use when the user types a slash command like "/create-pr" or "/commit". Executes the command immediately without asking questions or giving opinions."
source: package
---

# commands

## Core Rule

See `commands` rule (always loaded). Execute immediately, no questions.

## Commands = files in `.augment/commands/`. Triggered by `/name`, `# name`, "run name", or pasting content. Always execute, never ask "what do you want?".

## Execute: match → read → follow steps in order → ask only when command says to → show results.

## Infer context: Jira from branch, default branch from git, project type from artisan/composer. Only ask if inference fails.

## Locations: `.augment/commands/` (shared), `agents/overrides/commands/` (override wins).


## GitHub API: Replying to PR review comments

When commands reply to PR review comments (e.g. `/fix-pr-bot-comments`), follow this pattern:

### 1. Read the setting

Read `github_pr_reply_method` from `.agent-settings`:

| Value | API call |
|---|---|
| `replies_endpoint` | `POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/replies` with `{"body": "..."}` |
| `create_review_comment` | `POST /repos/{owner}/{repo}/pulls/{number}/comments` with `{"body": "...", "in_reply_to": comment_id}` |
| `auto` | Try `replies_endpoint` first. If it works → update setting. If 404/error → try `create_review_comment`. |

### 2. Bot icon prefix

Read `pr_comment_bot_icon` from `.agent-settings`:

- If `true` → prefix every reply body with `🤖 ` (icon + space).
- If `false` or not set → no prefix.

Example with `pr_comment_bot_icon=true`:
```
{"body": "🤖 Fixed — removed the unused variable."}
```

Example with `pr_comment_bot_icon=false`:
```
{"body": "Fixed — removed the unused variable."}
```

### 3. Make the API call

**Critical:** The `data` parameter must be a clean JSON object with ONLY the required API fields:

Do NOT include `summary` or any other non-API parameters inside `data`.
Each reply is a separate API call — do NOT batch them.

### 4. On first success with `auto`

If `github_pr_reply_method=auto` and the first reply succeeds, update `.agent-settings`
to the method that worked (e.g. `replies_endpoint`). This prevents re-detection on every run.

## Gotcha

- Don't ask questions when executing a command unless the command itself says "ask the user".
- Don't add opinions or suggestions during command execution — follow the steps exactly.
- If a command step fails, stop and report — don't improvise alternative steps.

## Do NOT

- Do NOT interpret a command as a question about the command.
- Do NOT add your own questions beyond what the command specifies.

## Auto-trigger keywords

- slash command
- command execution
- agent command
