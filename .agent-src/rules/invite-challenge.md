---
type: "auto"
tier: "2b"
description: "Before executing a complex plan or non-trivial design — proactively ask 'am I solving the right problem?' and pause for user confirmation, even when no ambiguity is detected"
alwaysApply: false
source: package
triggers:
  - intent: "complex plan"
  - intent: "design decision"
  - intent: "architectural plan"
  - intent: "multi-step implementation"
  - keyword: "plan"
  - keyword: "design"
  - keyword: "architecture"
  - keyword: "approach"
---

# invite-challenge

## The Iron Law

```
BEFORE EXECUTING A COMPLEX PLAN — ASK ONCE:
"AM I SOLVING THE RIGHT PROBLEM?"
PAUSE. WAIT FOR CONFIRMATION. THEN PROCEED.
```

Proactive confirmation checkpoint. Distinct from [`direct-answers`](direct-answers.md) (reactive — fires after misdirection is detected) and [`ask-when-uncertain`](ask-when-uncertain.md) (info-gathering — fires when context is missing). This rule fires when context is **sufficient** and direction **looks correct** but the plan is heavy enough that a silent misread would be expensive.

## When to activate

Two or more of:

- Touches ≥ 3 files or ≥ 2 modules
- New abstraction, pattern, or library
- Security / billing / tenant / data-boundary path
- Migration, schema change, or backwards-incompatible API change
- Estimated effort > 30 min of agent work
- High-level goal ("rebuild the dashboard") rather than a bounded task ("rename this method")

**Does NOT activate for:** evidenced bug fixes · trivial edits · user-fenced tasks ("just do it") · steps inside an already-confirmed plan (ask once per plan, not per step) · cases handled by [`improve-before-implement`](improve-before-implement.md) Phase 1.

## How to challenge

One question, one turn. Numbered options per [`user-interaction`](user-interaction.md):

```
> Before I start, one check:
>
> Goal as I read it: {1-sentence restatement}
> Plan: {2-3 bullet shape, not full implementation}
> Risk if I misread: {what would be wasted}
>
> 1. Goal + plan match — proceed
> 2. Goal right, plan needs adjustment — say what
> 3. Goal wrong — let me restate
```

The restatement is the load-bearing part. Pick 1 → execute. Pick 2 or 3 → fold the correction in, do not re-ask.

## Scope limits

- **One challenge per plan**, not per step.
- **Skip when the user already restated the goal** in the same turn.
- **Skip when [`scope-control § fenced step`](scope-control.md) applies** — deliver the plan, hand back, no confirmation question appended.
- **Never argue the goal twice** — user's restatement is final for the turn.

## Interactions

[`direct-answers`](direct-answers.md) fires after misdirection · [`ask-when-uncertain`](ask-when-uncertain.md) fires on missing context · [`improve-before-implement`](improve-before-implement.md) Phase 1 already runs a clarity check (do not double-ask) · [`scope-control § fenced step`](scope-control.md) handback wins · [`no-cheap-questions`](no-cheap-questions.md) — checkpoint must carry a real goal restatement, not a content-free "ready?".
