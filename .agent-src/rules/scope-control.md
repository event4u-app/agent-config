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

> **Commit specifics:** see [`commit-policy`](commit-policy.md) — narrower
> than the general "no git ops without permission" below (never-ask
> default + roadmap-authorized exception).

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create, switch, or delete a branch without explicit user permission.
  Includes spike, scratch, throwaway, worktree branches.
- NEVER create, close, reopen, or retarget a pull request without explicit
  user permission.
- NEVER push a tag or create a release without explicit user permission.
- NEVER include version numbers, releases, deprecation dates,
  release-tied milestones, or git tags in roadmaps, plans, tickets, or
  any planning artifact. Roadmaps plan **work**; releases are a
  separate user decision. Never surface "which release" as a numbered
  option, ADR field, or roadmap entry. If user wants a release pinned
  to a milestone, they say so explicitly.
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

## Decline = silence — no re-asking on the same task

After a declined proposal (branch switch, PR, tag/release entry,
worktree, version pinning in a roadmap), do **not** raise it again on
the same task. Decline stands until user reopens it.

Right moment to ask — at most **once**, only when genuinely useful —
is **before** work starts (writing roadmap, opening ticket), not
mid-execution. During roadmap execution the branch question is
settled; do not resurface it step by step.

A proposal that "might be sensible" is not enough reason to ask.
Default: stay on current branch, no release language. Only ask with
concrete evidence-based reason (e.g. risky migration → spike branch).
If in doubt, do not ask.
