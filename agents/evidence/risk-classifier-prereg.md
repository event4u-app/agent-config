<!-- evidence-type: analysis -->

# Pre-registration — does a deterministic risk classifier beat the agent's self-label?

**Written 2026-08-23, and committed BEFORE any number is seen.** Step 0.1 of
`road-to-target-project-assurance-readiness`. Risk 6 of that roadmap is the reason this
file exists at all: *"a threshold set once agreement and R3-recall are known is not a
threshold, and nothing in a prose plan prevents the ordering from silently inverting."*
The ordering is checkable — `git log --format=%aI -1 -- agents/evidence/risk-classifier-prereg.md`
must precede every measurement artefact's date — which is why this lands in its own commit
ahead of the classifier.

## The question

> Does a deterministic path+diff classifier agree with **a human's** risk label more often
> than the implementing agent's self-declared label?

The human label is the reference standard. The two things compared **against** it are the
deterministic classifier and the agent's own self-declaration. This matters for what an
agent-produced label would and would not be: substituting an agent for the human makes the
reference standard and one of the compared arms the same kind of judgement, which is the
comparison this pre-registration exists to make.

## Corpus

- A commit range of this tree, plus **one external target repo the maintainer names**.
- **≥ 60 changes**, labelled `R0`–`R3`, labeller blind to the classifier.
- Stored as `agents/evidence/risk-corpus.jsonl`, one row per change, with `sha`,
  `label`, `labeller`, and **no** `classifier` field until the classifier has run.

## Thresholds — fixed here, before any measurement

| metric | threshold | why this one |
|---|---|---|
| agreement with the human label on R3 | **≥ 0.80** | the class that carries the heaviest owed-gate set |
| **R3-recall** | **≥ 0.95** | a missed R3 is the failure that matters: it is the change that skips the gates it owed |

R3-recall is the binding metric. Agreement can be bought by classifying everything R3;
recall cannot be bought by classifying everything R0. Both are reported, whatever they are.

## The three routes — declared before the run

| route | condition | consequence |
|---|---|---|
| **pass** | both thresholds met | Phases 1–3 open |
| **null** | either threshold missed, **or the corpus cannot be produced** | Phase 1 still ships (the matrix needs no classifier); Phase 2 is marked `[-]`; the standing nightly metric from 0.3 keeps running so a later run can re-open it |
| **ambiguous** | agreement ≥ 0.80 but R3-recall in [0.85, 0.95) | the classifier ships **advisory only** — it prints its class and owes no gate — and the nightly metric runs for 30 days before the route is re-decided against the same two thresholds |

The `null` route's second clause — *"or the corpus cannot be produced"* — is stated here
rather than discovered later. A pre-registration whose routes cover only outcomes of a run
that happened is not a pre-registration; it is a results section.

## Re-open threshold, numeric

A `measured-null` closure re-opens when **both** hold, read off
`agents/evidence/risk-classifier-drift.jsonl`:

1. A human-labelled corpus of **≥ 60 changes** exists (the missing input).
2. The nightly drift metric shows an **R3 rate ≤ 40 %** over the trailing 30 days.

The second is not decoration. Risk 2 of the roadmap names *"> 40 % of changes classifying
R3"* as a defect **in the override list**, not in the people meeting the gates — so
re-opening on a corpus alone, while the classifier calls most changes critical, would wire
alert fatigue into every completion claim. Both numbers or neither.
