---
name: file-editor
description: "Use when opening edited files in the user's IDE. Reads settings from .agent-settings.yml to determine IDE and whether auto-open is enabled."
source: package
execution:
  type: assisted
  handler: shell
  allowed_tools: []
---

# file-editor

## When to use

This skill applies **automatically** whenever:
- The agent creates or edits a file using `save-file` or `str-replace-editor`
- The agent wants to show the user a file they should review

Do NOT use when:
- Only reading files (no edits)
- Running commands or tests
- The `personal.open_edited_files` setting is `false`

## Procedure: Open files in IDE

1. **Read settings** — Check `personal.open_edited_files` and `personal.ide` in `.agent-settings.yml`.
2. **Skip if disabled** — If `personal.open_edited_files` is `false`, do nothing.
3. **Open files** — Use the IDE CLI command to open each edited file.
4. **Verify** — Confirm the command succeeded (exit code 0).

## Settings file

Settings are stored in `.agent-settings.yml` (project root, git-ignored).
See `.augment/templates/agent-settings.md` for the full settings reference.

Relevant settings for this skill:

| Key | Values | Default | Description |
|---|---|---|---|
| `personal.ide` | `code`, `phpstorm` | _(empty)_ | CLI command to open files |
| `personal.open_edited_files` | `true`, `false` | `false` | Whether to auto-open edited files |

## Behavior

### 1. Read settings

At the start of a conversation (or on first file edit), read `.agent-settings.yml`:

```bash
cat .agent-settings.yml 2>/dev/null
```

- If the file doesn't exist → **do not open files**. Suggest running `scripts/install` (then `/onboard`).
- If `personal.open_edited_files: false` → do nothing.
- If `personal.open_edited_files: true` and `personal.ide` is set → open files after edits.

### 2. Open files after edits

After editing one or more files, open them using the `ide` setting.
**Always jump to the first edited line.** The syntax depends on the IDE:

**PhpStorm** (`personal.ide: phpstorm`):
```bash
phpstorm --line {line} {file}
```

**VS Code** (`personal.ide: code`):
```bash
code -g {file}:{line}
```

For multiple files, run one command per file:
```bash
# PhpStorm
phpstorm --line 42 app/Models/User.php
phpstorm --line 15 app/Services/UserService.php

# VS Code
code -g app/Models/User.php:42
code -g app/Services/UserService.php:15
```

If the line number is unknown (e.g. new file), omit the line parameter:
```bash
phpstorm app/Models/User.php
code app/Models/User.php
```

### Rules

- **Batch opens** — collect all files from a single logical edit operation and open them as one batch (one IDE command per file).
- **No duplicates** — don't open the same file twice in one batch.
- **Silent on failure** — if the IDE command fails, log it but don't interrupt the workflow.
- **Never open test output** — don't open files just because they appeared in test results.
- **Only edited files** — only open files the agent actively created or modified, not files that were only read.
- **Respect the setting** — if `personal.open_edited_files: false` or `.agent-settings.yml` doesn't exist, never open files.

## IDE CLI commands

| IDE | Command | Install |
|---|---|---|
| VS Code | `code {file}` | Shell Command: Install 'code' in PATH |
| PhpStorm | `phpstorm {file}` | JetBrains Toolbox CLI or `Create command-line launcher` in PhpStorm |

## Output format

1. Files opened in the configured IDE (if enabled)
2. No output if `personal.open_edited_files` is disabled

## Auto-trigger keywords

- open file
- open in editor
- show in IDE
- file editor settings
- configure IDE

## Gotcha

- Check `.agent-settings.yml` for `personal.open_edited_files` before opening anything — the user may have disabled it.
- Don't open files during batch operations (e.g., fixing 20 PHPStan errors) — only open when specifically relevant.
- PHPStorm sometimes locks files when opening — wait briefly before editing the same file.

## Do NOT

- Do NOT open files without checking `.agent-settings.yml` first.
- Do NOT prompt the user about IDE settings during normal work — suggest `/onboard` (for first-run) or editing `.agent-settings.yml` directly.
- Do NOT open files that were only read, not edited.
- Do NOT open more than 10 files at once — summarize instead.
