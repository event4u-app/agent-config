---
type: "always"
description: "Always analyze before acting. Prefer targeted inspection, tests, and real verification over guessing or trial-and-error."
alwaysApply: true
source: package
---

# think-before-action

- Always analyze before coding or modifying anything
- Never guess behavior — verify using code, data, or tools
- Prefer targeted inspection over brute-force trial-and-error
- Use efficient tooling (e.g. jq, debugger, logs) instead of loading full data
- Always verify results after changes (API calls, UI tests, etc.)
- When behavior can be defined, prefer test-first or test-driven work
- If requirements are unclear, ask a precise clarification question instead of making hidden assumptions
- Refactors must preserve behavior, validation, examples, and anti-failure guidance unless there is an explicit reason to change them

## Open files are context, not intent

The editor may report that the user has a file open. This is **background context only** —
it does NOT mean the user's message is about that file.

- **The user's message determines intent** — not which file is open.
- A user can have `README.md` open and type `/compress` — the intent is to compress, not to discuss the README.
- A user can have `UserController.php` open and ask "how do tests work?" — the intent is testing, not the controller.
- Only treat the open file as relevant when the user's message explicitly references it
  (e.g., "fix this file", "what does this do?", "update the open file").

If analysis is skipped → results are unreliable.
