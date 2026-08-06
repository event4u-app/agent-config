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

**The gap this leaves, stated because it was measured.** The injection fires on
`session_start`. The obligation above is *per task* — every new task inside a
live session opens by addressing the user by name. Nothing re-injects at a task
boundary, so from the second task onward the contract is model-carried like any
other prose.

A conformance audit of 30 sessions (2026-08-06) measured the result: the opening
canary was **dropped on roughly 13 of 15 task starts**; where it did fire it was
often only in the closing summary; and on two occasions the emitted name was not
the configured one — the hook resolved `Matze` correctly from the settings chain
and the reply said `Mathias`. The honesty clause below ("if you notice you
dropped it, say so") was invoked **zero** times across the whole sample.

So: the greeting is enforced for the first reply of a session and for nothing
else. That is the honest reach. No per-task gate ships here, because the audit
found no harm from the drop beyond the loss of the signal itself — and inventing
a mechanism for a degradation signal whose absence nobody acted on would be the
mechanism-without-a-failure-mode this repo's own principle forbids. What the
drop *does* mean is that the canary cannot currently be relied on as the
degradation detector its own rationale describes.

## See also

- [`direct-answers`](direct-answers.md) — canonical reply-close obligation.
- [`context-hygiene`](context-hygiene.md) — what to do when degradation shows.
- [`language-and-tone`](language-and-tone.md) — the greeting mirrors the user's language.
