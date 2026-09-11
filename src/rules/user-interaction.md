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

Three Iron Laws govern every reply that contains numbered options.
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

Mechanical backstop for Iron Laws 1 and 2:
`./scripts-run src/scripts/check_reply_consistency --stdin < draft.md`
(non-zero exit on either). It takes a DRAFT, so it cannot see Iron Law 3,
which is about a transcript. Self-scan is the primary gate; the script is
the deterministic safety net.

## Iron Law 3 — A Pending Decision Survives the Turn

```
AN UNANSWERED OPTIONS BLOCK STAYS LIVE UNTIL THE USER ANSWERS, CANCELS, OR SUPERSEDES IT.
AN ASSISTANT-ONLY CONTINUATION — A HOOK NUDGE, A REVIEWER RESULT, A TASK NOTIFICATION —
MAY ADD TO THE TURN. IT NEVER SILENTLY DISPLACES THE PENDING QUESTION.
A CONTINUATION THAT CLOSES THE TURN RE-PRESENTS THE BLOCK AND ITS RECOMMENDATION LINE.
DROPPING AN UNANSWERED BLOCK IS A RULE VIOLATION, NOT A SLIP.
```

Only the user's own answer discharges it. A later assistant entry in the same
turn is not an answer, and a turn that ends with the block gone has lost a
decision nobody took. The `pending-decision` detector in
`src/scripts/hooks/turn_end_gate_hook.ts` refuses such a turn-end and names the
dropped block's option numbers — but it binds on `claude`'s `stop` slot alone,
so everywhere else this law is model-carried and nothing catches a dropped
block.

## Question pacing — one decision point per turn

[`ask-when-uncertain`](ask-when-uncertain.md)'s Iron Law is canonical: **one question per turn**. What counts as "one question" is **one decision point** — a single numbered-options block is ONE question even when its options span multiple dimensions (a depth-and-framework matrix answered with a single number is one decision). Multiple separate asks in one reply, or a block whose answer would need a structured reply (`1a, 2b`), violate the kernel rule's self-check.

If in doubt, split into serial turns — never a long batched prompt.

## The trigger is a decision, not a format

```
THE OBLIGATION FIRES ON HANDING A DECISION TO THE USER — IN ANY FORM.
NOT ON THE PRESENCE OF A NUMBERED LIST.
A TRAILING FREE-TEXT OFFER IS AN ASK. A BARE YES/NO IS AN ASK.
```

The measurement behind this clause, the three further caught shapes, and why no
gate ships for it: [`user-interaction-mechanics`](../contexts/communication/rules-auto/user-interaction-mechanics.md) § The trigger is a decision.

## Mechanics — rationale, failure modes, format details, examples

The rule above is the obligation surface. Everything you look up rather than
obey — why to take a position, the format spec, the five-step self-check, the
named failure-mode catalog, slip handling, examples, progress indicators and
summary patterns — is in
[`contexts/communication/rules-auto/user-interaction-mechanics.md`](../contexts/communication/rules-auto/user-interaction-mechanics.md).

When the user pastes large tool output, logs, JSON, or API responses,
keep the reply narrow: extract only the relevant fields with targeted
filters (`jq`, `rg`, `grep`) before quoting, instead of echoing the
whole blob back.
