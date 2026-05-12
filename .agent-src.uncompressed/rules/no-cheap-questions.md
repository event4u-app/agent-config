---
type: "always"
tier: "3"
description: "No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on)"
alwaysApply: true
source: package
---

# No Cheap Questions

A question is **cheap** when context already answers, an option breaches an Iron Law, choices differ only in sequencing / format, or one option is dominant. Mode-independent — `off`, `auto`, `on`. Autonomy never lifts the floor.

## The Iron Laws

```
NEVER ASK WHAT THE STATED CONTEXT ALREADY ANSWERS.
NEVER PRESENT AN OPTION THAT VIOLATES AN IRON LAW.
NEVER OFFER NUMBERED CHOICES WITHOUT A REAL TRADE-OFF.
```

## What counts as cheap

Ten classes — sequencing · format-only · commit asks (forbidden by [`commit-policy`](commit-policy.md)) · CI / test asks ([`verify-before-complete`](verify-before-complete.md) decides) · fenced-step re-asks ([`scope-control § fenced step`](scope-control.md#fenced-step--user-set-review-gates)) · Iron-Law option (breaches `commit-policy`, `scope-control § git-ops`, or `non-destructive-by-default`) · context-derived · dominant option · re-ask after decline ([`scope-control § decline = silence`](scope-control.md#decline--silence--no-re-asking-on-the-same-task)) · **paternalistic state-assuming option** (see Iron Law 3 below).

## Iron Law 3 — No Paternalistic State-Assuming Options

```
NEVER FABRICATE USER STATE TO JUSTIFY AN OPTION.
"STOP FOR TODAY", "TAKE A BREAK", "YOU'VE DONE ENOUGH", "COME BACK FRESH",
"SLEEP ON IT", "PAUSE HERE" — FORBIDDEN AS OPTIONS OR RECOMMENDATIONS.
THE USER DECIDES WHEN TO STOP. THE AGENT DECIDES WHAT TO BUILD NEXT.
```

Forbidden patterns (non-exhaustive): "Stop hier — du hast genug für heute" · "Take a break and come back fresh" · "Weitermachen wenn frisch" · "Du wirkst genervt, sollen wir pausieren?" · "Sleep on it" · "That's a good stopping point" as a numbered option · any option whose recommendation rests on inferred fatigue, frustration, or end-of-day mood.

Carve-outs (allowed because they cite **observable, in-message** evidence, not inferred state):

- User said "ich bin müde / done for today / let's stop" **this turn** → ack and stop (not an option, an instruction).
- Hard Floor confirmation per [`non-destructive-by-default`](non-destructive-by-default.md) → "confirm or abort" is the option, not "rest".
- Context-window / freshness threshold tripped per [`context-hygiene`](context-hygiene.md) → cite the threshold ("fresh chat at 75%"), don't infer mood.

Every numbered option must be a **technical / scope / sequencing choice with a real trade-off**, not a mood-management nudge. If the only remaining differentiator is "you might be tired" → drop the option, recommend a concrete next step instead.

Per-class patterns and examples: [`asking-and-brevity-examples § cheap-question-catalog`](../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#cheap-question-class-catalog--extended-examples).

## Pre-Send Self-Check — MANDATORY before every question

Run silently before any numbered-options block:

1. Answer already in stated context?
2. Any option violates `commit-policy`, `scope-control § git-ops`, or `non-destructive-by-default`?
3. Options pure sequencing / format, no trade-off?
4. One option obviously dominant?
5. User fenced next step (*"plan only"*, *"review first"*) → deliver + handback per `scope-control § fenced step`.
6. User already declined? Re-ask forbidden per `scope-control § decline = silence`.
7. Any option assumes user fatigue / frustration / "had enough" without an in-message citation? Iron Law 3 — drop it.

Any "yes" → **do not ask**. Pick the dominant path, state assumption inline (*"assuming X — adjust if wrong"*), hand back. One-question-per-turn from [`ask-when-uncertain`](ask-when-uncertain.md) still applies when the question is genuine.

## When asking IS allowed

- Real architectural / scope decision with non-obvious trade-offs.
- Vague-request trigger per [`ask-when-uncertain § vague-triggers`](ask-when-uncertain.md#vague-request-triggers--must-ask).
- Security-sensitive path per [`security-sensitive-stop`](security-sensitive-stop.md).
- Hard Floor per [`non-destructive-by-default`](non-destructive-by-default.md) — confirmation mandatory.
- Two genuinely-equivalent paths; user preference is the tiebreaker.

In doubt → ask. This rule narrows asking, never widens silence.

Cross-rule index: [`frugality-charter § cross-references`](../contexts/contracts/frugality-charter.md#cross-references--frugality-canon-rules).
