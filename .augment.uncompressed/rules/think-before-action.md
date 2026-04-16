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

If analysis is skipped → results are unreliable.
