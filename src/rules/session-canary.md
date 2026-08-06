---
type: "auto"
tier: "2a"
description: "personal.canary_name set — open every new task by name (liveness canary); keep the reply-close markers alive (ONE end-summary, PR URL last)"
alwaysApply: false
triggers:
  - keyword: "canary"
  - keyword: "canary_name"
  - phrase: "session canary"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "hook:session-canary"
collision_ok:
  "canary_name": "this rule owns what the NAME does once set and which of the three layers already supplies it; settings-ask-protocol owns how it is asked for and where the answer goes"
---

# Session Canary

A canary in a coal mine stops singing before the air turns dangerous. This
rule gives the user the same early-warning signal for context degradation:
two small, always-expected reply markers whose **silent disappearance** tells
the user the conversation is degrading and it is time for a fresh session —
long before the agent visibly starts making mistakes.

The canary is a **personal, user-global** concern — the name resolves through
three layers, first non-empty wins: project `.agent-settings.yml` →
`personal.canary_name` (override only) · user-global
`settings/.agent-settings.yml` → `personal.canary_name` · user-global
`settings/.agent-user.yml` → `identity.name` (the name the setup wizard
already collects — never duplicate it per project). No name on any layer →
rule is inert.

## The Iron Law

```
personal.canary_name SET → THE FIRST REPLY OF EVERY NEW TASK OPENS BY
ADDRESSING THE USER BY THAT NAME, AND EVERY WORK REPLY KEEPS THE
REPLY-CLOSE MARKERS ALIVE (ONE END-SUMMARY; PR CREATED/UPDATED THIS TURN
→ RAW URL AS THE LITERAL LAST LINE).
NEVER FAKE CONTINUITY — A DROPPED CANARY IS SURFACED, NOT PAPERED OVER.
```

## The two canaries

1. **Opening canary** — the first reply of the session AND the first reply of
   each new task within it (per the `user-interrupt-priority` task buckets)
   opens by addressing the user by name — one natural mention, in the user's
   language. Intermediate replies of the same task do **not** re-greet.
2. **Closing canary** — the reply-close contract, restated here as a liveness
   marker (canonical: [`direct-answers`](direct-answers.md) Iron Law 3 +
   [`reply-close-mechanics`](../contexts/communication/rules-auto/reply-close-mechanics.md)):
   a work reply ends with ONE compact end-summary, and a PR created or updated
   this turn puts its raw URL as the **literal last line**.

## Honesty clause

If you notice a canary was dropped (a task-start reply without the greeting, a
work reply without its close), do not silently resume as if nothing happened —
name it and suggest a fresh session or `/agent-handoff`, per
[`context-hygiene`](context-hygiene.md).

## When NOT to fire

- No name on any layer (`personal.canary_name` project + user-global, global
  `identity.name`) — fully inert, no greeting.
- Intermediate replies inside an ongoing task (greeting only at task start).
- The greeting never substitutes for substance — it prefixes the answer, it is
  not the answer.

## Enforcement — per session, NOT per task

> **Enforced by:** [`scripts/session_canary_hook.ts`](../../scripts/session_canary_hook.ts)
> (`session_start`, all hook-capable hosts) — injects the `<session-canary>`
> contract block into every new session, so a fresh conversation cannot start
> without it. **Copilot fallback:** no hook surface — this rule is the only
> carrier; re-read it when the trigger fires.

**The gap, stated because it was measured.** The injection fires on
`session_start`; the obligation is per *task*. Nothing re-injects at a task
boundary, so from the second task on the contract is model-carried.

Conformance audit, 30 sessions, 2026-08-06: opening canary dropped on ~13 of 15
task starts, often present only in the closing summary, twice carrying a name
the settings chain did not resolve; the honesty clause fired zero times. No
per-task gate ships — the audit found no harm beyond the lost signal, and a
mechanism for a signal whose absence nobody acted on has no failure mode to
match. The consequence stands: this canary cannot currently be relied on as the
degradation detector its own rationale describes.

## See also

- [`direct-answers`](direct-answers.md) — canonical reply-close obligation.
- [`context-hygiene`](context-hygiene.md) — what to do when degradation shows.
- [`language-and-tone`](language-and-tone.md) — the greeting mirrors the user's language.
