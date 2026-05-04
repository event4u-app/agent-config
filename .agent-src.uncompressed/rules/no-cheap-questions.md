---
type: "always"
tier: "3"
description: "No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on)"
alwaysApply: true
source: package
---

# No Cheap Questions

A question is **cheap** when the answer follows from stated context,
an option breaches an Iron Law, choices differ only in sequencing /
format, or one option is obviously dominant. Mode-independent — holds
in `off`, `auto`, and `on`; autonomy never lifts the no-trade-off
floor (cf. [`autonomous-execution`](autonomous-execution.md), whose
"trivial" failure modes only scope to `on` / opted-in `auto`).

## The Iron Laws

```
NEVER ASK WHAT THE STATED CONTEXT ALREADY ANSWERS.
NEVER PRESENT AN OPTION THAT VIOLATES AN IRON LAW.
NEVER OFFER NUMBERED CHOICES WITHOUT A REAL TRADE-OFF.
```

Hold in `off`, `auto`, and `on`. Autonomy never lifts them.

## What counts as cheap

- **Sequencing** — "Step 2 or 3 next?" when the roadmap orders them.
- **Format-only** — "Table or paragraph?"; no semantic trade-off.
- **Commit asks** — forbidden by [`commit-policy`](commit-policy.md).
- **CI / test asks** — [`verify-before-complete`](verify-before-complete.md) decides, not the user.
- **Fenced-step re-asks** — "Start Phase 1?" after *"plan only"*; see
  [`scope-control § fenced step`](scope-control.md#fenced-step--user-set-review-gates).
- **Iron-Law option** — breaches `commit-policy`, `scope-control` § git-ops, or `non-destructive-by-default`.
- **Context-derived** — answer follows from prior turn / standing instruction / roadmap; act, state the assumption inline.
- **Dominant option** — one choice obviously correct; alternatives carry no upside.
- **Re-ask after decline** — forbidden per [`scope-control § decline = silence`](scope-control.md#decline--silence--no-re-asking-on-the-same-task).

Examples per class:
[`asking-and-brevity-examples`](../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#cheap-question-class-catalog--extended-examples).

## Pre-Send Self-Check — MANDATORY before every question

Run silently before any numbered-options block:

1. Answer already in stated context?
2. Any option violates [`commit-policy`](commit-policy.md), [`scope-control § git-ops`](scope-control.md), or [`non-destructive-by-default`](non-destructive-by-default.md)?
3. Options pure sequencing / format, no trade-off?
4. One option obviously dominant?
5. User fenced next step (*"plan only"*, *"review first"*) → deliver + handback per [`scope-control § fenced step`](scope-control.md#fenced-step--user-set-review-gates).
6. User already declined? Re-ask forbidden per [`scope-control § decline = silence`](scope-control.md#decline--silence--no-re-asking-on-the-same-task).

Any "yes" → **do not ask**. Pick the dominant path, state assumption
inline (*"assuming X — adjust if wrong"*), hand back. One-question-per-turn
from [`ask-when-uncertain`](ask-when-uncertain.md) still applies when
the question is genuine.

## When asking IS allowed

- Real architectural / scope decision with non-obvious trade-offs.
- Vague-request trigger per [`ask-when-uncertain`](ask-when-uncertain.md#vague-request-triggers--must-ask).
- Security-sensitive path per [`security-sensitive-stop`](security-sensitive-stop.md).
- Hard Floor in [`non-destructive-by-default`](non-destructive-by-default.md) — confirmation mandatory.
- Two genuinely-equivalent paths; user preference is the tiebreaker.

In doubt → ask. This rule narrows asking, never widens silence.

## Interactions

- [`ask-when-uncertain`](ask-when-uncertain.md) — vague triggers + one-question-per-turn; narrows the cheap subset.
- [`autonomous-execution`](autonomous-execution.md) — mode-scoped triviality there; mode-independent floor here.
- [`commit-policy`](commit-policy.md) · [`scope-control`](scope-control.md) · [`non-destructive-by-default`](non-destructive-by-default.md) — Iron Laws this rule defends.
- [`user-interaction`](user-interaction.md) — numbered-options shape; this rule decides whether to send.
- [`direct-answers`](direct-answers.md) — brevity, no flattery.
