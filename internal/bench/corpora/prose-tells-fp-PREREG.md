# Pre-registration — prose-tell false-positive rate

> Written **before** the first run, per `road-to-measured-prose-tells` Phase 1
> step 1.1. Nothing below is adjusted after seeing a number. An amendment is
> allowed but must be git-visible and dated; an amendment committed after the
> numbers land is not an amendment, it is a post-hoc threshold.

## Why this exists

`tests/fixtures/ai-tells/` holds 20 before/after pairs and **no clean corpus**.
Every fixture is a seeded tell and its repair, so the corpus can only answer
"does the rule fire on text written to make it fire". The false-positive rate of
every rule in `src/scripts/ai_tells_rules.ts` is therefore unknown by
construction — including for a detector that ships default-on inside
`/humanize` and write-engine step 4b.

The design side already solved this shape once:
`internal/bench/corpora/design-slop-clean/` plus
`internal/bench/corpora/design-slop-fp-PREREG.md`. This file is the prose
equivalent and borrows that instrument deliberately rather than inventing a
second one.

## What is being measured

**M1 — per-rule false-positive count.** For each rule in the registry, the
number of files in `tests/fixtures/ai-tells/clean/` on which it produces at
least one match. **Counting is per file, not per hit**: a rule matching six
lines of one file is one false positive, because the unit a reader experiences
is "this rule flagged this file". Reported alongside, never instead: the number
of rules with a non-zero count, and the per-file threshold verdict (how many
clean files the gate would reject outright at the shipped defaults).

**M2 — recall is deliberately NOT measured here.** The seeded corpus already
carries it and `tests/scripts/detect_ai_tells.test.ts` already asserts it
(before exceeds thresholds, after passes). Re-measuring it in this instrument
would add a number and no evidence, and mixing precision and recall into one
score lets a good recall figure hide a bad precision one.

## The corpus

`tests/fixtures/ai-tells/clean/{en,de}/` — at least 30 markdown files of
human-authored deliverable prose (release notes, posts, emails, briefs,
changelog entries), with **no company-identifying text**. Every file opens with
a blockquote line stating why it is clean; blockquote lines are exempt from
scanning (`stripExempt`), so the label never influences the measurement.

**Every file is labelled clean by construction**, so any match on the corpus is
a false positive by definition. There is no positive half.

**Near-misses are required, not avoided.** The corpus deliberately contains the
hard legitimate cases for each rule family: ordinary three-item lists, a
paragraph carrying two em dashes, a genuine rhetorical question, a deliberate
four-word line, ordinary technical vocabulary, editor-curled quotation marks,
an ordinary German connective. A corpus built to pass measures nothing and
certifies everything; a first run of M1 = 0 across the board would be evidence
about the corpus, not about the detector.

**Pinning.** The bench computes a SHA-256 over the sorted list of
`<relative path>:<sha256 of contents>` and prints it with every run. A number
quoted without its corpus hash is not comparable to any other number. Changing
the corpus starts a new epoch; it does not update an old result.

**Known limit, stated up front.** The corpus is authored inside this repo by
the same effort that repairs the detector, with the two defects already named
in the roadmap. It is not blind. What the ordering buys is that this file is
committed **before** the first measurement, so the expectations below cannot be
moved once a number is seen. That is a weaker claim than independence, and it
is the one being made.

## The ceiling, declared before the run

**A rule family promoted by Phase 2 ships only at M1 = 0.**

Zero is the bar rather than a percentage because of what these rules are:
rebuttable presumptions surfaced to a writer as flags. A flag on clean prose is
not a rounding error, it is the failure mode that trains the writer to ignore
the flag, and one noisy rule discredits the quiet ones.

**The bar for rules that ALREADY ship is different, and saying so is the honest
half.** An existing rule recording M1 ≥ 1 is a measured precision finding. It is
recorded with its count and its hitting files; it is repaired where this
roadmap's steps name the repair (1.2 for `tell-rule-of-three`, 1.3 for the
density thresholds) and otherwise carried as a published number. It is not
quietly deleted, and the corpus is not edited to make it go away.

## Predictions, recorded so they can be wrong

1. **M1 ≥ 1 for `tell-rule-of-three`.** Its single pattern matches any
   Oxford-comma triplet, and ordinary deliverable prose contains those. This is
   the defect step 1.2 exists to repair; a zero here would mean the corpus
   avoided the case it was built to carry.
2. **The dash-density threshold rejects at least one clean file before step 1.3
   lands, and that file is a short one.** The density is `n/words*500` with no
   minimum denominator, so a six-word line with one dash scores 83.33.
3. **Between 2 and 6 rules record a non-zero M1 in total.** The most likely
   additional hitters are `tell-ai-vocabulary` (`seamless`, `underscore`,
   `pivotal` all appear in ordinary technical and business prose),
   `tell-curly-quotes` (editors curl quotes automatically) and
   `tell-de-connector-stack` (`zudem` and `darüber hinaus` are ordinary German
   connectives, not tells).
4. **After steps 1.2 and 1.3 land, `tell-rule-of-three` records M1 = 0 and no
   clean file is rejected on density alone.** If either still fails, the repair
   did not work and the step is not done.
5. **The honest-null branch is live.** If M1 = 0 for every rule on the first
   run, this instrument has not shown the detector is precise — it has shown
   this corpus does not discriminate. That outcome is published as a statement
   about the corpus and is not reported as a precision result.

## What this does not measure

- Precision on real drafts. Nothing here is usage telemetry, and the
  real-draft question is gated by a separate blocker on this roadmap.
- Whether the tells are the *right* tells. That is the pattern catalog's
  argument, not this instrument's.
- Recall on unseen slop. The positive side is fixtures, and fixtures are not a
  sample of the world.
