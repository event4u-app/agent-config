<!-- evidence-type: analysis -->

# Consensus confidence — what the field should carry (REFERENCE ONLY)

**Date:** 2026-08-23. **For:** `road-to-review-independence` step 2.3, which is explicitly
**reference only**: *"do not edit the file."*

**No path under `src/skills/judge-synthesis/` is touched by this roadmap's diff.** That
skill is owned by `road-to-spec-axis-in-review`, and this file exists so the design is
recorded for that owner rather than implemented here or lost. Editing it from this roadmap
would be the cross-ownership drive-by the step forbids.

## The gap the field would close

`ReviewIndependence` now records **two** axes — model family and, since step 2.1, author
relation. Both describe the reviewers' *setup*. Neither describes the **outcome**: whether
the judges that ran actually agreed.

Those come apart in both directions, which is why one cannot be read off the other:

- **High independence, low consensus.** Two fresh cross-family reviewers returning
  contradictory finding sets is a strong setup with a weak result. The record says
  `accepted`, and the reader cannot see that the judges disagreed.
- **Low independence, high consensus.** Five same-session judges agreeing unanimously is
  the shape a self-review produces by construction. `provisional` is correct, but a
  consumer looking for a reason sees only the setup axis.

## What the field should carry

**Name:** `consensus_confidence`. **On:** the same review-of-record the independence fields
sit on, so a reader gets setup and outcome from one document.

**Value:** derived, never hand-set — the same design rule the independence pair already
carries (`review_independence.ts:10-13`: *"the derived field follows from the recorded one,
so an inconsistent pair is unrepresentable rather than merely forbidden"*).

| value | condition |
|---|---|
| `unanimous` | every judge that returned reached the same verdict, **and** ≥ 2 judges returned |
| `majority` | verdicts differ, and one is held by more than half of the returning judges |
| `split` | no verdict is held by more than half |
| `single` | exactly one judge returned — not a consensus, and must not be labelled one |
| `unknown` | judge verdicts were not recorded |

**`single` is the load-bearing value.** Without it, a one-judge review reads as `unanimous`
— a majority of one — which is the exact substitution the whole independence record exists
to prevent, reappearing on the outcome axis. `unknown` maps like its sibling on the family
axis: absence of a record is not evidence of agreement.

## What it must NOT do

- **Not be combined with independence into a single score.** A number would let a high
  consensus offset a weak setup, and the two axes exist precisely because that trade is not
  legitimate. Report both, always, side by side.
- **Not gate anything on its own.** A `split` outcome is information for a reader, not a
  refusal — judges disagreeing is often the review working.
- **Not be inferred from finding counts.** Two judges filing four findings each are not
  thereby in agreement; the field is about verdicts, and inferring it from volume is the
  effort-for-independence substitution `Assurance` already documents.

## Handover

The owning roadmap is `road-to-spec-axis-in-review`. This file is the input; nothing here
is implemented, and step 2.3's verify is that
`git diff --name-only origin/main...HEAD -- src/skills/judge-synthesis/` is **empty**.
