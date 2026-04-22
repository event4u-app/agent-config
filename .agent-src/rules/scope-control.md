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

The user decides the git shape of the work.

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create, switch, or delete a branch without explicit user permission.
  Includes spike, scratch, throwaway, worktree branches.
- NEVER create, close, reopen, or retarget a pull request without explicit
  user permission.
- NEVER push a tag or create a release without explicit user permission.
- If a task seems to need a separate branch or PR, STOP and **brief
  first, ask second**. The brief MUST cover, in order:
  1. **Why** — what the new branch solves that the current one cannot.
  2. **What** — files touched, experiments run, expected duration.
  3. **How it continues** — merge back, cherry-pick, throwaway, PR
     target, how the current branch is protected meanwhile.
  Then present numbered options with "stay on current branch" as
  default. User decides. Do NOT branch first and explain later.

"Explicit permission" = the user said so this turn or gave a standing
instruction they have not revoked. Earlier permission for another op
does not carry over.
