# Agent Settings Template

User-specific agent settings stored in `.agent-settings` (project root, git-ignored).
This file is **not committed** — each developer has their own settings.

## File format

Simple `key=value` format, one setting per line. Lines starting with `#` are comments.

## Template

This block defines the personal and project-level settings that `/config-agent-settings`
(and `bin/install.php` via `config/agent-settings.template.ini`) writes to `.agent-settings`.

```
# Agent Settings
# This file is git-ignored. Each developer has their own settings.
# Run /config-agent-settings to create or update this file.

# --- Cost profile ---
#
# Controls which agent surfaces are active. See `docs/customization.md` for
# the authoritative description.
#
# minimal  = rules, skills, and commands only (zero extra surface, default)
# balanced = + runtime dispatcher for skills that declare a shell command
# full     = + tool adapters (GitHub / Jira, read-only, opt-in)
# custom   = ignore profile — every matrix value must be set explicitly
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
| `cost_profile` | `minimal`, `balanced`, `full`, `custom` | `minimal` | Selects which agent surfaces are active. See [Cost profiles](#cost-profiles). |
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

## Cost profiles

The `cost_profile` setting selects which agent surfaces are active. See
`docs/customization.md` for the authoritative description.

| Profile | Description |
|---|---|
| `minimal` | Rules, skills, and commands only. Zero extra surface. Default. |
| `balanced` | + Runtime dispatcher for skills that declare a shell command. |
| `full` | + Tool adapters (GitHub / Jira, read-only, opt-in). |
| `custom` | Ignore profile — every matrix value must be set explicitly. |

The only cross-profile toggle written to `.agent-settings` today is
`skill_improvement_pipeline`. Other per-feature toggles may be added in
future releases; when they land, they ship with a live consumer in code
and get documented here, not before.

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

