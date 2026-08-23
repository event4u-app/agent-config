<!-- evidence-type: analysis -->

# Reviewer-order rotation — pre-registration, and the null it returned

**Date:** 2026-08-23. **For:** `road-to-review-independence` Phase 3, steps 3.1 and 3.3.
**Outcome: `measured-null`.** Step 3.2 is cancelled.

Both halves are in one file on purpose. 3.1 asks for a pre-registration whose date
precedes the measurement artefact; the pre-registration below is written first and the
null is recorded beneath it, so a reader can see the threshold was fixed before the
outcome rather than fitted to it.

## 3.1 — the pre-registration

**The question:** does rotating or shuffling reviewer file order change the finding set on
a frozen corpus of past reviews, by more than the pre-registered margin?

**Threshold, fixed here:** rotation ships only if the finding set differs by **> 15 %**
(symmetric difference over union, per review, median across the corpus). Below that, the
control is noise against ordinary variance and the prose that specifies it is
unimplementable-for-cause rather than merely unimplemented.

**The honest-null exit, also fixed here:** if the counterfactual cannot be produced, or if
the difference is at or under the margin, step 3.2 is marked `[-]` and the null is written
**beside the prose it qualifies** — `src/skills/code-review/SKILL.md:107-110` — so the next
reader knows the control was measured and not merely skipped.

## What the corpus can and cannot answer

`agents/evidence/reviews/` holds **123** `*.findings.md` artefacts. That is a real frozen
corpus, and it is three times the size an earlier estimate in this run put it at. The
shuffle primitive also already exists: `ai_council/blind_review.ts:42` exports
`deterministic_shuffle_indices`.

**And the corpus still cannot answer the question.** A findings artefact records what a
reviewer **found**, not the file order they were given. Nothing in it identifies the
ordering, so "what would this reviewer have found under a different order" is not
recoverable from the record — each artefact is one sample from one unrecorded ordering.

Re-deriving the counterfactual therefore requires **re-running reviewers**: fresh
dispatches whose outputs are new judgements rather than replays. That is a different
experiment, and its confound is immediate — two dispatches of the same reviewer over the
same files in the same order do not return identical finding sets, so an observed
difference between two *orderings* is ordering plus run-to-run variance.

## The null, in four parts

- **Unavailable capability.** The ordering counterfactual. The recorded corpus does not
  carry file order, and no artefact in it can be re-derived under a different one.
- **Affected claims.** Nothing establishes that reviewer-order rotation changes findings,
  in either direction. `src/skills/code-review/SKILL.md:107-110` specifies the control as
  prose and **no consumer in `src/scripts/` implements it** — that remains true, and it is
  now true *for a recorded reason* rather than by omission.
- **Evidence boundary.** The corpus size (123) and the shuffle primitive are both real and
  both irrelevant to the blocker: the missing input is the ordering label, not the sample
  size or the algorithm. What a re-review would measure is ordering **confounded with**
  model variance unless the design carries same-order repeat arms to estimate the baseline.
- **Reopening condition.** Either (a) findings artefacts start carrying the file order they
  were produced under — at which point the counterfactual becomes observational and the
  corpus answers it directly; or (b) a design with same-order repeat arms and a stated
  power calculation is funded, so ordering can be separated from variance rather than
  reported on top of it.

## Why not run a reduced-power version

Considered explicitly and refused. A knowingly underpowered crossover **would not be the
pre-registered experiment**: it would compare two orderings without the repeats needed to
estimate the baseline it is being compared against, and a difference at or under the 15 %
margin would then be indistinguishable from noise. Reporting that as either a pass or a
null risks a **false closure** on a control the prose still specifies — worse than an
honest null, because a null names what is missing and a false closure hides it.

AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), on
a tiebreak after a 1–1 split. The dissenting position is worth keeping because it is
correct on its own terms: *"run-to-run variance is a confound to estimate, not proof that
the experiment is unrunnable"*, and a randomized repeated balanced crossover with
same-order repeats **would** answer this. What decided it against running now was that the
design's own author added the caveat — *"the required repetitions may be expensive and
still underpowered if model variance dominates"* — and that this is a roadmap-drain run
whose mandate is closing roadmaps, not funding another roadmap's experiment.

## What is offered instead, and it is not a substitute

The one thing the recorded corpus **can** support is observational: whether findings
cluster by position within the file lists the artefacts do record. That is not the
counterfactual and cannot license rotation; it would only inform whether reopening is
worth funding. Named here as the cheap next probe rather than performed, because Phase 3
is gated on the pre-registered question and this is a different one.
