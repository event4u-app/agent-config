<!-- evidence-type: analysis -->

# Experience-loop broadening — the paired question, pre-registered

> **Committed BEFORE any measurement run.** That ordering is the whole artefact:
> `road-to-experience-loop-broadening` step 9.4's verify line is a
> commit-ordering assertion, so the git history is the evidence, not this file's
> prose. Nothing below was written with a number in hand.

## Why one question and not a catalogue

A metric catalogue lets a run report whichever number moved. One pre-registered
question does not, and that is the point: the loop was broadened on the belief
that it would reduce repeated failure, so that is what gets asked, and a
disappointing answer has nowhere to hide.

## The one core metric

**The repeated-failure rate**, out of `extract_audit_patterns` — patterns whose
outcome ≠ success across **independent** `work_id`s — read from the **amended**
episode view (`src/scripts/_lib/repeated_failure.ts`).

The amended view is load-bearing rather than a detail. A repeat is exactly the
signal that surfaces *after* an episode's terminal record is written: rework
lands, a regression is found, a review comes back. A rate computed over unamended
rows undercounts the thing it measures, and undercounts it in the flattering
direction.

## The verdict is a VECTOR, and one arm failing is not a score

Three components, reported side by side and never combined into a single number:

| Component | Source | Pass condition |
|---|---|---|
| Repeated failures | `repeatedFailureRate` over the amended view | rate falls, reproducibly |
| Quality held | the existing quality-regression thresholds | no regression |
| Cost | audit-stream token deltas, with provenance | not increased |

**A failed or unmeasurable arm yields INCONCLUSIVE, never a fabricated score.**
There is no weighting, because a weighting is what lets a strong arm carry a
missing one. If cost cannot be measured with a stated basis, the verdict is
inconclusive on cost and the vector says so.

## Both directions, fixed now

**PROVE.** A reproducible fall in the repeated-failure rate, at held quality and
non-increased cost, over a sample above the power floor. Consequence: the
broadened loop is kept and Phase 7's card mechanism may be built on it.

**THE NEGATIVE, carrying the same force.** No movement, or a rise, or an arm that
cannot be measured. Consequence, committed here rather than decided afterwards:

1. The broadened loop is **not** built out further on this evidence. Phases whose
   only justification is "widening helped" stop.
2. The result is recorded as a `resolved-null` claim in `docs/CLAIMS.md` — a
   finished answer, not indefinite pending debt.
3. **No re-scoped claim is invented after the numbers.** "It helped in a
   different way than we measured" is exactly the move this pre-registration
   exists to make unavailable.

**UNDERPOWERED is not a pass and not a null.** Below the power floor the run
settles nothing in either direction and may be cited for neither. This mirrors
`paired_verdict`'s own treatment of `underpowered`, deliberately.

## Two scope bounds, stated before the reading

1. **The corpus is one machine's gitignored runtime state.** It is not
   reproducible from a clone. Any figure measures THIS install and is never
   reported as the package's — the same bound the dispatch-capture measurement
   carries.
2. **Efficacy must be external.** A loop scored on whether it agrees with its own
   experience report validates itself. The repeated-failure rate is read from the
   audit stream, which is produced by the work rather than by the report — and no
   component of this verdict may be sourced from the report's own output.

## The frozen set

The comparison's evaluator, corpus, task definition, baseline and protected
fixtures are frozen for its duration via `src/scripts/_lib/experiment_freeze.ts`.
A mid-run change to any of the five **aborts** the comparison rather than
continuing it: a run whose frozen set moved did not compare two arms, it compared
two experiments and reported the difference as an effect.

The frozen digest is recorded with the run. It is deliberately absent here,
because no run has happened — a digest written before there is anything to freeze
would be decoration.
