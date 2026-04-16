---
name: config-agent-settings
description: Create or update .agent-settings — syncs with template, preserves existing values, adds new defaults
skills: [file-editor]
disable-model-invocation: true
---

# /config-agent-settings

Creates or updates `.agent-settings` in the project root by syncing with the template
in `.augment/templates/agent-settings.md`.

## Steps

### 1. Read the template

Read `.augment/templates/agent-settings.md` and extract the template block (between the ``` markers).
Parse all `key=value` pairs and `# comment` lines in order.

### 2. Read existing settings (if any)

Read `.agent-settings` from the project root (if it exists).
Parse all `key=value` pairs into a map of `{key: value}`.

### 3. Merge settings

For each line in the template (in template order):

- **Comment line** (`# ...`) → keep as-is from template.
- **Key=value line** → check if the key exists in the user's current settings:
  - **Key exists** → use the user's current value (preserve).
  - **Key missing** → use the default value from the template.

This ensures:
- **Template order** is always applied.
- **Existing values** are never overwritten.
- **New keys** get their default value automatically.

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

If any required setting has an empty value (e.g. `ide=`), offer to configure it:

```
> Setting `ide` is empty. Which IDE do you use?
>
> 1. VS Code (code)
> 2. PhpStorm (phpstorm)
> 3. Skip — I'll set it later
```

For `ide`, also try auto-detection first:

```bash
ps aux | grep -iE '(Visual Studio Code|Code Helper|phpstorm)' | grep -v grep
```

- If detected → confirm with the user before setting.
- If not detected → ask.

### 7. Verify IDE command

If `ide` was set and `open_edited_files=true`, verify the CLI command works:

```bash
{ide} --version 2>/dev/null
```

Warn if it fails and suggest how to install the CLI.

## Rules

- **Do NOT commit `.agent-settings`** — it's in `.gitignore`.
- **Never overwrite existing values** — only add missing keys with defaults.
- **Always use template order** — reorder keys to match the template.
- **Template is the source of truth** for which keys exist and their defaults.
