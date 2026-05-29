---
type: "auto"
tier: "3"
description: "Asking a question, presenting options, summarizing progress — numbered-options Iron Law, single-recommendation rule, progress indicators"
alwaysApply: false
load_context:
  - contexts/communication/rules-auto/user-interaction-mechanics.md
triggers:
  - intent: "ask user a question"
  - intent: "numbered options"
  - intent: "summarizing progress"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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
`python3 scripts/check_reply_consistency.py --stdin < draft.md`
(non-zero exit on any rule below). Self-scan is the primary gate;
the script is the deterministic safety net.

## Question pacing — simple vs complex

- **Simple, binary, or independent questions** may be grouped into a single reply with numbered options.
- **Complex, dependent, or branching questions** must be asked **one at a time** — one question per turn — so each answer informs the next.

If in doubt, prefer one question at a time over a long batched prompt.

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
