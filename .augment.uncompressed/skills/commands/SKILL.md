---
name: commands
description: "Use when the user types a slash command like "/create-pr" or "/commit". Executes the command immediately without asking questions or giving opinions."
source: package
---

# commands

## Core Rule

See `commands` rule (always loaded). Execute immediately, no questions.

## What is a command?

A command is a user message that matches a file in `.augment/commands/`.
Commands are predefined workflows with step-by-step instructions.

### How to recognize a command

A command can be triggered in multiple ways:

| User message | Action |
|---|---|
| `/create-pr` | Slash command → execute immediately |
| `# create-pr` followed by command content | User pasted the command file → execute immediately |
| "run create-pr" or "execute create-pr" | Natural language → execute immediately |
| Pasting the full content of a `.augment/commands/*.md` file | User wants it executed → execute immediately |

**Key rule:** If the user's message contains the **content of a command file** (heading, steps, instructions),
treat it as a command invocation — **not** as a request for feedback about the command.
Never ask "what do you want to do with this?" when the user pastes a command.

## How to execute

1. **Match**: Find the command file in `.augment/commands/{name}.md`.
2. **Read**: Read the command file to understand the steps.
3. **Execute**: Follow the steps in order. Start immediately.
4. **Ask only when required**: Some steps say "ask the user" — only then ask.
   If a step says "ask the user (in their language)", ask in the user's language.
5. **Show results**: Present output as the command specifies (tables, code blocks, etc.).

## Inferring context

Before asking the user for input, try to infer it:

| Input needed | How to infer |
|---|---|
| Jira ticket | Extract from branch name (`fix/DEV-1234-...` → `DEV-1234`) |
| Default branch | `git symbolic-ref refs/remotes/origin/HEAD` or assume `main` |
| Project type | Check for `artisan` (Laravel) or `composer.json` (Composer) |
| Module name | Extract from current working directory or file path |
| Current branch | `git branch --show-current` |

Only ask the user if inference fails and the command cannot proceed without the value.

## Command locations

| Location | Scope |
|---|---|
| `.augment/commands/` | Shared commands (work across projects) |
| `agents/overrides/commands/` | Project-specific overrides of shared commands |

If an override exists for a command, use the override instead of the original.

## Cross-References

| Skill | Relationship |
|---|---|
| `project-docs` | Commands may reference project docs — read them if the command says to |
| `agent-docs` | Some commands create or update agent docs |
| `git-workflow` | PR and branch commands follow git conventions |
| `jira` | Ticket-related commands use Jira API |


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
