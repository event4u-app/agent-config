---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Spotted an issue (security gap, missing test, bad code, duplication, stale idiom) — never ignore: small→fix inline, bigger→ask, many→follow-up PR"
triggers:
  - keyword: "refactor"
  - keyword: "duplicate"
  - keyword: "legacy"
  - keyword: "deprecated"
  - keyword: "modernize"
  - keyword: "upgrade"
  - keyword: "cleanup"
  - keyword: "technical debt"
routes_to:
  - "guideline:agent-infra/active-remediation-mechanics"
workspaces: [engineering]
packs: [engineering-base]
---

# Active Remediation

The user does not see the code at the spot you are editing — you do. So this package guides the agent to **actively improve** what it touches: don't accept legacy, debt, security gaps, or duplication as given. But active improvement is bounded — it must never become the scope creep `minimal-safe-diff` exists to stop. The rule is a **ladder**: act by size and alignment, and **never silently ignore** a real issue.

## The Iron Law

```
NEVER IGNORE A REAL ISSUE YOU SPOT — AT MINIMUM, NOTE IT.
SMALL + TASK-ALIGNED → FIX IT NOW, IN THE SAME CHANGE, WITH ITS TEST.
BIGGER OR DIVERGENT → NOTE IT, FINISH THE TASK, THEN ASK — NEVER MID-FLOW.
TOO MANY → PROPOSE ONE OR MORE SEPARATE FOLLOW-UP PRs THE USER REVIEWS.
A LIVE SECURITY / DATA-EXPOSURE GAP IS NEVER MERELY "NOTED FOR LATER".
```

## What to remediate

Security gaps (broken access control, injection, secrets, missing authz — see `broken-access-control`) · missing/weak test coverage · bad code (dead code, silent error-swallow, unguarded edge cases) · **duplication** (the same or near-same logic repeated instead of one method/abstraction) · **stale version-idioms** (code written for an older language/framework version than the project actually runs).

## The ladder — three tiers

**Fix now** — small + task-aligned; ALL five conditions hold: same request path/module · ≤ ~10 changed lines in one production file (plus its test file) · no public-API / response-shape change · no dependency bump, no migration · verification ships in the same commit. Anything outside → next tier. · **Note + ask** (batched, one numbered-options prompt after delivery) · **Follow-up PR** (many spots; creation stays permission-gated). Per-tier detail + version-gated modernization + guardrails: the mechanics guideline below.

## Live-security carve-out (priority)

A **live cross-user / cross-tenant data exposure** (per `broken-access-control`) is not a "note for later": it is a potential GDPR-notifiable breach (Art. 33, 72 h from discovery). If it meets the fix-now bar → fix it now with its negative test. If not → **stop and surface it immediately** (a safety surface, visible even under an autonomous mandate — like the `no-pr-progress-comments` safety carve-out). Never defer it silently, never look away.

## When it fires

While implementing/modifying code you pass an issue outside the literal task. Also on explicit "clean this up / modernize / dedupe".

## When NOT to fire

- No issue spotted. Prose/docs-only. The user fenced the scope ("just this one line").
- The issue is the task itself — then it's just the task (no ladder needed).

Body migrated to [`guideline:agent-infra/active-remediation-mechanics`](../docs/guidelines/agent-infra/active-remediation-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — per-tier fix-now/note+ask/follow-up-PR criteria, version-gated modernization, anti-nagging guardrails.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`minimal-safe-diff`](minimal-safe-diff.md) — the fix-now carve-out is bounded by it; everything outside the five conditions stays note+ask.
- [`broken-access-control`](broken-access-control.md) — the security category + the live-exposure carve-out.
- [`prefer-enums-over-literals`](prefer-enums-over-literals.md) — an instance of this ladder (enum literals).
- [`source-discovery-gate`](source-discovery-gate.md) — establishing the verified project version before modernizing.
- [`scope-control`](scope-control.md), [`commit-policy`](commit-policy.md) — PR/commit creation stays permission-gated.
- [`improve-before-implement`](improve-before-implement.md) — the pre-work challenge (before); this is the during/after remediation.
