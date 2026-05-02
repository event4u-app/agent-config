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

## Production, infrastructure, bulk-destructive — Hard Floor

Subset of the above is **never** autonomous and never auto-permitted
by a standing autonomy directive. Canonical rule:
[`non-destructive-by-default`](non-destructive-by-default.md).
Restated so this file remains the single read for git/scope concerns:

- **Production-branch merges** — `main`, `master`, `prod`, `production`, `release/*`, or any deployment-trunk branch. Always ask, even when the roadmap step says "merge".
- **Deploys / releases** — `terraform apply` / `kubectl apply` on prod, deploy scripts, release commands, tag pushes that trigger CI deployment. Always ask.
- **Production data / infrastructure** — prod DB writes / migrations, prod config edits, secrets rotation, IAM / role / policy, DNS, anything in a `prod`-scoped path or pipeline. Always ask.
- **Bulk-destructive ops** — wildcard or directory deletion (`rm -rf <dir>`, `git rm -r`), `DROP TABLE`, `TRUNCATE`, `git reset --hard` past unpushed work, mass class / module / migration deletion. Always ask.

A roadmap step or earlier turn does **not** count as authorization for
these. Authorization is "the user said so on this turn".

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

## Fenced step — user-set review gates

User explicitly fences off the next step — *"don't implement yet"*,
*"plan only"*, *"review first"*, *"erst Roadmap, ich schau drüber"*,
*"nichts implementieren"*, *"nur planen"* — agent's reply is **the
deliverable + handoff**, never deliverable + *"shall we start?"*.

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO NUMBERED OPTION OFFERING TO BEGIN WORK.
NO "READY TO IMPLEMENT?" RE-ASK.
NO "STARTEN WIR MIT PHASE 1?" PIVOT.
```

Fence stands until user reopens it, exactly like `Decline = silence`.
Permitted follow-ups cover **the deliverable** (adjust scope, fix
wording, add a section), never **its execution**.

Failure modes:

- Numbered-options block whose Option 1 is *"start with Phase 1 / E1.1
  / step X"*. Fence makes execution off-limits; offering it as default
  violates the fence.
- Re-asking *"may I begin now?"* after delivery. Decision is binding
  for the rest of the task.
- Treating delivery as hand-off **to execution** (*"roadmap ready,
  kicking off E1.1"*) instead of hand-off **to review** (*"roadmap
  ready, over to you"*).
- Inferring *"plan accepted"* from a thumbs-up. Acceptance ≠
  authorization to start; user gives green light explicitly.

Bypass: clear *"go ahead"*, *"start now"*, *"mach weiter"*, or
explicit *"approved, implement E1.1"* on a later turn lifts the fence.
Until then: silence on execution.
