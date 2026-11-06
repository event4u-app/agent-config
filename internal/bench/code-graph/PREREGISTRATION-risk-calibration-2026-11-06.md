# Pre-registration — review-risk calibration (road-to-a-graph-that-wins 5.6), 2026-11-06

Committed before any label exists. The design was put to the AI council (2/2 seats,
anthropic and openai, design lens, 2026-11-06) and revised on its convergent findings
(§ Council revisions). Runner: `internal/bench/code-graph/risk_calibration.ts`, pure parts
pinned by `tests/scripts/code_graph/risk_calibration.test.ts`. Method: Kamei et al., TSE
2013 (just-in-time defect prediction, effort-aware), adapted to a forward-in-time split and
to a **fixed** scoring rule rather than a fitted model.

## What this run decides, and what it does not

It decides whether any of the eight `review-risk` terms can be **removed** without making
the shipped ranking worse, and whether a **test-gap** term should be added. It does **not**
refit weights or band cuts: that is weight calibration, a separate question, and the step
asks only that a term which contributes nothing be removed. A result of "insufficient
evidence to change anything" is a complete result and changes nothing.

## Units and subjects

A **unit** is a first-parent commit on the subject's trunk against its first parent (on this
repository's `main` that is one merged PR). **Effort** = added + deleted lines over all files.
Units with zero effort are dropped.

| Subject | Trunk tip | Units |
|---|---|---|
| `self` | `d69ebbfe8b` (`main`, just after the cutoff) | the 400 most recent units merged ≥ 60 days before the cutoff |
| `unopim` | `56071226` (the v3 pin, branch `3.x`) | the 400 most recent units merged ≥ 60 days before the cutoff |

`larasend` is left out (too few units). **Cutoff:** this document's commit. **Maturity:**
units from the last 60 days are never sampled, so their labels have had time to arrive;
the observed fix-delay distribution is reported so the window can be judged.

## Features

Per unit, the engine built at that commit (incremental rebuild along the trunk) and
`reviewRisk(… parent …)`: the item count of each of the eight terms, which terms were
`unknown` (unavailable, not zero), and the number of changed symbols the `untested-change`
check marks `untested`.

## Labels (SZZ)

A **fix unit** is a trunk commit merged between the first sampled unit and the cutoff whose
subject line has the conventional type `fix` or one of the words *fix, fixes, fixed, bug,
bugfix, regression, hotfix*, **and** which modifies or deletes at least one production
source file of the subject's language (`isTestFile` decides "test"; `vendor/`,
`node_modules/` excluded). Every modified or deleted parent-side line of those files is
blamed with `git blame -w --first-parent` at the fix's parent; a blank line is skipped. A
sampled unit that a blamed line lands on is **defect-inducing**.

**Label audit.** 20 fix→inducing links per subject are drawn with the registered seed and
judged by an independent reviewer (a separate agent session given each fix's and inducing
unit's diff and subject line, and the neutral question "does the inducing change plausibly
contain the defect the fix repairs?"). The prompt is stored with the verdicts. If fewer
than half of a subject's sampled links are judged plausible, that subject's labels are
declared unusable and it contributes **no evidence** to any decision.

## Rules evaluated

- **S0** — the shipped rule: Σ count × `RISK_WEIGHTS`.
- **S0 − t** — S0 without term t, for each of the eight terms.
- **S0 + gap** — S0 plus **2** × untested symbols (2 is the median of the shipped weights).

Each rule ranks units **effort-aware**: by score per changed line, descending; ties go to the
smaller change, then the older one. **Popt** (Kamei's normalised area against the optimal and
the worst order) and **ACC@20** (share of defect-inducing units inside the first 20 % of
effort; a unit crossing the budget is not counted) are computed per subject. **ManualUp**
(smallest change first) is reported as the reference baseline.

## Split, selection and confirmation

Per subject, chronologically: the first **60 %** of units are the **validation** split, the last
**40 %** the **test** split. Nothing is fitted; decisions are taken on validation and confirmed
on test, which no decision touches.

- **Term t is dispensable in a subject** iff on validation Popt(S0 − t) − Popt(S0) ≥ −0.01
  **and** the 2.5 % quantile of that difference under a moving-block bootstrap (blocks of 10
  chronological units, 1,000 resamples, seed 20261106) is ≥ −0.02. A term that fires in no
  validation unit, or is `unknown` in more than 20 % of them, has **no evidence** in that
  subject.
- **The test gap helps in a subject** iff the bootstrap 2.5 % quantile of Popt(S0 + gap) −
  Popt(S0) on validation is > 0.
- **Proposal P** = S0 minus every term dispensable in **every** subject, plus the test gap iff
  it helps in **every** subject. Disagreement, no evidence or an unusable subject keeps the
  term and withholds the gap.
- **Confirmation:** P is applied only if, on the test split of every subject, the bootstrap
  2.5 % quantile of Popt(P) − Popt(S0) is ≥ −0.02. Otherwise nothing changes.

Reported, deciding nothing: ACC@20 for S0 and P, ManualUp, per-band defect rates under S0,
and how many test units change band under P.

## Council revisions (2026-11-06)

Adopted from both seats: report-first with a removal only after an untouched chronological
confirmation of the complete proposal; removal requires agreement across subjects, and
disagreement keeps a term; a validation/test split so selection never touches the
confirming data; fix units restricted to ones changing production source; a label audit;
unavailable terms kept apart from zeros; the test gap given a stated weight and a
cross-subject rule; band movement reported; weight refitting declared out of scope rather
than silently skipped. **Not adopted:** fitting an EALR model (one seat proposed drop-one on a
fitted model) — the shipped rule is a fixed weighted sum and the decision is about that rule,
so the rule itself is evaluated; a 30 % abort on test-only fixes (both seats disagreed on it;
the production-source restriction already removes them).

## Honest limits

- SZZ is a proxy: a fix that adds a missing guard blames nothing, and a refactor can absorb
  blame. The audit measures plausibility, not recall.
- Labels cover source defects later fixed on the trunk; CI, configuration and operational
  failures — what `pipelines` and `operations` partly point at — are outside them, so a
  "dispensable" verdict for those terms means "no source-defect signal", nothing more.
- `self` is agent-authored and recent; `unopim` is a human-authored third-party repository.
- Weights and band cuts are unchanged by construction.

## Hashes (SHA-256)

Any later change to these inputs voids the run unless an addendum below, committed before
labels are computed, names it.

```
809ff95d7e1555d07c4add8bb3678a0a19b8779a14a363ec293578380bf324cb  internal/bench/code-graph/risk_calibration.ts
00e5f59438d18d9363aca78ad01f79a85348f9b00b6b2ed0731177e25db6867c  tests/scripts/code_graph/risk_calibration.test.ts
dec39702c4309ef2cd1a4da3c3852927798a79b4f2e14a3ecfee1ea638783b27  src/scripts/code_graph/review_risk.ts
```

## Addenda

**A1 (2026-11-06): the first feature extraction was defective; it was redone, and the
defective evaluation is published, not hidden.** This addendum comes **after** a first
evaluation, against the registration's own condition that a runner change precede the
labels, and says so plainly. The first evaluation ran on features from a build that did not
match the shipped `build` verb: lanes were off (so `entry points`, `flows`, `columns`,
`operations` and `pipelines` could not fire) and history reads ran on blob-less clones (so
`missing partners` read zero where the shipped path counts partners — measured on unit
`d40628fe`: 0 against 5). Seven of eight terms "never fired" in that run — an artefact, not a
finding. It proposed no change. The runner now builds exactly as the verb does (`lanes: true`
inside the git-visible scope); three `unopim` units were checked to give term counts identical
to `build` + `review-risk --json`; every clone was completed; all features were re-extracted.
**No decision rule, threshold, split, seed or label changed**; the labels depend only on the
unit set, which is unchanged. Both evaluations are in the report; the second is the result.
Labels were audited before either evaluation was read: `self` 10 of 20 sampled links plausible
(4 unclear, 6 implausible) — exactly at the usability floor, so usable; `unopim` 13 of 20 (4
unclear, 3 implausible). New runner hash:
`8fb184b14d907d1da354de2861cf5f2768ab57e81c3ad9805196a7b5c4c31cc5  internal/bench/code-graph/risk_calibration.ts`.

**A2 (2026-11-06): the defect behind A1, fixed in the product.** A1's zero partners were not
an artefact of this runner alone: `review-risk` read a lane-backed term as `0` whenever its
lane had no run record, which is what a `--no-lanes` build (and an older or foreign graph)
produces — the silent zero AC-7 forbids. It now reads `unknown (lane not run)` when such a term
counted nothing (`tests/scripts/code_graph_review_risk.test.ts`, seen red first). On a build
with lanes on — every unit of this run — every lane has a run record, so no feature changes.
New hash: `f7bcef0af7a509de44a289194b6ce88cecfc9fc52a41e03a03d8101e1f029071  src/scripts/code_graph/review_risk.ts`.
