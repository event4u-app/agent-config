---
name: config-agent-settings
description: Create or update .agent-settings.yml — syncs with template, preserves existing values, adds new defaults
skills: [file-editor]
disable-model-invocation: true
---

# /config-agent-settings

Creates or updates `.agent-settings.yml` in the project root by syncing with the
template in `.augment/templates/agent-settings.md`. Both files are YAML with the
same section layout (`personal`, `project`, `github`, `eloquent`, `pipelines`,
`subagents`).

If a **legacy** flat `.agent-settings` (key=value) is present, `scripts/install`
migrates it to `.agent-settings.yml` automatically (with backup). This command
assumes migration has already happened.

## Steps

### 1. Read the template

Read `.augment/templates/agent-settings.md` and extract the YAML block (between
the ` ```yaml ` markers). Parse it into a nested mapping preserving section
order and comments.

### 2. Read existing settings (if any)

Read `.agent-settings.yml` from the project root. If a legacy `.agent-settings`
(key=value, no `.yml`) is present, stop and tell the user to run
`scripts/install` first — do not re-implement the migration here.

### 3. Merge settings (section-aware)

For each section in the template (in template order):

- Keep the section header and its comments verbatim from the template.
- For each key under the section:
  - **Key exists in user's file** → use the user's current value.
  - **Key missing** → use the template default.
- **Unknown sections/keys** the user has added → preserve at the end of the
  section (or in a trailing `_user:` block if no matching section exists).

Invariants:
- Template section **order** always wins.
- Existing scalar values are **never overwritten**.
- New keys added to the template land with their default value.
- Comments from the template always replace user comments in the same position
  (comments are documentation, not user data).

### 4. Write the file

Write the merged YAML to `.agent-settings.yml` with 2-space indentation and no
trailing whitespace.

### 5. Show diff

If the file already existed, show what changed in YAML dotted-key notation:

```
✅  .agent-settings.yml updated!

Added:
  + project.pr_comment_bot_icon: true   (new setting, default applied)

Unchanged:
  personal.ide: phpstorm
  personal.open_edited_files: true
```

If the file was created fresh:

```
✅  .agent-settings.yml created!

Settings (all defaults applied):
  personal.ide: ""
  personal.open_edited_files: false
  project.pr_comment_bot_icon: false

Run /config-agent-settings again to change values, or edit .agent-settings.yml directly.
```

### 6. Interactive setup for empty values

If any required setting has an empty value (e.g. `personal.ide: ""`), offer to
configure it:

```
> `personal.ide` is empty. Which IDE do you use?
>
> 1. VS Code (code)
> 2. PhpStorm (phpstorm)
> 3. Cursor (cursor)
> 4. Skip — I'll set it later
```

For `personal.ide`, also try auto-detection first:

```bash
ps aux | grep -iE '(Visual Studio Code|Code Helper|phpstorm|cursor)' | grep -v grep
```

- If detected → confirm with the user before setting.
- If not detected → ask.

### 7. Verify IDE command

If `personal.ide` was set and `personal.open_edited_files: true`, verify the CLI
command works:

```bash
{ide} --version 2>/dev/null
```

Warn if it fails and suggest how to install the CLI.

## Rules

- **Do NOT commit `.agent-settings.yml`** — it's in `.gitignore`.
- **Never overwrite existing values** — only add missing keys with defaults.
- **Always use template section order** — reorder keys to match the template.
- **Template is the source of truth** for which keys exist and their defaults.
- **Legacy migration is `scripts/install`'s job**, not this command's. If a flat
  `.agent-settings` file is still present, ask the user to run `scripts/install`
  and stop.
