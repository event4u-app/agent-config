---
type: "auto"
tier: "3"
description: "Questions, options, progress summaries — numbered-options Iron Law, single-recommendation rule"
alwaysApply: false
load_context:
  - contexts/communication/rules-auto/user-interaction-mechanics.md
triggers:
  - keyword: "option"
  - keyword: "recommendation"
  - phrase: "what do you recommend"
  - phrase: "was empfiehlst du"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
---

# User Interaction

Two Iron Laws govern every reply that contains numbered options.
They override conversation momentum, brevity, and the urge to defer
to the user. **Missing a recommendation is a rule violation, not a slip.**

## Iron Law 1 — Single-Source Recommendation

```
EXACTLY ONE LINE NAMES THE RECOMMENDED NUMBER. NO INLINE TAG. NO SECOND PROSE NUMBER.
THE OPTION BLOCK STAYS NEUTRAL. THE RECOMMENDATION LINE IS THE ONLY SOURCE OF TRUTH.
DRIFT BETWEEN OPTION-BLOCK AND PROSE IS STRUCTURALLY IMPOSSIBLE WHEN THE TAG DOES NOT EXIST.
MISSING RECOMMENDATION = RULE VIOLATION, NOT A SLIP.
POSITION-AGNOSTIC. END-OF-TURN MENUS COUNT. NEXT-STEP LISTS COUNT. NO EXCEPTIONS.
THE RECOMMENDATION LINE LIVES DIRECTLY UNDER THE OPTIONS BLOCK. NOWHERE ELSE.
PROSE NAMING A "RECOMMENDED" PATH ABOVE OR BEFORE THE OPTIONS BLOCK = NO RECOMMENDATION.
WRONG-LANGUAGE LABEL (`Recommendation:` WHEN USER IS GERMAN, OR VICE VERSA) = NO RECOMMENDATION.
```

## Iron Law 2 — Pre-Send Self-Check

```
EVERY REPLY WITH NUMBERED OPTIONS RUNS THE SELF-CHECK. NO EXCEPTIONS.
SKIPPING IT IS A RULE VIOLATION, NOT A SLIP.
```

Mechanical backstop:
`./scripts-run src/scripts/check_reply_consistency --stdin < draft.md`
(non-zero exit on any rule below). Self-scan is the primary gate;
the script is the deterministic safety net.

## Question pacing — one decision point per turn

[`ask-when-uncertain`](ask-when-uncertain.md)'s Iron Law is canonical: **one question per turn**. What counts as "one question" is **one decision point** — a single numbered-options block is ONE question even when its options span multiple dimensions (a depth-and-framework matrix answered with a single number is one decision). Multiple separate asks in one reply, or a block whose answer would need a structured reply (`1a, 2b`), violate the kernel rule's self-check.

If in doubt, split into serial turns — never a long batched prompt.

## The trigger is a decision, not a format

```
THE OBLIGATION FIRES ON HANDING A DECISION TO THE USER — IN ANY FORM.
NOT ON THE PRESENCE OF A NUMBERED LIST.
A TRAILING FREE-TEXT OFFER IS AN ASK. A BARE YES/NO IS AN ASK.
```

Measured, and the measurement is unusually clean: a conformance audit of 30
sessions (2026-08-06) found that **every** malformed ask was a one-line
parenthetical or a trailing free-text offer — *"sag Bescheid, wenn ich die drei
Zeilen mitnehmen soll"*, *"Soll ich das so umsetzen?"*, *"Sag Bescheid, ob ich
beides angehen soll."* The same sessions formatted their **large** asks
perfectly, with a neutral block and a single bolded recommendation line. One of
those parentheticals produced a genuine two-questions-per-turn violation the
user then answered as two.

The pattern says the rule is being read as *if numbered options, then a
recommendation line*. It is the other way round: **a decision handed to the user
requires the block**, and an ask that feels too small for one is exactly the ask
that escapes the format. Three further shapes the same audit caught:

- a filler option with no content ("2. Nein, anders vorgehen") to satisfy the
  format while carrying no alternative;
- an inline `(Empfohlen)` tag inside an option **plus** the recommendation line —
  the dual source Iron Law 1 exists to make impossible;
- an option set that was partly additive and partly exclusive, so the user had to
  answer `1,3,4`.

**No gate ships for this.** `check_reply_consistency` scans authored markdown,
never a chat draft, and no gate sees a reply before it is sent. This section
is prose against a failure that prose already failed to prevent once — which is
why the next step is measurement, not a stronger adjective:
`agent-config conformance:behavior` deliberately does **not** score ask-shape, so
if this wording does not move the rate, that is a finding and not a silence.

## Mechanics — rationale, failure modes, format details, examples

The "why take a position", position-agnostic clause, format
specification (neutral block + bolded recommendation line + caveat),
no-trailing-open-question rule, "what does NOT count" catalog, full
five-step pre-send self-check, named failure-mode catalog (end-of-turn
menu, trailing-question hedge, no-preference hedge, multi-block reply,
…), slip-handling protocol, numbered-options rules, format examples,
progress indicators, and summary-table patterns all live in
[`contexts/communication/rules-auto/user-interaction-mechanics.md`](../contexts/communication/rules-auto/user-interaction-mechanics.md).
The rule above is the obligation surface; the mechanics file is the
lookup material.

When the user pastes large tool output, logs, JSON, or API responses,
keep the reply narrow: extract only the relevant fields with targeted
filters (`jq`, `rg`, `grep`) before quoting, instead of echoing the
whole blob back.
