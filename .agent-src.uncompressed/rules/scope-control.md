---
type: "always"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
source: package
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

## Git operations — permission-gated

The user decides the git shape of the work. Never improvise.

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create a new branch, switch to a different branch, or delete a
  branch without explicit user permission. This includes spike, scratch,
  throwaway, and worktree branches.
- NEVER create, close, reopen, or change the target of a pull request
  without explicit user permission.
- NEVER push a tag or create a release without explicit user permission.
- If a task seems to *need* a separate branch or PR (spike, hotfix,
  experiment, worktree), STOP and **brief the user before asking**. The
  brief MUST cover, in this order:
  1. **Why** — what problem a separate branch solves that the current
     branch cannot; why staying on the current branch would be worse.
  2. **What** — exactly what you plan to do on the new branch: files
     touched, prototypes built, experiments run, expected duration.
  3. **How it continues** — the return path: merge back, cherry-pick,
     throwaway delete, PR target, how the current branch's state is
     protected while you work on the other one.
  Then present numbered options (`user-interaction`) with "stay on the
  current branch" as the default. The user decides. Do not branch
  first and explain later.

"Explicit permission" means the user said so **in this turn or in a
standing instruction they have not revoked**. Earlier permission for a
different operation does not carry over.
