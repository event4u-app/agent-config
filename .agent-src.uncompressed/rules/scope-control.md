---
type: "always"
tier: "safety-floor"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
source: package
load_context:
  - contexts/authority/scope-mechanics.md
---

# Scope Control

- Do NOT introduce architectural changes unless explicitly requested.
- Do NOT replace existing patterns with alternatives.
- Do NOT refactor existing code solely to comply with current rules.
- Do NOT suggest new libraries unless explicitly requested.
- Modify existing code only when directly related to the current change, required for bug fixes / security, or explicitly requested.
- New / modified code MUST follow all coding rules.
- Stay within established project structure and conventions.
- When unsure about scope, ask the user.

## Git operations — permission-gated

The user decides the git shape. Never improvise. Commit specifics: canonical [`commit-policy`](commit-policy.md).

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create / switch / delete a branch without explicit permission — includes spike, scratch, throwaway, worktree branches.
- NEVER create, close, reopen, or change the target of a pull request without permission.
- NEVER push a tag or create a release without permission.
- NEVER include version numbers, target releases, deprecation dates, release-tied milestones, or git tags in roadmaps, plans, tickets, or any planning artifact. Roadmaps plan **work**; releases / tags are a separate decision outside the roadmap. Never surface "which release should this ship in?" as a numbered choice. User pins by saying so explicitly.
- Task seems to need a separate branch / PR → STOP and **brief before asking** ([`scope-mechanics § Brief-before-asking`](../contexts/authority/scope-mechanics.md)).

"Explicit permission" = user said so **this turn or in a standing instruction not yet revoked**. Earlier permission for a different operation does not carry over.

## Production, infrastructure, bulk-destructive — Hard Floor

A subset is **never** autonomous and never auto-permitted by a standing autonomy directive. Canonical: [`non-destructive-by-default`](non-destructive-by-default.md). Trigger list (prod-branch merges, deploys / releases, prod data / infra, bulk-destructive ops) and the "authorization is this turn, not earlier" clarification: [`scope-mechanics § Production, infrastructure, bulk-destructive`](../contexts/authority/scope-mechanics.md).

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR creation, tag/release entry, separate worktree, version pinning), do **not** raise it again on the same task. Decline stands until the user reopens the topic. Timing / "is this worth asking?": [`scope-mechanics § Decline = silence`](../contexts/authority/scope-mechanics.md).

## Fenced step — user-set review gates

User explicitly fences off the next step — *"don't implement yet"*, *"plan only"*, *"just write the roadmap, I'll review"*, *"review first"*, *"erst Roadmap, ich schau drüber"*, *"nichts implementieren"*, *"nur planen"*, *"erstmal nur X, dann ich"* — reply is **the deliverable plus a handoff**, never deliverable plus *"shall we start?"*.

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO NUMBERED OPTION OFFERING TO BEGIN WORK.
NO "READY TO IMPLEMENT?" RE-ASK.
NO "STARTEN WIR MIT PHASE 1?" PIVOT.
```

Fence stands until the user reopens, exactly like `Decline = silence`. Permitted follow-up questions cover **the deliverable** (adjust scope, fix wording, add a section), never **its execution**.

Failure-mode catalog (Option 1 = "start now", re-asking after delivery, hand-off-to-execution drift, inferring acceptance from a thumbs-up) and explicit bypass phrases: [`scope-mechanics § Fenced step`](../contexts/authority/scope-mechanics.md).
