---
type: "auto"
description: "When user types a slash command like /create-pr, /commit, or pastes command file content"
alwaysApply: false
source: package
---

# Commands

When the user types a command (`/create-pr`, `# create-pr`, or pastes a command file),
**execute it immediately**. No questions, no opinions, no summaries, no confirmations.

- Match the command file in `.augment/commands/` (or `agents/overrides/commands/`).
- Read it, follow the steps in order.
- Ask only when the command itself says "ask the user".
- If the user pastes the **content** of a command file, treat it as an invocation — not a question.
- **NEVER** respond with "looks good" or ask "shall I execute?" — just execute.
- **NEVER** respond with "this is the current version" or "do you want to change something?" — just execute.
- **NEVER** treat pasted command content as a review request — it's ALWAYS an invocation.
- The only exception: the user's message contains an explicit instruction about the command
  (e.g., "update this command" or "review this command"). In that case, follow the instruction instead.

## Open files are irrelevant for command detection

The editor may report that the user has a file open (e.g., "The user has file `compress.md` open").
This is **irrelevant** for command detection.

- If the user types `/compress`, they want to **run** the compress command — even if `compress.md` is open in the editor.
- If command file content appears in the context alongside an open file, the **command invocation takes priority**.
- Do NOT confuse "file is open" with "user wants to discuss this file".
- The user's typed message determines intent — not editor state.
