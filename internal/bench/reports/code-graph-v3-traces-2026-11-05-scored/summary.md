# Code-graph benchmark v3 — suites B–E, 2026-11-05-scored

Registered in `internal/bench/code-graph/PREREGISTRATION-v3-2026-11-05.md`; every registered input matched its SHA-256 before the run. Corpus `e89a68cc998ea94a…`.

**Measured commit** `ea2c86f96ab68e4e6e77a37c4fb3b5b0e6fa1228` · engine tree `e0ee681dde617b2c46c654f00a9994a26f658c73`.

| Subject | Pin | native graph | foreign arm |
|---|---|---|---|
| unopim | `56071226255ff8e0f5dc40dafa72eab0f2751d54` | 12354 nodes · 62159 edges · 3889 ms | ABSENT |
| larasend | `da5c06c725f51f537fd8e238e436263665f475d2` | 2462 nodes · 9963 edges · 531 ms | ABSENT |

**Truth:** 0 of 45 questions are `pending-oracle` — scored as PENDING, never as a number. Every arm's raw answer is in `traces.jsonl` for scoring once the step-2.2 oracle lands.

**Truth file:** `internal/bench/code-graph/truth-v3-2026-11-05-strata.yaml`, checked by council · VOID negative controls (removed from the clean-rate): none.

**Answers per arm:** grep 45 (43 non-empty) · native 45 (39 non-empty) · foreign 0 — ABSENT, not zero.

## Per class (route-trace per subject, never pooled)

| Class | Subject | n | grep | native | foreign | native verdict | foreign verdict | verdict-bearing |
|---|---|---|---|---|---|---|---|---|
| precise-semantics | all | 12 | P 0.665 / R 0.813 | P 0.519 / R 0.362 | ABSENT | NULL | ABSENT | yes |
| route-trace | unopim | 3 | P 0.106 / R 0.861 | P 0.464 / R 0.248 | ABSENT | TIE | ABSENT | yes |
| route-trace | larasend | 3 | P 0.046 / R 1 | P 0.889 / R 0.378 | ABSENT | TIE | ABSENT | no (larasend route-trace, published beside) |
| model-table | all | 6 | P 0.083 / R 0.361 | P 0.917 / R 0.361 | ABSENT | TIE | ABSENT | yes |
| tests-for | all | 5 | P 0.2 / R 0.059 | P 0.2 / R 0.012 | ABSENT | TIE | ABSENT | yes |
| change-impact | all | 6 | P 0.792 / R 0.138 | P 0.353 / R 0.322 | ABSENT | NULL | ABSENT | yes |
| change-impact-xplane | all | 4 | P 0 / R 0 | P 0 / R 0 | ABSENT | TIE | ABSENT | yes |

## Strict stratum (no bar)

The same answers against the truth without its two-voice and faked files (registration § Residual strata). It cannot turn a verdict; it shows how much of each result rests on them.

| Class | Subject | grep | native | foreign | native verdict under the same rule |
|---|---|---|---|---|---|
| precise-semantics | all | P 0.665 / R 0.824 | P 0.519 / R 0.373 | ABSENT | NULL |
| route-trace | unopim | P 0.106 / R 0.861 | P 0.464 / R 0.248 | ABSENT | TIE |
| route-trace | larasend | P 0.046 / R 1 | P 0.889 / R 0.378 | ABSENT | TIE |
| model-table | all | P 0.083 / R 0.361 | P 0.917 / R 0.361 | ABSENT | TIE |
| tests-for | all | P 0.136 / R 0.554 | P 0.2 / R 0.421 | ABSENT | TIE |
| change-impact | all | P 0.637 / R 0.363 | P 0.199 / R 0.511 | ABSENT | NULL |
| change-impact-xplane | all | P 0 / R 0 | P 0 / R 0 | ABSENT | TIE |

## Calibration diagnostic (no bar)

Overconfidence rate: the share of returned items carrying the arm's highest confidence label (`EXTRACTED`) that are not in the truth. It decides nothing.
Rendered 2026-11-06 from this run's own `summary.json` (`code-graph-v3-traces-2026-11-05-scored/`); the run computed these figures and the original renderer did not print them. Same run, same numbers — nothing was re-measured.


| Class | Subject | grep | native | foreign |
|---|---|---|---|---|
| precise-semantics | all | no label | 0.455 | ABSENT |
| route-trace | unopim | no label | 0.692 | ABSENT |
| route-trace | larasend | no label | 0.143 | ABSENT |
| model-table | all | no label | 0.143 | ABSENT |
| tests-for | all | no label | no EXTRACTED item | ABSENT |
| change-impact | all | no label | 0.587 | ABSENT |
| change-impact-xplane | all | no label | 1 | ABSENT |

## Per language (scored classes, no bar)

| Language | n | grep | native | foreign |
|---|---|---|---|---|
| js | 3 | P 0.333 / R 0.333 | P 0.333 / R 0.333 | ABSENT |
| php | 33 | P 0.31 / R 0.485 | P 0.474 / R 0.235 | ABSENT |
| ts | 2 | P 0.875 / R 0.666 | P 0.875 / R 0.666 | ABSENT |
| vue | 1 | P 0.75 / R 0.3 | P 0.75 / R 0.3 | ABSENT |

## Suite D — negative controls (clean-rate, no bar)

| Arm | clean rate | n |
|---|---|---|
| grep | 0.333 | 6 |
| native | 0.333 | 6 |
| foreign | ABSENT | 0 |

An item the oracle later finds non-empty is VOID and leaves the clean-rate; none is voided before the oracle has run.

## Null path

graph-first wording withheld (fewer than 4 of 6 classes won).

## Not in this run

- **Suite A** is the v2 runner, unchanged (`--suite-a`).
- **Suite F** is agentic and runs separately.

## Per question

| id | class | subject | lang | verb | grep n | native n | foreign | score |
|---|---|---|---|---|---|---|---|---|
| `ls-b-01` | precise-semantics | larasend | php | affected+query | 4 | 3 | ABSENT | SCORED |
| `ls-b-02` | precise-semantics | larasend | php | affected+query | 12 | 4 | ABSENT | SCORED |
| `ls-b-03` | precise-semantics | larasend | php | affected+query | 6 | 3 | ABSENT | SCORED |
| `ls-b-04` | precise-semantics | larasend | ts | affected+query | 4 | 4 | ABSENT | SCORED |
| `ls-b-05` | precise-semantics | larasend | ts | affected+query | 1 | 1 | ABSENT | SCORED |
| `ls-b-06` | precise-semantics | larasend | vue | affected+query | 4 | 4 | ABSENT | SCORED |
| `uo-b-01` | precise-semantics | unopim | php | affected+query | 196 | 5 | ABSENT | SCORED |
| `uo-b-02` | precise-semantics | unopim | php | affected+query | 7 | 7 | ABSENT | SCORED |
| `uo-b-03` | precise-semantics | unopim | php | affected+query | 24 | 10 | ABSENT | SCORED |
| `uo-b-04` | precise-semantics | unopim | php | affected+query | 24 | 10 | ABSENT | SCORED |
| `uo-b-05` | precise-semantics | unopim | js | affected+query | 3 | 3 | ABSENT | SCORED |
| `uo-b-06` | precise-semantics | unopim | php | affected+query | 3 | 1 | ABSENT | SCORED |
| `ls-c-route-01` | route-trace | larasend | php | path | 136 | 2 | ABSENT | SCORED |
| `ls-c-route-02` | route-trace | larasend | php | path | 123 | 3 | ABSENT | SCORED |
| `ls-c-route-03` | route-trace | larasend | php | path | 94 | 2 | ABSENT | SCORED |
| `uo-c-route-01` | route-trace | unopim | php | path | 1396 | 7 | ABSENT | SCORED |
| `uo-c-route-02` | route-trace | unopim | php | path | 657 | 4 | ABSENT | SCORED |
| `uo-c-route-03` | route-trace | unopim | php | path | 10 | 2 | ABSENT | SCORED |
| `ls-c-model-01` | model-table | larasend | php | query | 7 | 1 | ABSENT | SCORED |
| `ls-c-model-02` | model-table | larasend | php | query | 16 | 1 | ABSENT | SCORED |
| `ls-c-model-03` | model-table | larasend | php | query | 14 | 1 | ABSENT | SCORED |
| `uo-c-model-01` | model-table | unopim | php | query | 21 | 2 | ABSENT | SCORED |
| `uo-c-model-02` | model-table | unopim | php | query | 32 | 1 | ABSENT | SCORED |
| `uo-c-model-03` | model-table | unopim | php | query | 7 | 1 | ABSENT | SCORED |
| `ls-c-tests-01` | tests-for | larasend | php | tests-for | 6 | 0 | ABSENT | SCORED |
| `ls-c-tests-02` | tests-for | larasend | php | tests-for | 3 | 0 | ABSENT | SCORED |
| `uo-c-tests-01` | tests-for | unopim | php | tests-for | 14 | 2 | ABSENT | SCORED |
| `uo-c-tests-02` | tests-for | unopim | php | tests-for | 4 | 0 | ABSENT | SCORED |
| `uo-c-tests-03` | tests-for | unopim | php | tests-for | 7 | 0 | ABSENT | SCORED |
| `ls-d-01` | negative-control | larasend | php | path | 5 | 2 | ABSENT | NOT-CLEAN |
| `ls-d-02` | negative-control | larasend | ts | path | 5 | 10 | ABSENT | NOT-CLEAN |
| `ls-d-03` | negative-control | larasend | php | affected+query | 0 | 0 | ABSENT | CLEAN |
| `uo-d-01` | negative-control | unopim | php | path | 4 | 3 | ABSENT | NOT-CLEAN |
| `uo-d-02` | negative-control | unopim | php | path | 4 | 5 | ABSENT | NOT-CLEAN |
| `uo-d-03` | negative-control | unopim | php | affected+query | 0 | 0 | ABSENT | CLEAN |
| `ls-e-01` | change-impact | larasend | php | impact | 3 | 6 | ABSENT | SCORED |
| `ls-e-02` | change-impact | larasend | php | impact | 6 | 17 | ABSENT | SCORED |
| `ls-e-03` | change-impact | larasend | php | impact | 2 | 2 | ABSENT | SCORED |
| `uo-e-01` | change-impact | unopim | php | impact | 7 | 38 | ABSENT | SCORED |
| `uo-e-02` | change-impact | unopim | php | impact | 7 | 111 | ABSENT | SCORED |
| `uo-e-03` | change-impact | unopim | php | impact | 3 | 14 | ABSENT | SCORED |
| `ls-e-x-01` | change-impact-xplane | larasend | php | impact | 2 | 2 | ABSENT | SCORED |
| `ls-e-x-02` | change-impact-xplane | larasend | php | impact | 2 | 2 | ABSENT | SCORED |
| `uo-e-x-01` | change-impact-xplane | unopim | js | impact | 3 | 7 | ABSENT | SCORED |
| `uo-e-x-02` | change-impact-xplane | unopim | js | impact | 3 | 6 | ABSENT | SCORED |

