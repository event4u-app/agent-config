---
type: "auto"
tier: "3"
description: "Questions, options, progress summaries — numbered-options Iron Law, single-recommendation rule"
alwaysApply: false
load_context:
  - ../contexts/communication/rules-auto/user-interaction-mechanics.md
triggers:
  - keyword: "option"
  - keyword: "recommendation"
  - phrase: "what do you recommend"
  - phrase: "was empfiehlst du"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
# obligation: line 40
obligation_frequency: "per-turn"
---

# User Interaction

Three Iron Laws govern a decision put to the user. The first two govern
the reply that contains it; the third governs what happens when the agent
runs again before the answer arrives. They override conversation momentum,
brevity, and the urge to defer to the user. **Missing a recommendation is
a rule violation, not a slip.**

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

## Iron Law 3 — A Decision Outlives the Turn

```
A DECISION HANDED TO THE USER STAYS LIVE UNTIL THE USER ANSWERS IT.
THE AGENT RUNS AGAIN WITHOUT AN ANSWER — HOOK CONTINUATION, TASK
NOTIFICATION, WAKE, OR RETRY — AND THE OPTIONS BLOCK PLUS ITS
RECOMMENDATION LINE ARE RE-PRESENTED IN THE SAME FORM.
A SUBORDINATE CLAUSE IS NOT A RE-PRESENTATION — "THE OPEN QUESTION IS
UNAFFECTED AND IS YOURS TO DECIDE" IS NOT A RE-PRESENTATION.
A HOOK'S CONCERN MAY BE ADDED TO A PENDING DECISION. IT NEVER REPLACES ONE.
ONLY THE USER CLOSES IT — BY ANSWERING, OR BY AN INSTRUCTION THAT MAKES IT MOOT.
```

Iron Laws 1 and 2 are discharged by the shape of the reply that carries the
block. Neither survives a turn boundary, which is the gap this closes: a
second assistant execution with no user message between it and the ask is
not a new conversation, and from the user's side a thread that ends without
the question ended without the question.

**Carrier, stated honestly.** The deterministic half is the
`pending-decision` detector in `src/scripts/hooks/turn_end_gate_hook.ts` —
it refuses a turn-end when an earlier reply in the same user turn carried a
block and the closing reply carries none. It sees one user turn on one host,
so everything outside that is model-carried, exactly like Iron Law 2's own
"no gate ships for this" note below. `check_reply_consistency` reads a single
draft and holds no cross-turn state; it cannot see this law at all.

## Question pacing — one decision point per turn

[`ask-when-uncertain`](ask-when-uncertain.md)'s Iron Law is canonical: **one question per turn**. What counts as "one question" is **one decision point** — a single numbered-options block is ONE question even when its options span multiple dimensions (a depth-and-framework matrix answered with a single number is one decision). Multiple separate asks in one reply, or a block whose answer would need a structured reply (`1a, 2b`), violate the kernel rule's self-check.

If in doubt, split into serial turns — never a long batched prompt.

## The trigger is a decision, not a format

```
THE OBLIGATION FIRES ON HANDING A DECISION TO THE USER — IN ANY FORM.
NOT ON THE PRESENCE OF A NUMBERED LIST.
A TRAILING FREE-TEXT OFFER IS AN ASK. A BARE YES/NO IS AN ASK.
```

Measured (30-session conformance audit, 2026-08-06): **every** malformed ask was
a one-line parenthetical or a trailing free-text offer — *"sag Bescheid, wenn
ich die drei Zeilen mitnehmen soll"*, *"Soll ich das so umsetzen?"* — while the
same sessions formatted their **large** asks perfectly. So the rule is being
read as *if numbered options, then a recommendation line*. It is the other way
round, and an ask that feels too small for a block is exactly the one that
escapes the format. Three further caught shapes: a contentless filler option; an
inline `(Empfohlen)` tag **beside** the recommendation line (the dual source
Iron Law 1 forbids); an option set answerable only as `1,3,4`.

**No gate ships for this.** `check_reply_consistency` can read a draft on stdin,
but it inspects *numbered-option blocks* — and every measured failure had no
block by construction, so it scans exactly the surface that did not fail. `conformance:behavior` deliberately does not score ask-shape,
so an unmoved rate is a finding rather than a silence.

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
