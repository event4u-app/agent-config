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
# obligation: line 31
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

> **Enforced by:** [`scripts/session_canary_hook.ts`](../../scripts/session_canary_hook.ts),
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

**What that fixed, stated because it was measured.** Conformance audit, 30
sessions, 2026-08-06, under session-scope-only injection: opening canary dropped
on ~13 of 15 task starts, often present only in the closing summary, twice
carrying a name the settings chain did not resolve; the honesty clause fired
zero times. The frequency join in `check_enforcement_coverage.ts` now reports the
carrier as covering the obligation — which is a claim about firing, not about
compliance.

**What the second audit found: the carrier fires and compliance did not
follow.** Conformance round 5, 2026-08-07, reading the five highest-turn
sessions with the carrier bound per turn: opening canary dropped on **24 of 29**
task starts, the honesty clause fired **0** times, and the wrong name was
emitted **twice** — "Mathias", which resolves from no layer of the chain
(`identity.name` is `Matze`, `git config user.name` is `matze4u`), i.e. inferred
from the ambient environment rather than read from settings. 24/29 against the
earlier 13/15 is not a fall, and the two windows are not identical, so they are
stated side by side rather than as a trend — but nothing here supports the claim
that the miss rate moved. A reminder in context is therefore not a mechanism for
this obligation: at higher frequency it is the same request, more often.

**What the next mechanism has to be.** Not another injection. It has to be able
to **refuse** — a check at delivery (`stop` is block-capable on this host, so a
refused turn-end continues in the same turn) that rejects a task-start reply
carrying no greeting. Proposed, not shipped; until it is, this obligation is
model-carried in practice, whatever the frequency join reports.

**Round 7 downgrade: that proposed mechanism is UNDECIDABLE as written, and the
obligation splits into a measured half and an unmeasurable one.** A *task* start
is recorded nowhere in a transcript — there is no task event on any host, and
`user-interrupt-priority`'s continuation/clarification/interrupt distinction is a
judgement, not a field. So a delivery check "that rejects a task-start reply" has
no way to know a task started. The proposal is not merely unbuilt; as specified it
cannot be built, and saying "proposed, not shipped" implied otherwise.

What IS decidable is the per-**session** instance, and it was measured rather than
asserted — reproducibly, which took a correction: the probe resolves the name
through the same settings layers this rule names and REFUSES when no layer carries
one, so the figure below is reproduced with the name passed explicitly
(`./scripts-run src/scripts/probe_session_canary --limit 30 --name <your name>`;
the first version hardcoded a maintainer's nickname as its default, which made the
number irreproducible for anyone else and silently read 0 %). Over 30 sessions on
2026-08-12: the opening greeting is present in **25 of 28** sessions carrying
assistant prose (89.3 %), and in **24 of 25** post-carrier (96.0 %). Of the three
misses, two predate the carrier (2026-07-21, 2026-07-29) and one is a session whose
first thirty turns were tool calls.

Both halves of that are load-bearing. The carrier works exactly where it has a
slot — `session_start` — which is why the session-scope figure is high; and the
24-of-29 task-start figure above is not contradicted by it, because the two count
different events. The honest statement is therefore: **session-scope compliance is
measured and good; task-scope compliance is unmeasured and unmeasurable with
today's transcript, and no gate can change that until a task boundary is recorded
somewhere.** Do not read the 96 % as covering the obligation as a whole.

**The wrong-name half needs nothing, and that is worth stating.** The beat
already carries the resolved value — `build_canary_reminder` emits
`Canary active for "<name>"`, and the hook no-ops when no layer resolves a name —
and both wrong-name occurrences predate it: 2026-08-04, where the per-turn beat
landed 2026-08-06. The inference path they measure is already closed, so a third
audit should not re-open it.

**Two declared gaps, neither papered over.** On **Augment** there is no
`user_prompt_submit` slot; its `stop` fires *after* the reply, so injecting
there could not shape the reply the reminder is for, and counting it would be
exactly the over-credit the frequency audit exists to remove. Augment therefore
reports as an open gap rather than as covered. **Copilot** carries no binding from this
package at all — this rule is the only carrier there; re-read it when the trigger fires.

## See also

- [`direct-answers`](direct-answers.md) — canonical reply-close obligation.
- [`context-hygiene`](context-hygiene.md) — what to do when degradation shows.
- [`language-and-tone`](language-and-tone.md) — the greeting mirrors the user's language.
