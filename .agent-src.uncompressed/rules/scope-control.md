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

## Production, infrastructure, bulk-destructive — Hard Floor

A subset of the operations above is **never** autonomous and never
auto-permitted by a standing autonomy directive. Canonical rule:
[`non-destructive-by-default`](non-destructive-by-default.md). It is
restated here so this file remains the single read for git/scope
concerns:

- **Production-branch merges** — `main`, `master`, `prod`,
  `production`, `release/*`, or any branch the project marks as
  deployment trunk. Always ask, even when the roadmap step says
  "merge".
- **Deploys / releases** — `terraform apply` / `kubectl apply` on
  prod, deploy scripts, release commands, tag pushes that trigger
  CI deployment. Always ask.
- **Production data / infrastructure** — prod DB writes or
  migrations, prod config edits, secrets rotation, IAM / role /
  policy changes, DNS edits, anything in a `prod`-scoped path or
  pipeline. Always ask.
- **Bulk-destructive ops** — wildcard or directory deletion
  (`rm -rf <dir>`, `git rm -r`), `DROP TABLE`, `TRUNCATE`,
  `git reset --hard` past unpushed work, mass class / module /
  migration deletion, "delete everything matching X". Always ask.

A roadmap step or earlier turn does **not** count as authorization
for these. Authorization is "the user said so on this turn".

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

## Fenced step — user-set review gates

When the user explicitly fences off the next step — *"don't implement
yet"*, *"plan only"*, *"just write the roadmap, I'll review"*,
*"review first"*, *"erst Roadmap, ich schau drüber"*, *"nichts
implementieren"*, *"nur planen"*, *"erstmal nur X, dann ich"* — the
agent's reply is **the deliverable plus a handoff**, never the
deliverable plus *"shall we start?"*.

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO NUMBERED OPTION OFFERING TO BEGIN WORK.
NO "READY TO IMPLEMENT?" RE-ASK.
NO "STARTEN WIR MIT PHASE 1?" PIVOT.
```

The fence stands until the user reopens the topic themselves, exactly
like `Decline = silence` above. Permitted follow-up questions on the
same turn cover **the deliverable** (adjust scope, fix wording, add a
section), never **its execution**.

Failure modes:

- Numbered-options block whose Option 1 is *"start with Phase 1 / E1.1
  / step X"*. The fence makes execution off-limits; offering it as the
  default choice violates the fence.
- Re-asking *"may I begin now?"* after delivering the plan. The user
  said no execution; that decision is binding for the rest of the
  task.
- Treating delivery as a hand-off **to execution** (*"roadmap is
  ready, kicking off E1.1"*) instead of a hand-off **to review**
  (*"roadmap is ready, over to you"*).
- Inferring *"plan accepted"* from a thumbs-up or short
  acknowledgement. Acceptance of the plan is not authorization to
  start; the user gives the green light explicitly when ready.

Bypass: a clear *"go ahead"*, *"start now"*, *"mach weiter"*, or an
explicit *"approved, implement E1.1"* on a later turn lifts the fence.
Until then: silence on execution.
