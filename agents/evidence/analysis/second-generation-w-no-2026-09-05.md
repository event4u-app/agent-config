<!-- evidence-type: analysis -->
# W-NO: a second trigger-corpus generation will not be built

**Decision date:** 2026-09-05 · **Author:** AI council · **Verdict:** W-NO,
unanimous (2/2, quorum concluded).

## What was decided

`b-second-generation-worth-building`, the Class-3 blocker on
`road-to-second-trigger-corpus-generation`, asked whether a second trigger-corpus
generation should exist at all. The answer is **no**. The corpus stays at
**100 of 299** skills as a reproducible generation-1 evaluation fixture, and the
roadmap archives with cancellations.

**Frozen means coverage expansion, not immutability.** Bug fixes to the existing
100 entries, corrections to an entry shown to be wrong, and a one-off addition
justified by a specific gate need all remain permitted, provided they preserve
fixture membership and published-pin reproducibility. What is not built is the
*infrastructure for systematic expansion*.

## Who decided, and why not the maintainer

The blocker reads `Owner: maintainer`. It was routed to the council under the
maintainer's written delegation for this drain run:

> "Anything that would normally end in 'ask the user' (gates --reply, Owner: user
> blockers, deferred-item dispositions, option sets) is instead put to the AI
> Council. The council's recorded decision substitutes for user sign-off and is
> documented as such."

The blocker's own entry stated that the inputs were on the record and **no new
measurement was needed** to take the decision. None was taken.

**Run:** `council run --rounds 2 --depth deep`, members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, quorum concluded 2/2
(threshold 1), cost **$0.00**, both seats subscription-authed, round 2
blind-peer-reviewed. The question was posed with four unweighted options
(W-YES / W-NO / W-CONDITIONAL / W-OTHER), no stated expectation of the outcome,
and the blocker's own pre-existing `Recommendation:` line was flagged to the
seats as an input to weigh rather than a verdict to ratify.

## The evidence the decision rests on

| # | Fact | Source |
|---|---|---|
| 1 | 0 Skill invocations, 0 of 299 distinct skills, over 30 sessions and 11,049 assistant turns | `docs/CLAIMS.md § skill-activation-census-zero` |
| 2 | `evals/triggers.json` is read by three gates and by **no host at routing time** | blocker entry, carried from the parent roadmap |
| 3 | Current coverage 100/299 | `check_routing_coverage` |
| 4 | Generation-2 cost: a migration across 15 scripts and 10 test files | roadmap Phase 5.1 |
| 5 | Doing nothing breaks nothing — corpus stays at 100/299, three published pins stay reproducible | blocker `If you do nothing` |
| 6 | No measurement in this tree connects corpus coverage to host routing behaviour | absence, stated as such |

Fact 6 is the load-bearing one and it is an **absence**, not a measurement:
nothing here establishes that raising coverage changes what a host does. The
decision is that a 15-script migration to raise a numerator with no established
causal link to behaviour is not justified.

## The counter-argument, overridden rather than dropped

Both seats independently named the same strongest argument *against* W-NO, and
it is kept on the record:

> A versioned generation would decouple corpus additions from the published
> holdout hashes, making future growth safe and reproducible.

This is a real architectural benefit, and it is not disputed. It was overridden
because safe-expansion infrastructure has no present value until expansion
itself serves a demonstrated purpose — build it when measurement shows it
matters, not in anticipation.

## What this does NOT claim

- It does **not** claim the trigger corpus is worthless. It serves three gates
  today and continues to.
- It does **not** claim expansion would be harmful — only unjustified on
  present evidence.
- It does **not** resolve whether trigger-corpus coverage predicts host
  behaviour. That question is open, and its absence is the reason for the
  verdict rather than a finding produced by it.
- It does **not** rest on any new measurement. No measurement was taken.

## Consequence for the carried conjunct

AC-3's third conjunct — *"expanded with a positive and a near-miss fixture per
addition"* — was deferred out of `road-to-the-tenth-arrival` into this roadmap
on 2026-09-05 (PR #1861) and is now **retired**, not carried further. The chain
ends here rather than spawning a third receiver.

The constraint that made expansion unsafe was reproduced first-hand at n=1 and
is recorded in
`agents/evidence/analysis/tenth-arrival-ac3-disposition-2026-09-05.md`:
restoring a single preserved corpus file turns 6 tests red across three
published pins, while the corpus-local gates stay green and
`check_routing_coverage` reports it as a *rise*. That asymmetry is unchanged by
this decision — it is simply no longer a problem anyone is obliged to solve.

## Revisit-if

Reconsider only if **either**:

1. a production host begins consuming this corpus at routing time, verified by
   session logs or a host-capability probe; **or**
2. a controlled host-level evaluation shows that broader coverage materially
   improves correct skill invocation or task completion at an acceptable
   false-positive rate, **and** generation-1 pinning is what prevents that
   validated expansion.

**A single Skill invocation is explicitly not enough.** One seat proposed `>0`
invocations as the trigger and the other refuted it as too weak — a lone
invocation could be accidental, manually prompted, or unrelated to this corpus.
Sustained evidence across measurement windows is the bar. The disagreement is
recorded because the weaker threshold is the one a future reader is most likely
to reach for.

Before reopening, the missing instrument is host-level measurement of whether
routing benefits from trigger patterns at all. That absent causal link is the
reason generation 2 was not built, and building generation 2 is not how it gets
measured.

## An eleventh arrival

The parent roadmap was written to convert the eleventh arrival of this external
finding from a restatement into a recorded state. This file is that state. An
eleventh equivalent finding is closed by reference to this decision unless it
supplies evidence meeting the revisit condition above.
