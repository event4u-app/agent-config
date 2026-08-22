<!-- evidence-type: analysis -->
# Mutation testing of the gate modules — an external null, filed against the local record

**Filed:** 2026-08-22 · **Status:** external, unreproduced. **Not a measurement made here.**

## What the external source reported

The inbox artifact named in `road-to-ci-supply-chain-integrity`'s `Source:` line
reports **13 of 13 planted defects producing no red test** under the mutation
operator it used, against this repository's gate modules.

**Attributed to that source, not to this tree.** Nothing in this repository has
run a mutation pass. The operator, the module selection, the harness and the
revision are all unstated in the artifact, which is why this file exists as a
*filing* rather than as evidence: an unreproduced 13-of-13 is a strong-sounding
number with no denominator anyone here can check.

## Why it is filed rather than acted on

Mutation testing of the gate modules was **refused by council on 2026-08-02**,
as governance about governance:

> **No gate manifest, no gate mutation tests.** Council refused both as governance
> about governance; the scan-scope assertion in Phase 1 already kills the class.

— `agents/roadmaps/archive/road-to-overlap-truth-and-skill-cut.md:207-208`

That refusal has a **recorded reopener**, and it is specific and still unmet.
Verbatim from `agents/roadmaps/later/road-to-gateway-harvest.md:55` (milestone M5):

> Qualifying red test: a mutation pass over ONE chosen gate module showing 0
> killed mutants — which is exactly this milestone's own coverage-check first step

So the door opens on **a pass run here over one named module**, not on an
external count. The external null is consistent with the reopener's hypothesis
and is not the reopener: 13 planted defects surviving *somewhere* is not the
same claim as 0 mutants killed *in a named module of this tree*.

## What would change the answer

Exactly the reopener above: one gate module, one mutation pass, the killed-mutant
count published — including the honest outcome that mutants **were** killed,
which would close the question rather than open it. `decision-revisit-gate`'s
mechanism-match test applies: an external operator on unstated modules is not
the mechanism the reopener names, so the lock holds and this file is what
stops the question being re-litigated from memory next time.

## Why this filing exists at all

The refusal is a year-old council decision reachable only by reading an archived
roadmap. Without this note the next pass meets the external number first and the
refusal second, or not at all — and a lock nobody can find is a lock that gets
re-opened by accident. The door stays shut **on evidence**, which is the point:
not because mutation testing is a bad idea, but because the specific thing that
would justify it has not been produced.
