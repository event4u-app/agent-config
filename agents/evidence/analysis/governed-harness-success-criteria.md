<!-- evidence-type: analysis -->

# Governed harness evolution — programme success and failure

`road-to-governed-harness-evolution` step 0.7, pre-registered **before the first
candidate run** and falsifiable in both directions. Written 2026-08-30.

The master this roadmap consolidates *"has no success-criteria section at all"*:
it adopted the per-candidate metric vector and dropped the per-programme
metrics, so nothing defined when Phases 0–7 as a whole had succeeded. Both
parents named four families; all four are carried.

**Pre-registration is the point.** Criteria written after a run are a
description of that run. These are committed while zero candidates exist, which
is what makes the failure conditions below capable of firing at all.

## The four families

### 1. Harness-update quality — are the changes this programme makes good ones?

| Succeeds if | Fails if |
|---|---|
| A promoted artefact's paired verdict is `pass` on its target metric **and** `no-change` or better on every other metric in the vector. | Any promotion is accepted on a `underpowered` verdict, which `paired_verdict.ts:25-26` already refuses to call a pass and which a reader mistakes for one. |
| Every promotion carries the evidence package Phase 7.1 defines. | A promotion lands with a verdict but no reproducible package. |

### 2. Harness benefit — is the harness better than not having it?

| Succeeds if | Fails if |
|---|---|
| The three-arm delivery experiment (6.1) shows a direction, in either direction, with the holdout intact. | The experiment is run after the corpus that scored it was grown by the same pipeline — Risk 3, and 2.5's hash-frozen holdout is the mitigation. |
| An honest null is reported as a null. | A null is reported as "inconclusive, needs more trials" and the programme continues by default. |

### 3. System quality — did the wider tree get better or worse?

| Succeeds if | Fails if |
|---|---|
| Estate size is flat or falling across the programme: no net growth in always-loaded budget, skill count, or artefact count attributable to promotions. | Monotonic estate growth after the gate — Risk 8. Every promotion adds and nothing reopens a promoted artefact, so 7.6's RETIRE path must be **exercised**, not merely defined. |
| Existing gates stay green throughout. | A gate is weakened to let a promotion through. |

### 4. Evolution efficiency — was the programme worth running?

Both parents named this family and the master dropped it entirely. It is the
family that can fail while the other three pass, which is exactly why it is
here.

| Metric | Succeeds if | Fails if |
|---|---|---|
| Cost per promoted improvement | Falls, or is at least stated, across the programme. | Never measured — the failure this row exists for. |
| Trials per frontier improvement | Bounded and reported. | Unbounded: the frontier moves only with more trials, indefinitely. |
| Share rejected at cheap cascade stages | High, and rising. | Most candidates reach the expensive stage, which means the cheap stages discriminate nothing (4.1's cascade is then decoration). |
| Proposer cost against solver benefit | Proposer cost is a minority of total programme cost. | The proposer costs more than the improvements it finds are worth — "search becomes the product", Risk 9. |

## Programme-level verdicts, and all three are acceptable outcomes

- **SUCCEEDED** — at least one promotion meets family 1, family 2 shows a
  direction, family 3 is flat or better, and family 4 is measured and bounded.
- **HONEST NULL** — the machinery ran, the holdout held, and no candidate beat
  the baseline. **This is a success of the programme, not a failure**: 0.6
  states that an honest null *"is a success when it prevents unnecessary
  architecture"*, and this estate has three recorded instances where a null read
  as a category limit was the correct and expensive-to-obtain answer.
- **FAILED** — any of: a promotion accepted on `underpowered`; the holdout
  compromised; estate growth attributable to promotions with no RETIRE exercised;
  or family 4 never measured.

The fourth failure mode deserves its own sentence, because it is the one a
successful-looking programme produces: a run can promote real improvements, keep
the estate flat, and still be a failure if nobody can say what it cost per
improvement. Unmeasured efficiency is a FAILED verdict here, not an omission.

## Falsifiable in both directions — the check 0.7 actually asks for

Each row above names a condition under which the programme is declared a failure
**while it is still running**, not only in retrospect. The direction that is
easy to forget is the other one: each also names what would establish success,
so a programme that meets its criteria cannot be talked into continuing by
someone who wanted a different answer.

**What this document does not do.** It defines no thresholds for family 4's four
metrics, and that is deliberate rather than incomplete: a numeric target set
before a single trial exists would be invented, and this estate has a standing
rule against exactly that. The pre-registration is that the metrics are
**measured and reported**; the thresholds are set from the first run's own
measurement, in the open, and a run that reports none of them fails on the row
above regardless of its verdict.
