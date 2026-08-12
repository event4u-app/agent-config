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
enforced_by:
  - "none"
collision_ok:
  "refactor": "an explicit clean-up/refactor ask is the remediation ladder's own trigger"
# obligation: line 31
obligation_frequency: "per-edit"
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
A NOTE IS NOT A DISCHARGE — THE DECISION IS. AN ISSUE REPORTED IN PROSE AND
NEITHER FIXED NOR PUT TO THE USER IS STILL OPEN, AND STILL YOURS.
THE ASK CARRIES CANDIDATE FIXES AND AN EXPLICIT "LEAVE IT" — NEVER A BARE FLAG.
```

## What to remediate

Security gaps (broken access control, injection, secrets, missing authz — see `broken-access-control`) · missing/weak test coverage · bad code (dead code, silent error-swallow, unguarded edge cases) · **duplication** (the same or near-same logic repeated instead of one method/abstraction) · **stale version-idioms** (code written for an older language/framework version than the project actually runs) · **a failing check you already ran** (below).

## A check you already ran is a spotted issue

An error the tooling put in front of you — a red gate, a failing test, a lint or
type error, a command that no longer runs — is **spotted**, exactly like a defect
you read in a file. It enters the ladder on the same terms. "It was already red
before I got here" is not a tier: pre-existing decides *which* tier, never whether
the ladder applies. Running a command, reading seven errors, and walking past them
is not scoping the work — it is looking away.

Two bounds, both narrow and both load-bearing:

- **Only output you already have.** This never obliges you to go run checks
  hunting for problems; what runs locally stays the user's call and the remote CI
  is the authoritative gate. The trigger is a result already in front of you.
- **Ownership picks the tier, never the silence.** Caused by your diff → it is the
  task, fix it. Pre-existing and inside the fix-now bar → fix it. Pre-existing and
  wider, or many, or unrelated → note + ask, or a follow-up PR. There is no
  seventh option called "mention it in the closing summary".

## The ladder — three tiers

**Fix now** — small + task-aligned; ALL five conditions hold: same request path/module · ≤ ~10 changed lines in one production file (plus its test file) · no public-API / response-shape change · no dependency bump, no migration · verification ships in the same commit. Anything outside → next tier. · **Note + ask** (batched, one numbered-options prompt after delivery) · **Follow-up PR** (many spots; creation stays permission-gated). Per-tier detail + version-gated modernization + guardrails: the mechanics guideline below.

## Every noted issue ends in one of three states

When the task closes, each issue you named is **fixed**, **decided by the user**
(fix later, or ignore — an explicit "leave it" is terminal and is not raised
again, per [`scope-control`](scope-control.md)), or **in front of the user right
now** as the batched ask. Anything else leaves the issue open while sounding like
it was handled — most often a line in the closing summary that reads as a status
report and closes nothing. That line is the failure this rule exists to stop.

An item the user has not decided **survives the turn**: raise it once more at the
next natural task boundary rather than letting it age out of the conversation.
A batch already declined is closed.

## The ask carries fixes, not a flag

"There are 7 lint errors — shall I fix them?" hands the problem back untouched.
Group the findings by fix shape and make each numbered option a candidate the
user can pick without a follow-up question: what changes, where, roughly how
large, what it costs. The last option is always an explicit **leave it as is**,
and one recommendation line names your pick (per
[`user-interaction`](user-interaction.md)).

The ask is subordinate to [`no-cheap-questions`](no-cheap-questions.md) — its
Pre-Send Self-Check runs first, and a finding with no nameable benefit or no real
trade-off is dropped silently instead of becoming a question. What that check
forbids is a content-free ask, never the surfacing of a genuine defect.

## Live-security carve-out (priority)

A **live cross-user / cross-tenant data exposure** (per `broken-access-control`) is not a "note for later": it is a potential GDPR-notifiable breach (Art. 33, 72 h from discovery). If it meets the fix-now bar → fix it now with its negative test. If not → **stop and surface it immediately** (a safety surface, visible even under an autonomous mandate — like the `no-pr-progress-comments` safety carve-out). Never defer it silently, never look away.

## When it fires

While implementing/modifying code you pass an issue outside the literal task. Also on explicit "clean this up / modernize / dedupe".

## When NOT to fire

- No issue spotted. Prose/docs-only. The user fenced the scope ("just this one line").
- The issue is the task itself — then it's just the task (no ladder needed).
- The user already decided this item (fixed later, or explicitly ignored).

## Honest enforcement — `enforced_by: none`

No gate can read a reply and tell a discharged issue from one that was mentioned
and dropped: the note, the ask, and the user's decision are all prose, and the
issue set is whatever the agent happened to see. So this rule ships
`enforced_by: none` — the same honesty boundary
[`security-sensitive-stop`](security-sensitive-stop.md) and
[`ui-audit-gate`](ui-audit-gate.md) state for their own obligations — rather than
naming an adjacent linter that never inspects this behaviour. The ladder is the
control; skipping it is caught by nothing.

Body migrated to [`guideline:agent-infra/active-remediation-mechanics`](../docs/guidelines/agent-infra/active-remediation-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — per-tier fix-now/note+ask/follow-up-PR criteria, version-gated modernization, anti-nagging guardrails.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`minimal-safe-diff`](minimal-safe-diff.md) — the fix-now carve-out is bounded by it; everything outside the five conditions stays note+ask.
- [`broken-access-control`](broken-access-control.md) — the security category + the live-exposure carve-out.
- [`prefer-enums-over-literals`](prefer-enums-over-literals.md) — an instance of this ladder (enum literals).
- [`source-discovery-gate`](source-discovery-gate.md) — establishing the verified project version before modernizing.
- [`scope-control`](scope-control.md), [`commit-policy`](commit-policy.md) — PR/commit creation stays permission-gated.
- [`improve-before-implement`](improve-before-implement.md) — the pre-work challenge (before); this is the during/after remediation.
- [`verify-before-complete`](verify-before-complete.md) — the turn-completion gate: an undecided issue is unfinished work, not a caveat to report.
- [`no-cheap-questions`](no-cheap-questions.md) — the floor the batched ask clears before it is asked at all; the registered pair is `no-cheap-questions-x-active-remediation`.
