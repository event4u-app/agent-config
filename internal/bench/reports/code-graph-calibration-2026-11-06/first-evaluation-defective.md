# Review-risk calibration — results

Proposal: **P (removes: none)** · applied: **no** (nothing to change: no term was dispensable in every subject and the test gap did not help in every subject).

## Subjects

| Subject | units | defect-inducing | validation / test |
|---|---:|---:|---|
| self | 399 | 45 | 239 / 160 |
| unopim | 393 | 107 | 235 / 158 |

## Terms on the validation split

Dispensable = dropping the term changes Popt by ≥ −0.01 and the block-bootstrap 2.5 % bound of the change is ≥ −0.02.

| Term | self: verdict (ΔPopt, lower, fires) | unopim: verdict (ΔPopt, lower, fires) |
|---|---|---|
| callers | contributes (-0.248, -0.404, 122) | dispensable (0.347, 0.228, 141) |
| entry points | no evidence (—, —, 0) | no evidence (—, —, 0) |
| flows | no evidence (—, —, 0) | no evidence (—, —, 0) |
| missing partners | no evidence (—, —, 0) | no evidence (—, —, 0) |
| area crossings | no evidence (—, —, 0) | no evidence (—, —, 0) |
| columns | no evidence (—, —, 0) | no evidence (—, —, 0) |
| operations | no evidence (—, —, 0) | no evidence (—, —, 0) |
| pipelines | no evidence (—, —, 0) | no evidence (—, —, 0) |
| test gap (+2 × untested) | does not help (-0.068, -0.169) | helps (0.064, 0.006) |

## Confirmation on the untouched test split

| Subject | Popt S0 | Popt P | Popt ManualUp | ACC@20 S0 | ACC@20 P | lower(P − S0) | non-inferior | units changing band |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| self | 0.790 | 0.790 | 0.749 | 0.500 | 0.500 | — | n/a | 0 |
| unopim | 0.550 | 0.550 | 0.805 | 0.333 | 0.333 | — | n/a | 0 |

## Bands on the test split (S0)

| Subject | low (defective / units) | medium | high |
|---|---|---|---|
| self | 5 / 111 | 8 / 27 | 7 / 22 |
| unopim | 11 / 127 | 5 / 15 | 5 / 16 |
