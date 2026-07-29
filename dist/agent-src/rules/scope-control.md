---
type: "always"
tier: "safety-floor"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
load_context:
  - ../contexts/authority/scope-mechanics.md
  - ../contexts/authority/kernel-rule-edits.md
workspaces: [engineering]
packs: [engineering-base]
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
- NEVER pin versions, release targets, deprecation dates, or git tags in roadmaps / plans / tickets — they plan **work**, not releases. Detail: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).
- Task seems to need a separate branch / PR → STOP and **brief before asking** ([`scope-mechanics`](../contexts/authority/scope-mechanics.md)).
- BEFORE the first commit on related work, **inventory** existing branches + open PRs; plausible other base → STOP, ask with numbered options. Commands + 4-option template: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).

"Explicit permission" = said **this turn or in an unrevoked standing instruction**. Permission for one operation never carries to another.

## Authoring vs. implementation

```
"CREATE / DRAFT" AUTHORIZES THE ARTIFACT, NOT ITS EXECUTION.
NEW TASK NEVER INHERITS PRIOR AUTONOMY.
ARTIFACT SAVED → HARD STOP. NEVER AUTO-OFFER EXECUTION.
```

`create / draft / write / erstelle …` → artifact only. Execution verbs flip scope; mixed → ask. The moment the artifact lands (roadmap, ADR, plan, pitch, ticket), the turn ends — never auto-offer execution. Execution requires an explicit execution verb (`implement`, `build`, `start`, `arbeite ab`) on a later turn. Detail + anti-pattern catalogue: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).

## Production, infrastructure, bulk-destructive — Hard Floor

A subset is **never** autonomous. Canonical: [`non-destructive-by-default`](non-destructive-by-default.md); triggers + this-turn-only clarification: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).

## Kernel-rule edits — slow-rollout guarantee

Own PR, ≥ 24 h between merges; autonomous mandate does not lift (soak guarantee). CI/labels/scope: [`kernel-rule-edits`](../contexts/authority/kernel-rule-edits.md).

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR, tag/release, worktree, version pinning), do **not** raise it again on the same task — decline stands until reopened. Timing: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).

## Fenced step — user-set review gates

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO "READY TO IMPLEMENT?" / "PHASE 1?" RE-ASK.
```

Fence (*"plan only"*, *"review first"*, DE equivalents) stands until reopened. Follow-ups cover the deliverable, not its execution. Failure modes + bypass: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).
