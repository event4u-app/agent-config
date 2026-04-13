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

