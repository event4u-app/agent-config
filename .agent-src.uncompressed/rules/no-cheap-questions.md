---
type: "always"
description: "No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on)"
alwaysApply: true
source: package
---

# No Cheap Questions

User's time is the scarce resource. A question is **cheap** when the
answer follows from already-stated context, when one of the offered
options would breach an Iron Law, when the choices differ only in
sequencing or format, or when one option is obviously dominant. Cheap
questions are noise, every time, regardless of `personal.autonomy`.

This rule is mode-independent on purpose. The "trivial" failure modes
in [`autonomous-execution`](autonomous-execution.md) are scoped to
`personal.autonomy: on` (or `auto`-after-opt-in); this rule lifts the
**no-trade-off** subset to apply in `off` and pre-opt-in `auto` too.

## The Iron Laws

```
NEVER ASK WHAT THE STATED CONTEXT ALREADY ANSWERS.
NEVER PRESENT AN OPTION THAT VIOLATES AN IRON LAW.
NEVER OFFER NUMBERED CHOICES WITHOUT A REAL TRADE-OFF.
```

These hold in `off`, `auto`, and `on`. Autonomy mode never lifts them.

## What counts as cheap

| Class | Pattern | Why cheap |
|---|---|---|
| **Sequencing** | "Step 2 or Step 3 next?" when the roadmap orders them | Answer is in the roadmap |
| **Format-only** | "Table or paragraph?", "Bullet or prose?" | No semantic trade-off; pick what fits |
| **Commit asks** | "Should we commit now?", "Commit this?" | [`commit-policy`](commit-policy.md) Iron Law: NEVER ASK |
| **CI / test asks** | "Run tests now or later?", "Run lint?" | [`verify-before-complete`](verify-before-complete.md) decides; act |
| **Fenced-step re-asks** | "Shall we start with Phase 1?" after user said "plan only" | [`scope-control`](scope-control.md#fenced-step--user-set-review-gates) § fenced step: deliver + handback |
| **Iron-Law-violating option** | Numbered block whose Option N would breach `commit-policy`, `scope-control` § git-ops, or `non-destructive-by-default` Hard Floor | The option does not exist; do not surface it |
| **Context-derived** | Answer follows from prior turn, standing instruction, roadmap, or file under review | Act on the answer; state the assumption inline |
| **Dominant option** | One option is obviously correct; alternatives carry no plausible upside | Pick the dominant path; do not stage a false choice |
| **Re-ask after decline** | Offering the same path again after the user already said no | [`scope-control`](scope-control.md#decline--silence--no-re-asking-on-the-same-task) § decline = silence |

## Pre-Send Self-Check — MANDATORY before every question

Before drafting any numbered-options block or any question to the
user, run silently:

1. Does the answer follow from already-stated context (this turn,
   prior turn, roadmap, standing instruction, file under review)?
2. Does any option violate [`commit-policy`](commit-policy.md),
   [`scope-control`](scope-control.md) § git-ops, or
   [`non-destructive-by-default`](non-destructive-by-default.md)?
3. Are the options pure sequencing or pure format with no semantic
   trade-off?
4. Is one option obviously dominant — alternatives carry no real
   upside?
5. Did the user fence the next step (*"plan only"*, *"don't
   implement"*, *"review first"*)? If so, deliver + handback per
   [`scope-control`](scope-control.md#fenced-step--user-set-review-gates)
   § fenced step.
6. Did the user already decline this path? Re-asking is forbidden per
   [`scope-control`](scope-control.md#decline--silence--no-re-asking-on-the-same-task)
   § decline = silence.

If any answer is "yes" → **do not ask**. Pick the dominant path,
state the assumption inline ("assuming X — adjust if wrong"), hand
back. The one-question-per-turn Iron Law from
[`ask-when-uncertain`](ask-when-uncertain.md) still applies when the
question is genuine.

## When asking IS allowed

Asking remains correct — and required — when:

- The choice is a real architectural / scope decision with material,
  non-obvious trade-offs the user is the only authority for.
- A vague-request trigger from
  [`ask-when-uncertain`](ask-when-uncertain.md#vague-request-triggers--must-ask)
  fires.
- A security-sensitive path is touched per
  [`security-sensitive-stop`](security-sensitive-stop.md).
- The Hard Floor in
  [`non-destructive-by-default`](non-destructive-by-default.md) fires
  (prod-trunk merge, deploy, push, prod data/infra, bulk-deletion or
  infra commit). The floor's confirmation prompt is **not** cheap; it
  is mandatory.
- Two genuinely-equivalent paths exist and the user's preference is
  the only tiebreaker.

In doubt whether a question is cheap or genuine → it is genuine. Ask.
This rule narrows asking, never widens silence.

## Failure modes

- Numbered-options block where Option 1 is *"commit and continue"* —
  `commit-policy` violation, the option does not exist.
- *"Shall we start with Phase 1?"* after the user said *"plan only"*
  / *"erst Roadmap, ich schau drüber"* — fenced-step violation.
- *"Run CI now or after the change?"* — `verify-before-complete`
  already decides; act.
- *"Should the commit message say `feat:` or `chore:`?"* with no
  ambiguity — `conventional-commits-writing` settles it.
- *"Tabelle oder Liste?"* when both render the same information.
- Sequencing options where the alternatives differ only in order with
  no dependency or risk delta.
- Re-asking *"may I begin?"* after the user already approved the plan.

## Interactions

- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request
  triggers, one-question-per-turn Iron Law. This rule narrows the
  *cheap* subset; the genuine subset still applies in full.
- [`autonomous-execution`](autonomous-execution.md) — trivial-vs-blocking
  + opt-in detection. Mode-scoped triviality lives there; the
  mode-independent floor lives here.
- [`commit-policy`](commit-policy.md) — never ask about committing.
- [`scope-control`](scope-control.md) — git-ops permission gate +
  fenced step + decline = silence.
- [`non-destructive-by-default`](non-destructive-by-default.md) —
  Hard Floor confirmations, never cheap.
- [`user-interaction`](user-interaction.md) — numbered-options Iron
  Law shape. This rule decides whether the block is sent at all.
- [`direct-answers`](direct-answers.md) — brevity, no flattery,
  no invented facts.
