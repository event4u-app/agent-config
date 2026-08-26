---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: the human-labelled risk corpus

> **Stub — not active work.** Transferred out of
> `road-to-target-project-assurance-readiness` blocker `b-human-risk-corpus` on
> 2026-08-23, when that roadmap closed on its pre-registered **null** route. It
> carries the one input an agent cannot produce, so that the input stays visible
> in the active estate rather than disappearing into an archived roadmap.

## What is needed

Two things, both from the maintainer, both fixed by
`agents/evidence/risk-classifier-prereg.md` before any number was seen:

1. **Name the external target repository** that joins this tree's commit range as
   the corpus.
2. **≥ 60 independently human-labelled R0–R3 changes**, the labeller **blind to the
   classifier**, as `agents/evidence/risk-corpus.jsonl` with `sha`, `label` and
   `labeller` per row, and **no** `classifier` field until the classifier has run.

## Why an agent cannot do this, stated precisely

The pre-registered question is *"does a deterministic path+diff classifier agree with
**a human's** risk label more often than the implementing agent's self-declared
label?"* The human label is the **reference standard**, and the agent's own label is
one of the two things measured **against** it.

So an agent labelling the corpus does not produce a weaker version of the
experiment — it produces a different one, in which the reference standard and one
compared arm are the same kind of judgement. Reporting that under the pre-registered
question is the manufactured result the pre-registration exists to prevent. This is
why the blocker was transferred rather than worked around.

## What already exists, so this is data collection and not design

- The pre-registration is **written and frozen**, with both thresholds (R3 agreement
  ≥ 0.80, R3-recall ≥ 0.95) and all three routes fixed in advance.
- The classifier exists — `src/scripts/classify_change_risk.ts`, deterministic, no
  model call, `--self-test` 7/7 with 3 reject arms.
- The nightly drift metric exists and is running —
  `.github/workflows/risk-class-drift.yml` appending to
  `agents/evidence/risk-classifier-drift.jsonl`.

A later run re-runs the measurement. It does not redesign it.

## Promotion criterion

Both pre-registered numbers, and they are **conjunctive**:

1. `agents/evidence/risk-corpus.jsonl` holds **≥ 60** human-labelled changes.
2. `agents/evidence/risk-classifier-drift.jsonl` shows an **R3 rate ≤ 0.40** over the
   trailing 30 days.

The second is not decoration. The first drift readings were **0.536** (14 days) and
**0.477** (30 days) — both above the threshold that the parent roadmap's Risk 2 calls
a defect **in the override list** rather than in the people meeting the gates.
Promoting on a corpus alone, while the classifier calls roughly half of all changes
critical, would wire alert fatigue into every completion claim.

That breach is a real open finding and is recorded in
`agents/evidence/risk-classifier-null.md`: the override list was specified for
**target projects**, and its self-protection half (`src/config/`, hook directories,
CI workflows) covers everyday work in *this* repository. Tuning it is deliberately
**not** done ahead of the corpus — tuning a classifier against no reference standard
is what the pre-registration forbids, and it would tune the very number this
promotion criterion is measured on.
