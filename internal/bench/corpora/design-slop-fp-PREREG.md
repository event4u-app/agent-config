# Pre-registration — design-slop false-positive rate and recall

> Written **before** the first run, per `road-to-design-detector-evidence`
> Phase 2 Step 3. Nothing below is adjusted after seeing a number. An amendment
> is allowed but must be git-visible and dated; an amendment committed after the
> numbers land is not an amendment, it is a post-hoc threshold.

## Why this exists

A prior decision deferred growing the slop registry beyond its objective subset
"only after Phase 5's objective subset proves a low false-positive rate in real
consumer use". That precondition cannot be met by any work in any plan: the
package has no consumer telemetry, so no run produces evidence about *consumer
use*. A deferral whose condition nothing can satisfy is a permanent stop wearing
a temporary label.

This instrument does not lift that deferral and does not claim to. It produces
the measurement the deferral is *asking* for, against the strongest proxy this
repo can honestly build — clean UI it did not write for the detector — so that
whoever revisits the deferral has a number instead of an absence.

## What is being measured

Two metrics, deliberately not collapsed into one score.

**M1 — per-rule false-positive count.** For each rule in
`src/scripts/design_slop_rules.ts`, the number of files in the clean corpus on
which it emits at least one finding. **Counting is per file, not per hit**: a
rule matching six lines of one file is one false positive, because the unit a
consumer experiences is "this rule flagged this file". Aggregate reported
alongside, never instead: the number of rules with a non-zero count.

**M2 — per-rule recall on the positive fixtures.** For each rule, whether it
fires on its own positive fixture. This is a **weak** metric and is labelled as
one — the fixture was authored for the rule, so recall here says the rule is
wired, not that it generalises.

M2 is **not re-measured by this bench**. It is already a hard assertion in
`src/scripts/design_slop_rules.test.ts` ("positive fixtures fire, negative
fixtures are clean"), so a second implementation reading the same fixtures would
add a number and no evidence — and the fixtures are declared inside that test
file, so exporting them to a runner would move a test's data into shipped code
for no gain. M2 is therefore reported as **suite-enforced**: it is 19/19 because
the suite fails otherwise, and the citation is the measurement. Recording it this
way rather than printing a self-computed 19/19 is the difference between a number
and a restatement.

## The corpus

`internal/bench/corpora/design-slop-clean/` — 32 files, 8 per file class
(`.css`, `.html`, `.jsx`, `.md`), covering all four engines (`.html` and `.jsx`
carry `css` and `copy` in addition to their own). Every file carries a one-line
header stating why it is clean.

**Every file is labelled clean by construction**, so any finding on the corpus is
a false positive by definition. There is no positive half; the positive side is
the existing fixture set, and mixing the two would let a good recall number hide
a bad precision one.

**Pinning.** The bench computes a SHA-256 over the sorted list of
`<relative path>:<sha256 of contents>` and prints it with every run. A number
quoted without its corpus hash is not comparable to any other number. Changing
the corpus starts a new epoch; it does not update an old result.

**Known limit, stated up front.** The corpus is authored inside this repo, by the
same effort that ships the detector, and with the candidate rules already named
in the roadmap. It is therefore not blind. What the ordering buys is that the
corpus and this file are committed and pinned **before** any candidate rule
exists, so the number cannot be moved once it is seen. That is a weaker claim
than independence, and it is the one being made.

## The ceiling, declared before the run

**A rule ships, or stays, only at M1 = 0.**

Zero is the bar rather than a percentage because of what these rules are: the
registry is a set of *rebuttable presumptions* surfaced to a human as flags. A
flag on clean UI is not a rounding error, it is the failure mode that trains the
reader to ignore the flag — and one noisy rule discredits the eighteen quiet
ones. A rule with M1 ≥ 1 is demoted to `judgment-only` in the catalog's
§ Detector status with the count that demoted it, not tuned until it passes.

**Kill-switch.** If any rule that ships *today* records M1 ≥ 1, that finding
outranks any expansion: the offending rule is demoted or tightened before a
single new rule is added. A registry whose current members are false-positive
does not get more members.

## Predictions, recorded so they can be wrong

1. **M2 aggregate = 19/19.** Every rule fires on its own fixture; the suite
   already asserts the fixture exists, so a miss would mean the assertion is
   weaker than it reads.
2. **M1: between 0 and 3 rules non-zero.** The copy rules (`CP1` em-dash density,
   `CP2` buzzwords) and `T7` (overused fonts) are the most likely to fire on
   realistic clean material, because their tells appear in legitimate writing and
   in ordinary font stacks.
3. **The honest-null branch is live.** If M1 = 0 for all 19, the run has *not*
   shown the detector is precise — it has shown this corpus does not discriminate,
   which is a statement about the corpus. That outcome is published as such and
   is not reported as a precision result.

## What this does not measure

- Precision on real consumer projects. Nothing here is consumer telemetry.
- Whether the tells are the *right* tells. That is the catalog's argument, not
  this instrument's.
- Recall on unseen slop. The positive side is fixtures, and fixtures are not a
  sample of the world.
