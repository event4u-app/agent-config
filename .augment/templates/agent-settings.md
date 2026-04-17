# Agent Settings Template

User-specific agent settings stored in `.agent-settings` (project root, git-ignored).
This file is **not committed** — each developer has their own settings.

## File format

Simple `key=value` format, one setting per line. Lines starting with `#` are comments.

## Template

```
# Agent Settings
# This file is git-ignored. Each developer has their own settings.
# Run /config-agent-settings to create or update this file.

# IDE to use for opening files (code, phpstorm)
ide=

# Automatically open edited files in the IDE (true, false)
open_edited_files=false

# Prefix PR comment replies with a bot icon 🤖 (true, false)
pr_comment_bot_icon=true

# GitHub API method for replying to PR review comments
# replies_endpoint = POST /pulls/comments/{id}/replies (preferred, cleaner threads)
# create_review_comment = POST /pulls/{number}/reviews (fallback)
# auto = detect on first use and update this setting
github_pr_reply_method=auto

# Eloquent model property access style
# getters_setters = strict typed getters/setters, getAttribute() only inside model
# get_attribute = use getAttribute()/setAttribute() everywhere
# magic_properties = use $model->column_name (Laravel default)
eloquent_access_style=getters_setters

# Minimal output mode (true, false)
# true = short bullet points during work, concise summary at the end
# false = verbose explanations and reasoning
minimal_output=true

# Play-by-play mode (true, false)
# true = briefly share intermediate findings as you go
# false = silently investigate, only report the conclusion
play_by_play=false

# User's first name — used to address the user personally
user_name=

# Path to the PR template file (relative to project root)
pr_template=.github/pull_request_template.md

# rtk (Rust Token Killer) installed for output filtering (true, false)
# Agent will auto-detect and ask once, then store the result
rtk_installed=false

# Skill improvement pipeline (true, false)
# true = after meaningful tasks, propose learning capture and improvements
# false = silent, no post-task analysis
skill_improvement_pipeline=false

# Target repository for universal improvement PRs
upstream_repo=

# Branch prefix for improvement PRs
improvement_pr_branch_prefix=improve/agent-

# --- Runtime features ---

# Runtime pipeline (true, false)
# true = runtime dispatch, execution proposals, hook chains active
# false = runtime infrastructure exists but is dormant — zero token overhead
runtime_enabled=false

# Observability reports (true, false)
# true = generate reports after pipeline runs, CI summaries, structured logging
# false = no reports generated, no events emitted
observability_reports=false

# Feedback collection (true, false)
# true = record execution outcomes, generate improvement suggestions
# false = no feedback collected, no suggestions generated
feedback_collection=false

# --- Token / output control ---
#
# IMPORTANT: Data collection (metrics, reports, feedback) does NOT imply
# automatic usage by the agent. Reports, metrics, feedback, and audit logs
# must NOT be automatically injected into the agent context.
# They are only used: on explicit request, in targeted analysis tasks,
# or in bounded summaries (respecting max_report_lines).

# Auto-read reports into agent context (true, false)
# true = agent automatically loads reports when relevant (costs tokens)
# false = reports only read on explicit user request (saves tokens)
runtime_auto_read_reports=false

# Maximum lines per generated report section
# Limits report size to prevent unbounded token consumption
max_report_lines=30

# Minimal runtime context (true, false)
# true = only essential runtime metadata flows into agent context
# false = full runtime metadata available (more context, more tokens)
minimal_runtime_context=true

# CI summary on PRs (true, false)
# true = generate observability summary as CI artifact / PR comment
# false = no CI summaries generated
ci_summary_enabled=false

# Feedback suggestions in chat (true, false)
# true = improvement suggestions appear in agent chat after tasks
# false = suggestions only persist locally, never shown in chat
feedback_suggestions_in_chat=false
```

## Settings Reference

| Key | Values | Default | Description |
|---|---|---|---|
| `ide` | `code`, `phpstorm` | _(empty)_ | CLI command to open files in the IDE |
| `open_edited_files` | `true`, `false` | `false` | Auto-open edited files in the IDE after edits |
| `pr_comment_bot_icon` | `true`, `false` | `true` | Prefix PR comment replies with 🤖 to indicate bot-authored replies |
| `github_pr_reply_method` | `replies_endpoint`, `create_review_comment`, `auto` | `auto` | GitHub API method for replying to PR review comments. `auto` detects on first use. |
| `eloquent_access_style` | `getters_setters`, `get_attribute`, `magic_properties` | `getters_setters` | How to access Eloquent model attributes. See `eloquent` skill for details. |
| `minimal_output` | `true`, `false` | `true` | When `true`: short bullet points during work, concise summary at end. When `false`: verbose explanations. |
| `play_by_play` | `true`, `false` | `false` | When `true`: share intermediate findings during investigation. When `false`: work silently, report only the conclusion. |
| `user_name` | first name | _(empty)_ | User's first name. Agent asks on first interaction if empty, then addresses user by name. |
| `pr_template` | file path | `.github/pull_request_template.md` | Path to PR template file. Read this instead of searching for it. |
| `rtk_installed` | `true`, `false` | `false` | Whether rtk (Rust Token Killer) is installed. Agent auto-detects once and stores the result. |
| `skill_improvement_pipeline` | `true`, `false` | `false` | When `true`: propose learning capture after meaningful tasks. When `false`: silent. |
| `upstream_repo` | `org/repo` | _(empty)_ | Target repository for universal improvement PRs (e.g., `org/agent-config`). |
| `improvement_pr_branch_prefix` | string | `improve/agent-` | Branch prefix for agent improvement PRs. |
| `runtime_enabled` | `true`, `false` | `false` | Enable runtime pipeline (dispatch, execution proposals, hooks). When `false`: zero overhead. |
| `observability_reports` | `true`, `false` | `false` | Generate reports, CI summaries, and structured logging from pipeline runs. |
| `feedback_collection` | `true`, `false` | `false` | Record execution outcomes and generate improvement suggestions. |
| `runtime_auto_read_reports` | `true`, `false` | `false` | When `true`: agent auto-loads reports into context (costs tokens). When `false`: reports only on explicit request. |
| `max_report_lines` | number | `30` | Maximum lines per generated report section. Limits token consumption from reports. |
| `minimal_runtime_context` | `true`, `false` | `true` | When `true`: only essential runtime metadata in agent context. Saves tokens. |
| `ci_summary_enabled` | `true`, `false` | `false` | Generate observability summary as CI artifact or PR comment. |
| `feedback_suggestions_in_chat` | `true`, `false` | `false` | When `true`: suggestions appear in chat. When `false`: persist locally only. |

## Sync rules

When new settings are added to this template:

1. The `/config-agent-settings` command detects missing keys in the user's `.agent-settings`.
2. Missing keys are added with their **default value** from this template.
3. Existing keys keep their **current value** — never overwritten.
4. The **order** of keys follows this template — existing values are reordered to match.
5. Comments from the template are preserved in the output.

## Adding new settings

When adding a new setting:

1. Add the key with its default value to the template block above.
2. Add a row to the Settings Reference table.
3. Update the relevant skill or command that reads this setting.
4. The next time `/config-agent-settings` runs, it will add the new key automatically.

