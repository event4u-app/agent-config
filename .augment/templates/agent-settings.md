# Agent Settings Template

User-specific agent settings stored in `.agent-settings` (project root, git-ignored).
This file is **not committed** — each developer has their own settings.

## File format

Simple `key=value` format, one setting per line. Lines starting with `#` are comments.

## Template

This block defines the personal and project-level settings that `/config-agent-settings`
(and `bin/install.php` via `config/agent-settings.template.ini`) writes to `.agent-settings`.

Matrix values controlled by `cost_profile` (`runtime_enabled`, `observability_reports`, …)
are **not** part of this block — they live in the [Profile matrix](#profile-matrix) below
and only need to appear in `.agent-settings` as explicit overrides.

```
# Agent Settings
# This file is git-ignored. Each developer has their own settings.
# Run /config-agent-settings to create or update this file.

# --- Cost profile ---
#
# Controls token consumption by setting multiple matrix values at once.
# Matrix defaults live in .augment/templates/agent-settings.md — add a key
# below only to override the profile for a single value.
#
# minimal  = zero token overhead — runtime off, no reports, no feedback in chat
# balanced = runtime + local persistence — reports on demand, no auto-read
# full     = everything on — reports auto-read, CI summaries, feedback in chat
# custom   = ignore profile, set every matrix value explicitly below
cost_profile=minimal

# --- Personal preferences ---

# IDE to use for opening files (code, phpstorm, cursor)
ide=

# Automatically open edited files in the IDE (true, false)
open_edited_files=false

# User's first name — used to address the user personally
user_name=

# rtk (Rust Token Killer) installed for output filtering (true, false)
# Agent will auto-detect and ask once, then store the result
rtk_installed=false

# Minimal output mode (true, false)
# true = short bullet points during work, concise summary at the end
# false = verbose explanations and reasoning
minimal_output=true

# Play-by-play mode (true, false)
# true = briefly share intermediate findings as you go
# false = silently investigate, only report the conclusion
play_by_play=false

# --- Project / team preferences ---

# Prefix PR comment replies with a bot icon 🤖 (true, false)
pr_comment_bot_icon=false

# GitHub API method for replying to PR review comments
# replies_endpoint = POST /pulls/comments/{id}/replies (preferred, cleaner threads)
# create_review_comment = POST /pulls/{number}/reviews (fallback)
# auto = detect on first use and update this setting
github_pr_reply_method=create_review_comment

# Eloquent model property access style
# getters_setters = strict typed getters/setters, getAttribute() only inside model
# get_attribute = use getAttribute()/setAttribute() everywhere
# magic_properties = use $model->column_name (Laravel default)
eloquent_access_style=getters_setters

# Path to the PR template file (relative to project root)
pr_template=.github/pull_request_template.md

# Skill improvement pipeline (true, false)
# true = after meaningful tasks, propose learning capture and improvements
# false = silent, no post-task analysis
skill_improvement_pipeline=false

# Target repository for universal improvement PRs (e.g. org/agent-config)
upstream_repo=

# Branch prefix for improvement PRs
improvement_pr_branch_prefix=improve/agent-
```

## Settings Reference

Personal and project-level settings (written by `/config-agent-settings` and `bin/install.php`):

| Key | Values | Default | Description |
|---|---|---|---|
| `cost_profile` | `minimal`, `balanced`, `full`, `custom` | `minimal` | Controls multiple matrix values at once. See [Profile matrix](#profile-matrix). |
| `ide` | `code`, `phpstorm`, `cursor` | _(empty)_ | CLI command to open files in the IDE |
| `open_edited_files` | `true`, `false` | `false` | Auto-open edited files in the IDE after edits |
| `user_name` | first name | _(empty)_ | User's first name. Agent asks on first interaction if empty, then addresses user by name. |
| `rtk_installed` | `true`, `false` | `false` | Whether rtk (Rust Token Killer) is installed. Agent auto-detects once and stores the result. |
| `minimal_output` | `true`, `false` | `true` | When `true`: short bullet points during work, concise summary at end. When `false`: verbose explanations. |
| `play_by_play` | `true`, `false` | `false` | When `true`: share intermediate findings during investigation. When `false`: work silently, report only the conclusion. |
| `pr_comment_bot_icon` | `true`, `false` | `false` | Prefix PR comment replies with 🤖 to indicate bot-authored replies |
| `github_pr_reply_method` | `replies_endpoint`, `create_review_comment`, `auto` | `create_review_comment` | GitHub API method for replying to PR review comments. `auto` detects on first use. |
| `eloquent_access_style` | `getters_setters`, `get_attribute`, `magic_properties` | `getters_setters` | How to access Eloquent model attributes. See `eloquent` skill for details. |
| `pr_template` | file path | `.github/pull_request_template.md` | Path to PR template file. Read this instead of searching for it. |
| `skill_improvement_pipeline` | `true`, `false` | `false` | When `true`: propose learning capture after meaningful tasks. When `false`: silent. |
| `upstream_repo` | `org/repo` | _(empty)_ | Target repository for universal improvement PRs (e.g., `org/agent-config`). |
| `improvement_pr_branch_prefix` | string | `improve/agent-` | Branch prefix for agent improvement PRs. |

Matrix values (not written to `.agent-settings` by default — only as explicit overrides):

| Key | Values | Description |
|---|---|---|
| `runtime_enabled` | `true`, `false` | Enable runtime pipeline (dispatch, execution proposals, hooks). When `false`: zero overhead. |
| `observability_reports` | `true`, `false` | Generate reports, CI summaries, and structured logging from pipeline runs. |
| `feedback_collection` | `true`, `false` | Record execution outcomes and generate improvement suggestions. |
| `runtime_auto_read_reports` | `true`, `false` | When `true`: agent auto-loads reports into context (costs tokens). When `false`: reports only on explicit request. |
| `max_report_lines` | number | Maximum lines per generated report section. Limits token consumption from reports. |
| `minimal_runtime_context` | `true`, `false` | When `true`: only essential runtime metadata in agent context. Saves tokens. |
| `ci_summary_enabled` | `true`, `false` | Generate observability summary as CI artifact or PR comment. |
| `feedback_suggestions_in_chat` | `true`, `false` | When `true`: suggestions appear in chat. When `false`: persist locally only. |

## Cost profiles

The `cost_profile` setting is the single knob for token consumption. It activates a
pre-defined set of matrix values. Individual matrix keys can still be overridden in
`.agent-settings` — set `cost_profile=custom` to disable the profile entirely.

### Profile matrix

| Setting | `minimal` | `balanced` | `full` |
|---|---|---|---|
| `runtime_enabled` | `false` | `true` | `true` |
| `observability_reports` | `false` | `true` | `true` |
| `feedback_collection` | `false` | `true` | `true` |
| `runtime_auto_read_reports` | `false` | `false` | `true` |
| `max_report_lines` | `30` | `50` | `100` |
| `minimal_runtime_context` | `true` | `true` | `false` |
| `ci_summary_enabled` | `false` | `false` | `true` |
| `feedback_suggestions_in_chat` | `false` | `false` | `true` |
| `skill_improvement_pipeline` | `false` | `false` | `true` |

### Profile descriptions

**minimal** (default) — Zero additional token overhead. Runtime dormant, no reports generated,
no feedback collected, no suggestions in chat. Best for daily coding where cost matters most.

**balanced** — Runtime active, data collected and persisted locally. Reports generated on demand
(`task report`) but never auto-loaded into agent context. Good for teams that want observability
without paying per-request token costs.

**full** — Everything active. Reports auto-read, CI summaries on PRs, feedback suggestions in chat,
skill improvement pipeline active. Best for agent infrastructure development or debugging.

### How profiles work

1. Agent reads `cost_profile` from `.agent-settings`.
2. If `cost_profile` is `minimal`, `balanced`, or `full` → apply the matrix defaults above.
3. Keys present in `.agent-settings` **override** the matrix (explicit > profile).
4. If `cost_profile=custom` → the matrix is ignored; every value must be set explicitly.

### Example: balanced with CI summaries

```
cost_profile=balanced
ci_summary_enabled=true    # override: enable CI summaries despite balanced profile
```

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

