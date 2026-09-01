---
stability: beta
keep-beta-until: 2026-11-30
roadmap_ref: road-to-governed-evidence-production.md
---

# The twelve-stage evaluation cascade

**Purpose.** Publish the settled twelve-stage enumeration and the rule that
orders it, so the enumeration is reproducible rather than proposed. Written
under `road-to-governed-evidence-production` step 1.2.

**Scope.** The stage list, its order, and each stage's evidence class. Does
**not** define what any stage checks — the deterministic stages are
[`evaluation_cascade.ts`](../../src/scripts/_lib/evaluation_cascade.ts)'s and the
receipt-bearing stages are
[`activation_ladder.ts`](../../src/scripts/_lib/activation_ladder.ts)'s.

## Why an enumeration needed a contract at all

E9 (2026-08-30, AI council 2/2) decided the **arity** — twelve — and enumerated
the stages nowhere. The 2026-08-31 round asked for the enumeration and returned
`REVISE`: the same seat, asked twice, produced two materially different twelves
— different names, different order, and a different placement of the statistical
stage. One seat answering differently on two passes is evidence that the design
had not converged, so the arity was recorded as decided and the semantics were
not.

**A third proposal would have been a third answer.** What settles an enumeration
that two proposals disagreed on is not a better proposal; it is removing
proposal from the process. The twelve below is **computed** from two committed
arrays and one stated ordering rule, by
[`cascade_stage_enumeration.ts`](../../src/scripts/_lib/cascade_stage_enumeration.ts).
Re-running the computation over the same tree cannot produce a different answer,
and changing the answer requires changing an array — which is a visible diff, not
a differently-worded reply.

## The ordering rule

A stage's position is decided by the **evidence it needs**, and within an
evidence class by the order the stage appears in its own source array.

| Rank | Evidence class | What the stage needs | `CascadeInput` field |
|---|---|---|---|
| 0 | `record` | the candidate record alone | `raw` |
| 1 | `plan` | the run plan and the budget ceiling | `plan`, `budget` |
| 2 | `peers` | the sibling candidates of this run | `peers` |
| 3 | `receipt` | an activation receipt | `receipt` |
| 4 | `measurement` | measured trials | `rows`, `vector` |

This is the cascade's cheapest-first, abort-on-first-failure discipline restated
over **evidence** instead of over cost: a stage may not run before the evidence
it depends on could exist, and a candidate that fails a cheap-evidence stage
must never consume the expensive evidence.
[`activation-receipt-trust-boundary.md`](activation-receipt-trust-boundary.md)
EC-2 is the `receipt` row of this same table, stated as a falsifiable claim.

**Why the statistical stage is last, since that is where the two proposals
disagreed.** Measurement is the most expensive evidence in the table — it is the
only class that requires trials to have been run. Placing it anywhere but last
would let a candidate consume trials it could have been refused without.

## The twelve

Machine-checked: the table below is parsed by
`tests/scripts/twelve_stage_enumeration.test.ts` and must agree with the computed
constant. Editing one without the other fails.

| # | Stage | Evidence class |
|---|---|---|
| 1 | `schema-validity` | `record` |
| 2 | `path-ownership` | `record` |
| 3 | `holdout-disclosure` | `record` |
| 4 | `budget` | `plan` |
| 5 | `near-duplicate` | `peers` |
| 6 | `receipt-eligible` | `receipt` |
| 7 | `receipt-selected` | `receipt` |
| 8 | `receipt-projected` | `receipt` |
| 9 | `receipt-delivered` | `receipt` |
| 10 | `receipt-visible` | `receipt` |
| 11 | `receipt-adhered` | `receipt` |
| 12 | `metric-verdict` | `measurement` |

E9's condition is met literally: activation/delivery (`receipt-delivered`) and
adherence (`receipt-adhered`) are each their own stage.

## How the reproduction works, and what "independent" means here

Step 1.2's verify clause asks that *"one enumeration is committed, and a second
independent pass reproduces it rather than proposing a different twelve"*. The
second pass is independent in its **derivation route**, not in its author — and
the distinction is the whole point rather than a hedge:

| | Route A (committed) | Route B (the reproduction) |
|---|---|---|
| Stage names | imported from the two modules | regex-extracted from the two source FILES as text |
| Evidence classes | `PREFIX_EVIDENCE_CLASS` in code | parsed from § The twelve above |
| Ordering rule | applied by the module | re-applied by the test |

Route B catches what the failure mode actually was. A hand-edited
`TWELVE_STAGES` fails it, because route B never reads that constant. A rung
added in code without the table fails it. A table edited without the code fails
it.

**An independent AUTHOR is deliberately not what is being asked for.** A second
author is a second proposal, and two proposals is the state that produced the
`REVISE`. What makes an enumeration settled is that the same tree yields the same
twelve by more than one route — not that two parties agreed.

**What this does not establish.** Both routes read the same two arrays, so
neither is evidence that the arrays hold the right rungs or the right stages.
That question is E4's (rung arity) and E9's (stage arity), both already decided,
and reopening either is a decision-revisit matter rather than a reproduction one.

## Cross-references

- The computation: [`cascade_stage_enumeration.ts`](../../src/scripts/_lib/cascade_stage_enumeration.ts).
- The deterministic half and its family exclusion: [`evaluation_cascade.ts`](../../src/scripts/_lib/evaluation_cascade.ts).
- The receipt-bearing half: [`activation_ladder.ts`](../../src/scripts/_lib/activation_ladder.ts).
- The claims the `receipt` rank rests on: [`activation-receipt-trust-boundary.md`](activation-receipt-trust-boundary.md).
