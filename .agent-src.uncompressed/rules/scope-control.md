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

> **Commit specifics:** see the canonical [`commit-policy`](commit-policy.md)
> rule — narrower than the general "no git ops without permission"
> below (covers the never-ask-about-committing default and the
> roadmap-authorized exception).

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create a new branch, switch to a different branch, or delete a
  branch without explicit user permission. This includes spike, scratch,
  throwaway, and worktree branches.
- NEVER create, close, reopen, or change the target of a pull request
  without explicit user permission.
- NEVER push a tag or create a release without explicit user permission.
- NEVER include version numbers, target releases, deprecation dates,
  release-tied milestones, or git tags inside roadmaps, plans, tickets,
  or any other planning artifact. Roadmaps plan **work**; releases and
  tags are a separate decision the user makes outside the roadmap.
  Never surface "which release should this ship in?" as an option in
  numbered choices, ADRs, or roadmap text. If the user wants a release
  pinned to a milestone, they will say so explicitly.
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

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR creation,
tag/release entry, separate worktree, version pinning in a roadmap),
do **not** raise the same proposal again on the same task. The decline
stands until the user reopens the topic themselves.

The right moment to ask — at most **once**, only when genuinely useful
— is **before** the work starts (e.g. when writing the roadmap or
opening a ticket), not mid-execution. During roadmap execution the
branch question is settled; do not resurface it step by step.

A proposal that "might be sensible" is not enough reason to ask.
Default: stay on the current branch, no release language. Only ask
when there's a concrete, evidence-based reason (e.g. risky migration
benefits from a spike branch). If in doubt, do not ask.
