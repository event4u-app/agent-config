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
- NEVER include version numbers, target releases, deprecation dates, release-tied milestones, or git tags in roadmaps, plans, tickets, or any planning artifact. Roadmaps plan **work**; releases / tags are a separate decision. User pins by saying so explicitly.
- Task seems to need a separate branch / PR → STOP and **brief before asking** ([`scope-mechanics § Brief-before-asking`](../contexts/authority/scope-mechanics.md)).
- BEFORE the first commit on related work, **inventory** existing branches and open PRs. Plausible base beyond the current branch → STOP and ask with numbered options — never improvise. Commands + 4-option template + diverging-stack failure mode: [`scope-mechanics § Branch-base inventory`](../contexts/authority/scope-mechanics.md).

"Explicit permission" = user said so **this turn or in a standing instruction not yet revoked**. Earlier permission for a different operation does not carry over.

## Production, infrastructure, bulk-destructive — Hard Floor

A subset is **never** autonomous, regardless of standing autonomy. Canonical: [`non-destructive-by-default`](non-destructive-by-default.md). Triggers (prod-branch merges, deploys, prod data / infra, bulk-destructive) + this-turn-only clarification: [`scope-mechanics § Production, infrastructure, bulk-destructive`](../contexts/authority/scope-mechanics.md).

## Kernel-rule edits — slow-rollout guarantee

Each kernel-rule edit ships in **its own PR**, ≥ 24 h between merges. Autonomous mandate does NOT lift this — soak guarantee, not preference. CI fails > 1 kernel rule per PR unless labeled `bundled-always-rules-acknowledged`. Trigger / scope: [`kernel-rule-edits`](../contexts/authority/kernel-rule-edits.md).

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR creation, tag/release, separate worktree, version pinning), do **not** raise it again on the same task. Decline stands until reopened. Timing: [`scope-mechanics § Decline = silence`](../contexts/authority/scope-mechanics.md).

## Fenced step — user-set review gates

User explicitly fences off the next step (*"plan only"*, *"review first"*, *"don't implement yet"*, German equivalents) — reply is **deliverable + handoff**, never deliverable + *"shall we start?"*.

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO NUMBERED OPTION OFFERING TO BEGIN WORK.
NO "READY TO IMPLEMENT?" RE-ASK.
NO "STARTEN WIR MIT PHASE 1?" PIVOT.
```

Fence stands until reopened (like `Decline = silence`). Follow-ups cover **the deliverable** (scope, wording, sections), never its execution. Failure modes + bypass phrases: [`scope-mechanics § Fenced step`](../contexts/authority/scope-mechanics.md).
