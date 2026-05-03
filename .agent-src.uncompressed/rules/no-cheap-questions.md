---
type: "always"
description: "No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on)"
alwaysApply: true
source: package
---

# No Cheap Questions

A question is **cheap** when the answer follows from stated context,
when an option would breach an Iron Law, when choices differ only in
sequencing or format, or when one option is obviously dominant. Cheap
questions are noise, regardless of `personal.autonomy`.

Mode-independent. The "trivial" failure modes in
[`autonomous-execution`](autonomous-execution.md) are scoped to
`personal.autonomy: on` (or `auto`-after-opt-in); this rule lifts the
**no-trade-off** subset to apply in `off` and pre-opt-in `auto` too.

## The Iron Laws

```
NEVER ASK WHAT THE STATED CONTEXT ALREADY ANSWERS.
NEVER PRESENT AN OPTION THAT VIOLATES AN IRON LAW.
NEVER OFFER NUMBERED CHOICES WITHOUT A REAL TRADE-OFF.
```

Hold in `off`, `auto`, and `on`. Autonomy never lifts them.

## What counts as cheap

| Class | Pattern · why cheap |
|---|---|
| **Sequencing** | "Step 2 or 3 next?" when roadmap orders them — answer is in the roadmap |
| **Format-only** | "Table or paragraph?" — no semantic trade-off |
| **Commit asks** | "Commit now?" — [`commit-policy`](commit-policy.md): never ask |
| **CI / test asks** | "Run tests now?" — [`verify-before-complete`](verify-before-complete.md) decides |
| **Fenced-step re-asks** | "Start Phase 1?" after "plan only" — [`scope-control § fenced step`](scope-control.md#fenced-step--user-set-review-gates) |
| **Iron-Law option** | Option breaches `commit-policy`, `scope-control § git-ops`, or `non-destructive-by-default` — does not exist |
| **Context-derived** | Answer follows from prior turn / standing instruction / roadmap — act, state assumption inline |
| **Dominant option** | One choice obviously correct; alternatives carry no upside — pick it |
| **Re-ask after decline** | Same path after user said no — [`scope-control § decline = silence`](scope-control.md#decline--silence--no-re-asking-on-the-same-task) |

## Pre-Send Self-Check — MANDATORY before every question

Before drafting any numbered-options block, run silently:

1. Does the answer follow from already-stated context?
2. Does any option violate [`commit-policy`](commit-policy.md),
   [`scope-control § git-ops`](scope-control.md), or
   [`non-destructive-by-default`](non-destructive-by-default.md)?
3. Are options pure sequencing / format with no trade-off?
4. Is one option obviously dominant?
5. Did the user fence the next step (*"plan only"*, *"review first"*)?
   → deliver + handback per [`scope-control § fenced step`](scope-control.md#fenced-step--user-set-review-gates).
6. Did the user already decline? Re-asking is forbidden per
   [`scope-control § decline = silence`](scope-control.md#decline--silence--no-re-asking-on-the-same-task).

Any "yes" → **do not ask**. Pick the dominant path, state the
assumption inline (*"assuming X — adjust if wrong"*), hand back. The
one-question-per-turn Iron Law from
[`ask-when-uncertain`](ask-when-uncertain.md) still applies when the
question is genuine.

## When asking IS allowed

- Real architectural / scope decision with non-obvious trade-offs.
- Vague-request trigger per
  [`ask-when-uncertain`](ask-when-uncertain.md#vague-request-triggers--must-ask).
- Security-sensitive path per
  [`security-sensitive-stop`](security-sensitive-stop.md).
- Hard Floor in [`non-destructive-by-default`](non-destructive-by-default.md)
  fires — confirmation is mandatory, never cheap.
- Two genuinely-equivalent paths; user preference is the tiebreaker.

In doubt → genuine. Ask. This rule narrows asking, never widens silence.

## Interactions

- [`ask-when-uncertain`](ask-when-uncertain.md) — vague triggers +
  one-question-per-turn; this rule narrows the cheap subset.
- [`autonomous-execution`](autonomous-execution.md) — mode-scoped
  triviality there; mode-independent floor here.
- [`commit-policy`](commit-policy.md) · [`scope-control`](scope-control.md) ·
  [`non-destructive-by-default`](non-destructive-by-default.md) —
  the Iron Laws this rule defends.
- [`user-interaction`](user-interaction.md) — numbered-options shape;
  this rule decides whether the block is sent at all.
- [`direct-answers`](direct-answers.md) — brevity, no flattery.
