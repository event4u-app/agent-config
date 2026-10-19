<!-- evidence-type: analysis -->

# Phase 6 spend is owner-reserved: no delegated threshold, so the council cannot authorise a positive maximum

**Date:** 2026-10-19 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 across two attempts (below) · **Prompt:** `procedure-cursor-spend-authorisation-20261019.question.md`, beside this file
**Authority:** the follow-up D17 named — the pre-registration states its computed maximum, so the authorisation returns to the council with that figure

## Verdict — (c), 2/2

| Seat | Choice | Owner-only action |
|---|---|---|
| `openai` | **(c)** | yes — approve a positive spending ceiling, ideally recorded as a threshold |
| `anthropic` | **(c)** | yes — set `cost.budgets` to at least the authorised figure, or authorise this measurement's maximum explicitly |

**Two attempts, disclosed because a re-run can be verdict shopping.** In the first
attempt the `anthropic` seat timed out after 300 s and returned no text; `openai`
answered (c). The identical prompt was run once more so the seat without a verdict
could answer: `anthropic` answered (c), and `openai` exited without a response. No
seat answered twice, no answer was discarded, and nothing in the prompt changed
between the attempts. Both answers are quoted from the local response files.

## Reasons both seats gave

- The governance table's two rows — "budgeted, threshold-bounded spend" for the
  council and "spend above a delegated threshold" for the owner — both presume a
  threshold. `cost.budgets` resolves to zero on every layer, so every positive
  maximum is above it.
- The 2026-10-18 delegation passed roadmap decisions, not a spending ceiling; it
  wrote no `cost.budgets` entry and named no amount.
- The run instruction's "within configured cost.budgets" covers $0 when the budget
  resolves to zero.
- `openai` added that a subscription transport still carries liability up to the
  stated cap, because whether the organisation bills usage past the plan's
  included amount cannot be read from the repository.

Strongest counter-argument, as `openai` stated it: the $2,592 is a list-price
equivalent rather than necessarily a charge, and the owner started a run naming
paid evaluation calls. Both seats held that inference too weak for an explicit
spend-control boundary.

## A figure corrected after the round

After the round, reading the eval tool's case fields showed that four properties
the instrument relies on are not documented, so the pre-registration added one
precondition run per arm and pilot before calibration (six runs). The pre-registration's maximum moved from $2,592 to **$2,649.60** and the
first slice from $864 to **$921.60**. The verdict does not depend on the amount —
both seats held that no positive maximum is council-decidable while no threshold is
recorded — so the round was not repeated; the owner authorises the corrected
figures.

## What follows

1. **Owner action — the only one this measurement needs:** authorise a monetary
   ceiling (the seats prefer the calibration slice first — $921.60 with the six precondition runs) and say whether
   organisational extra usage may be consumed; recording it as `cost.budgets` makes
   later slices council-decidable.
2. Meanwhile the zero-spend parts — fixtures, scorer, arm directories — may be
   built (both seats).
3. After calibration, the admitted-task counts and a revised measurement maximum
   return to the council before the 180 measured runs.
