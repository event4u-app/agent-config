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

The editor may report an open file. This is **background context only** — NOT the user's intent.

- **User's message determines intent** — not which file is open.
- User has `README.md` open + types `/compress` → intent is compress, not README.
- User has `UserController.php` open + asks "how do tests work?" → intent is testing, not the controller.
- Only treat open file as relevant when the user explicitly references it ("fix this file", "what does this do?").

If analysis is skipped → results are unreliable.
