---
type: "auto"
tier: "2a"
consequence_class: "authority-bypass"
description: "personal.canary_name set — open every new task by name (liveness canary); keep the reply-close markers alive (ONE end-summary, PR URL last)"
alwaysApply: false
load_context:
  - contexts/execution/session-canary-enforcement-history.md
triggers:
  - keyword: "canary"
  - keyword: "canary_name"
  - phrase: "session canary"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "hook:session-canary"
# obligation: line 33
obligation_frequency: "per-task"
# frequency-override: the per-turn phrases in the body describe the CARRIER
# (a per-turn beat is the closest reachable cover for a per-task obligation),
# not the obligation itself, which is still the first reply of each new task.
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

## Enforcement — per turn, which is the closest reachable cover for per task

> **Enforced by:** `src/scripts/session_canary_hook.ts`,
> bound in **two** slots. `session_start` injects the full `<session-canary>`
> contract once, so a fresh conversation cannot start without it.
> `user_prompt_submit` injects a one-line beat every turn, which is what
> actually reaches a task boundary. Both bindings are manifest facts; whether
> they are live on this install is `agent-config hooks:status`.

**Why two slots, and why not one.** The obligation is per *task*. No host has a
per-task slot — Cline maps `TaskStart`/`TaskResume` onto `session_start`, and
Claude Code has no task event at all — so "move the carrier to the right slot"
was never available. Per-turn is a strict superset of per-task and is reachable,
which is the whole argument: over-firing a greeting is a visible, cheap failure;
under-firing is the silent one. The full contract stays at session scope because
re-injecting ~800 characters every turn would buy the same coverage at roughly
40× the tokens over a long session.

Four dated conformance audits stand behind those two slots — what the session-scope carrier fixed, what the second audit measured when it did not follow, why the proposed delivery check is undecidable as written, and the per-session figure that replaced it. They are the record, not the obligation, and live in
`contexts/execution/session-canary-enforcement-history.md`,
named in `load_context` above so a session that reaches this rule can open them.

**Two declared gaps, neither papered over.** On **Augment** there is no
`user_prompt_submit` slot; its `stop` fires *after* the reply, so injecting
there could not shape the reply the reminder is for, and counting it would be
exactly the over-credit the frequency audit exists to remove. Augment therefore
reports as an open gap rather than as covered. **Copilot** carries no binding here —
this rule is the only carrier there; re-read it when the trigger fires.

## See also

- [`direct-answers`](direct-answers.md) — canonical reply-close obligation.
- [`context-hygiene`](context-hygiene.md) — what to do when degradation shows.
- [`language-and-tone`](language-and-tone.md) — the greeting mirrors the user's language.
