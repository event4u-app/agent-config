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
# obligation: line 40
obligation_frequency: "per-turn"
---

# User Interaction

Three Iron Laws govern a decision put to the user — two on the reply that
carries it, one on what happens if the agent runs again before the answer.
They override conversation momentum, brevity, and the urge to defer to the
user. **Missing a recommendation is a rule violation, not a slip.**

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

Mechanical backstop (non-zero exit on any rule below), a safety net under the
self-scan rather than a replacement for it:
`./scripts-run src/scripts/check_reply_consistency --stdin < draft.md`

## Iron Law 3 — A Decision Outlives the Turn

```
A DECISION HANDED TO THE USER STAYS LIVE UNTIL THE USER ANSWERS IT.
THE AGENT RUNS AGAIN WITHOUT AN ANSWER — HOOK CONTINUATION, NOTIFICATION,
WAKE, RETRY — AND THE BLOCK PLUS ITS RECOMMENDATION LINE ARE RE-PRESENTED
IN THE SAME FORM. A SUBORDINATE CLAUSE IS NOT A RE-PRESENTATION.
A HOOK'S CONCERN MAY BE ADDED TO A PENDING DECISION, NEVER REPLACE ONE.
ONLY THE USER CLOSES IT — BY ANSWERING, OR BY MAKING IT MOOT.
```

Carrier: the `pending-decision` detector on `turn-end-gate`, one user turn on
one host; the rest is model-carried. Mechanics carries the measured failure.

## Question pacing — one decision point per turn

[`ask-when-uncertain`](ask-when-uncertain.md)'s Iron Law is canonical: **one question per turn**. What counts as "one question" is **one decision point** — one numbered-options block is ONE question even when its options span several dimensions, provided a single number answers it. Multiple separate asks in one reply, or a block needing a structured reply (`1a, 2b`), violate the kernel rule's self-check.

If in doubt, split into serial turns — never a long batched prompt.

## The trigger is a decision, not a format

```
THE OBLIGATION FIRES ON HANDING A DECISION TO THE USER — IN ANY FORM.
NOT ON THE PRESENCE OF A NUMBERED LIST.
A TRAILING FREE-TEXT OFFER IS AN ASK. A BARE YES/NO IS AN ASK.
```

Measured (30-session audit, 2026-08-06): **every** malformed ask was a one-line
parenthetical or a trailing offer, while the same sessions formatted their
**large** asks perfectly — the ask that feels too small for a block is the one
that escapes the format. **No gate ships for this**: the backstop inspects
numbered-option blocks, and every measured failure had none. Detail: mechanics.

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
