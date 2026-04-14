---
name: config-agent-settings
description: "Config Agent Settings"
disable-model-invocation: true
---

# /config-agent-settings

Sync `.agent-settings` with template `.augment/templates/agent-settings.md`.

## Steps

### 1. Read template

Parse `key=value` pairs and `# comment` lines from template block.

### 2. Read existing settings

Parse `.agent-settings` if exists → `{key: value}` map.

### 3. Merge

Per template line (in template order):
- Comments → keep from template
- Key exists in user settings → preserve user value
- Key missing → use template default

### 4. Write the file

Write the merged result to `.agent-settings`.

### 5. Show diff

If the file already existed, show what changed:

```
✅  .agent-settings updated!

Changes:
  + pr_comment_bot_icon=true  (new setting, default applied)

Unchanged:
  ide=phpstorm
  open_edited_files=true
```

If the file was created fresh:

```
✅  .agent-settings created!

Settings (all defaults):
  ide=
  open_edited_files=false
  pr_comment_bot_icon=true

Run /config-agent-settings again to change values, or edit .agent-settings directly.
```

### 6. Interactive setup for empty values

```
> Setting `ide` is empty. Which IDE do you use?
>
> 1. VS Code (code)
> 2. PhpStorm (phpstorm)
> 3. Skip — I'll set it later
```

For `ide`: try auto-detect first (`ps aux | grep -iE '(Visual Studio Code|Code Helper|phpstorm)'`), confirm if found.

### 7. Verify IDE command

If `ide` set + `open_edited_files=true`: `{ide} --version 2>/dev/null`. Warn if fails.

## Rules

- Do NOT commit `.agent-settings` (`.gitignore`)
- Never overwrite existing values
- Template order always applied
- Template = source of truth
