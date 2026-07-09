---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Spotted an issue while working (security gap, missing test, bad code, duplication, stale version-idiom) — never ignore it; fix small+aligned inline, ask on bigger, propose a follow-up PR when there are many"
triggers:
  - intent: "spotted an unrelated issue while working"
  - intent: "found legacy or duplicated code"
  - keyword: "refactor"
  - keyword: "duplicate"
  - keyword: "legacy"
  - keyword: "deprecated"
  - keyword: "modernize"
  - keyword: "upgrade"
  - keyword: "cleanup"
  - keyword: "technical debt"
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

## The ladder — classify, then act

### Fix now (autonomous, inline) — a bounded amendment to `minimal-safe-diff`

Allowed **only** when ALL hold — this is the testable "small + task-aligned" definition:
- **Same request path / module** as the current task (not an unrelated feature).
- **≤ ~10 changed lines**, single file, no cross-file ripple.
- **No public-API / response-shape change**, no new parameter.
- **No dependency bump, no migration, no data change.**
- **Its verification ships in the same commit** — e.g. the security fix's negative test, or the correctness fix's case.

Under those constraints the fix is auditable in the same diff and is *not* scope creep — it corrects a boundary the agent touched. Anything outside them → the fix is **note + ask**, never auto. (`minimal-safe-diff` still governs everything else: no reformatting, no opportunistic refactor, no drive-by rename.)

### Note + ask (batched)

Bigger, or diverges from the task → do **not** refactor inline, do **not** interrupt the flow. Note the site (file:line + the issue). Surface the batch as **one** numbered-options prompt (per `user-interaction`, one recommendation line) **after the task is delivered** — or mid-work only when the flow makes it natural. Each option must carry a real trade-off (`no-cheap-questions`). Refactor only on an explicit yes, as a separate scoped change (`scope-control`, `downstream-changes`).

### Propose a follow-up PR (many spots)

When the issues are too many to fold in without blowing the current diff's scope, propose **one or more separate follow-up PRs** (or a roadmap under `agents/roadmaps/`, using the shared-prefix convention) so the user reviews the changes before merge. Creating the PR/roadmap is **permission-gated** — propose, get a yes, then create (`scope-control`, `commit-policy`).

## Version-gated modernization

Update stale idioms to the version the project **actually runs** — but only when that version is **verified**:
- **Establish the version first** from the manifest constraint (`composer.json` `require`, `package.json` `engines`, `.tool-versions`, lockfile) — use the **lowest** bound; on an ambiguous/monorepo range, ask once. **Unknown version → do not touch** (must fit the project structure — this is the `source-discovery` gate).
- **Syntax-only, behavior-preserving idioms** (e.g. `array()` → `[]`, `isset($x)?$x:$d` → `$x ?? $d`, string concat → template) that are provably equivalent → treat as a small fix (auto per the ladder).
- **Behavioral changes** (`readonly`/typed properties, new language semantics) and **any dependency/version bump** → **ask only**, never auto (a version bump stays under `minimal-safe-diff`'s no-dependency-bump prohibition; a pure syntax idiom is categorically different).

## Live-security carve-out (priority)

A **live cross-user / cross-tenant data exposure** (per `broken-access-control`) is not a "note for later": it is a potential GDPR-notifiable breach (Art. 33, 72 h from discovery). If it meets the fix-now bar → fix it now with its negative test. If not → **stop and surface it immediately** (a safety surface, visible even under an autonomous mandate — like the `no-pr-progress-comments` safety carve-out). Never defer it silently, never look away.

## Guardrails — don't become a nagging machine

- Subordinate to `no-cheap-questions` (self-check items 3 & 14 — real trade-off, not a disguised continuation/commit ask), `autonomous-execution` (the end-of-session batch must not read as "shall I continue?"), `user-interaction`, `ask-when-uncertain` (one batched prompt = one question).
- Threshold to surface at all: a **real, nameable** improvement with a concrete benefit. Cosmetic nitpicks with no trade-off → drop silently. The live-security carve-out is the only case that interrupts or overrides autonomy.

## When it fires

While implementing/modifying code you pass an issue outside the literal task. Also on explicit "clean this up / modernize / dedupe".

## When NOT to fire

- No issue spotted. Prose/docs-only. The user fenced the scope ("just this one line").
- The issue is the task itself — then it's just the task (no ladder needed).

## See also

- [`minimal-safe-diff`](minimal-safe-diff.md) — the carve-out above is bounded by it; everything outside the five conditions stays note+ask.
- [`broken-access-control`](broken-access-control.md) — the security category + the live-exposure carve-out.
- [`prefer-enums-over-literals`](prefer-enums-over-literals.md) — an instance of this ladder (enum literals).
- [`source-discovery-gate`](source-discovery-gate.md) — establishing the verified project version before modernizing.
- [`scope-control`](scope-control.md), [`commit-policy`](commit-policy.md) — PR/commit creation stays permission-gated.
- [`improve-before-implement`](improve-before-implement.md) — the pre-work challenge (before); this is the during/after remediation.
