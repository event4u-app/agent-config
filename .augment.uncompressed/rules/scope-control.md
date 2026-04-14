---
type: "always"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
---

# Scope Control

- Do NOT introduce architectural changes unless explicitly requested.
- Do NOT replace existing patterns with alternatives.
- Do NOT refactor existing code solely to comply with current rules.
- Do NOT suggest new libraries unless explicitly requested.
- Existing code should only be modified if directly related to the current change, required for bug fixes, security, or explicitly requested.
- New or newly modified code MUST follow all coding rules.
- Stay within the established project structure and conventions.
- When unsure about the scope, ask the user.
- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
