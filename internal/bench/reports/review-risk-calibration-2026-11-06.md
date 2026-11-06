# Review-risk calibration — 2026-11-06

Roadmap: `road-to-a-graph-that-wins` 5.6. Registration:
`internal/bench/code-graph/PREREGISTRATION-risk-calibration-2026-11-06.md` (council-revised;
addenda A1–A2). Runner: `internal/bench/code-graph/risk_calibration.ts`. Method: Kamei et al.
(TSE 2013), effort-aware, forward-in-time, applied to the **fixed** shipped rule.

**Result: nothing changes.** On validation, `entry points`, `flows`, `area crossings` and
`pipelines` were dispensable in both subjects, so the proposal dropped them; on the untouched
test split that proposal failed the non-inferiority bound in both subjects (2.5 % bounds −0.026
and −0.039 against −0.02). By the registered rule no term is removed and the test gap is not
added. Weights and band cuts were out of scope by registration and are unchanged.

## Data

| Subject | units | defect-inducing | fixes matched / used | SZZ links | fix delay (median / p75 / p90, days) | label audit (plausible / unclear / implausible of 20) |
|---|---:|---:|---|---:|---|---|
| self | 399 | 45 | 178 / 118 | 618 | 17 / 41 / 51 | 10 / 4 / 6 — at the usability floor |
| unopim | 393 | 107 | 243 / 177 | 9,268 | 19 / 32 / 70 | 13 / 4 / 3 |

The 60-day maturity window covers the median and the 75th percentile of the observed fix
delay in both subjects and the 90th in `self`; in `unopim` about one link in ten arrives later,
so its most recent units are somewhat under-labelled. The audit was an independent tool-less
session given each sampled fix and candidate diff with a neutral question; its prompt is in
`code-graph-calibration-2026-11-06/audit-*.json`.

## A defective first evaluation, published

The first evaluation ran on features that did not match the shipped `build` verb (lanes off,
blob-less clones): seven of eight terms never fired, and it proposed nothing. The cause was a
runner defect and, behind it, a product one — `review-risk` read a lane-backed term as `0`
when its lane never ran — fixed in this change (addenda A1–A2). Its report is kept beside this
one (`code-graph-calibration-2026-11-06/first-evaluation-defective.md`). Every number below is
from the corrected re-extraction; no rule, threshold, split, seed or label changed.

## Reading

- **`callers` and `missing partners` carry the score.** Dropping either costs validation Popt
  in both subjects (`callers` −0.12 / −0.10).
- **The four lane terms add nothing measurable to a source-defect ranking, and removing them
  together still costs a little.** Individually each is within the tolerance; jointly the test
  split shows a small loss whose bound crosses −0.02. The registered rule therefore keeps them.
  Their labels cover source defects only — the operational failures `pipelines` and `operations`
  point at are outside SZZ — so "dispensable" here means "no source-defect signal", nothing more.
- **`columns` never fired** in 800 units: no evidence, kept.
- **The test gap does not help** in either subject at weight 2.
- **ManualUp beats the shipped rule on `unopim`** (Popt 0.805 against 0.593; on `self` 0.749
  against 0.776). Ranking by score per changed line pushes large changes down; in `unopim` the
  small changes carry the defects. That is a weight-and-normalisation question this run was
  registered not to answer; it is the first input for any weight calibration.
- **The bands do separate defect rates** on the test split: `self` low 3 / 88, medium 7 / 37,
  high 10 / 35; `unopim` low 9 / 111, medium 6 / 24, high 6 / 23.

## Subjects

| Subject | units | defect-inducing | validation / test |
|---|---:|---:|---|
| self | 399 | 45 | 239 / 160 |
| unopim | 393 | 107 | 235 / 158 |

## Terms on the validation split

Dispensable = dropping the term changes Popt by ≥ −0.01 and the block-bootstrap 2.5 % bound of the change is ≥ −0.02.

| Term | self: verdict (ΔPopt, lower, fires) | unopim: verdict (ΔPopt, lower, fires) |
|---|---|---|
| callers | contributes (-0.124, -0.207, 122) | contributes (-0.098, -0.190, 141) |
| entry points | dispensable (-0.000, -0.001, 1) | dispensable (-0.003, -0.015, 55) |
| flows | dispensable (0.000, 0.000, 1) | dispensable (0.001, -0.004, 55) |
| missing partners | contributes (0.023, -0.021, 108) | contributes (-0.018, -0.043, 61) |
| area crossings | dispensable (0.000, -0.010, 57) | dispensable (-0.001, -0.007, 71) |
| columns | no evidence (—, —, 0) | no evidence (—, —, 0) |
| operations | no evidence (—, —, 0) | dispensable (0.003, -0.000, 18) |
| pipelines | dispensable (0.007, -0.006, 36) | dispensable (-0.000, -0.007, 31) |
| test gap (+2 × untested) | does not help (-0.023, -0.109) | does not help (0.028, -0.030) |

## Confirmation on the untouched test split

| Subject | Popt S0 | Popt P | Popt ManualUp | ACC@20 S0 | ACC@20 P | lower(P − S0) | non-inferior | units changing band |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| self | 0.776 | 0.767 | 0.749 | 0.450 | 0.450 | -0.026 | no | 9 |
| unopim | 0.593 | 0.598 | 0.805 | 0.429 | 0.381 | -0.039 | no | 7 |

## Bands on the test split (S0)

| Subject | low (defective / units) | medium | high |
|---|---|---|---|
| self | 3 / 88 | 7 / 37 | 10 / 35 |
| unopim | 9 / 111 | 6 / 24 | 6 / 23 |
