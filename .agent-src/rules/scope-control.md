---
type: "always"
tier: "safety-floor"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
source: package
load_context:
  - ../contexts/authority/scope-mechanics.md
  - ../contexts/authority/kernel-rule-edits.md
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
- NEVER pin versions, release targets, deprecation dates, or git tags in roadmaps / plans / tickets — they plan **work**, not releases. Detail: [`scope-mechanics § Roadmap shape`](../contexts/authority/scope-mechanics.md).
- Task seems to need a separate branch / PR → STOP and **brief before asking** ([`scope-mechanics § Brief-before-asking`](../contexts/authority/scope-mechanics.md)).
- BEFORE the first commit on related work, **inventory** existing branches and open PRs. Plausible base beyond the current branch → STOP and ask with numbered options — never improvise. Commands + 4-option template + diverging-stack failure mode: [`scope-mechanics § Branch-base inventory`](../contexts/authority/scope-mechanics.md).

"Explicit permission" = user said so **this turn or in a standing instruction not yet revoked**. Earlier permission for a different operation does not carry over.

## Authoring vs. implementation

```
"CREATE / DRAFT" AUTHORIZES THE ARTIFACT, NOT ITS EXECUTION.
NEW TASK NEVER INHERITS PRIOR AUTONOMY.
```

`create / draft / write / erstelle …` → artifact only. Execution verbs flip scope; mixed → ask. Detail: [`scope-mechanics`](../contexts/authority/scope-mechanics.md).

## Production, infrastructure, bulk-destructive — Hard Floor

A subset is **never** autonomous, regardless of standing autonomy. Canonical: [`non-destructive-by-default`](non-destructive-by-default.md). Triggers (prod-branch merges, deploys, prod data / infra, bulk-destructive) + this-turn-only clarification: [`scope-mechanics § Production, infrastructure, bulk-destructive`](../contexts/authority/scope-mechanics.md).

## Kernel-rule edits — slow-rollout guarantee

Own PR, ≥ 24 h between merges. Autonomous mandate does not lift — soak guarantee. CI / labels / scope: [`kernel-rule-edits`](../contexts/authority/kernel-rule-edits.md).

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR creation, tag/release, separate worktree, version pinning), do **not** raise it again on the same task. Decline stands until reopened. Timing: [`scope-mechanics § Decline = silence`](../contexts/authority/scope-mechanics.md).

## Fenced step — user-set review gates

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO "READY TO IMPLEMENT?" / "PHASE 1?" RE-ASK.
```

Fence (*"plan only"*, *"review first"*, German equivalents) stands until reopened — like `Decline = silence`. Follow-ups cover the deliverable, not its execution. Failure modes + bypass: [`scope-mechanics § Fenced step`](../contexts/authority/scope-mechanics.md).
