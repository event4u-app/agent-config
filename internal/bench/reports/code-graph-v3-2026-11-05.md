# Code-graph benchmark v3 — suites B–E, 2026-11-05

Registered in `internal/bench/code-graph/PREREGISTRATION-v3-2026-11-05.md`; every registered input matched its SHA-256 before the run. Corpus `e89a68cc998ea94a…`.

**Measured commit** `4d4abf36cfc49abfe8fad139629c09f7eeff4f96` · engine tree `0cf008bdf460e594fa09966e3331aba9051fada7`.

| Subject | Pin | native graph | foreign arm |
|---|---|---|---|
| unopim | `56071226255ff8e0f5dc40dafa72eab0f2751d54` | 12354 nodes · 62159 edges · 4225 ms | ABSENT |
| larasend | `da5c06c725f51f537fd8e238e436263665f475d2` | 2462 nodes · 9963 edges · 577 ms | ABSENT |

**Truth:** 39 of 45 questions are `pending-oracle` — scored as PENDING, never as a number. Every arm's raw answer is in `traces.jsonl` for scoring once the step-2.2 oracle lands.

**Answers per arm:** grep 45 (43 non-empty) · native 45 (39 non-empty) · foreign 0 — ABSENT, not zero.

## Per class (route-trace per subject, never pooled)

| Class | Subject | n | grep | native | foreign | native verdict | foreign verdict | verdict-bearing |
|---|---|---|---|---|---|---|---|---|
| precise-semantics | all | 12 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |
| route-trace | unopim | 3 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |
| route-trace | larasend | 3 | PENDING | PENDING | ABSENT | PENDING | ABSENT | no (larasend route-trace, published beside) |
| model-table | all | 6 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |
| tests-for | all | 5 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |
| change-impact | all | 6 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |
| change-impact-xplane | all | 4 | PENDING | PENDING | ABSENT | PENDING | ABSENT | yes |

## Suite D — negative controls (clean-rate, no bar)

| Arm | clean rate | n |
|---|---|---|
| grep | 0.333 | 6 |
| native | 0.333 | 6 |
| foreign | ABSENT | 0 |

An item the oracle later finds non-empty is VOID and leaves the clean-rate; none is voided before the oracle has run.

## Null path

PENDING — truth has not landed.

## Not in this run

- **Suite A** is the v2 runner, unchanged (`--suite-a`).
- **Suite F** is agentic and runs separately.

## Per question

| id | class | subject | lang | verb | grep n | native n | foreign | score |
|---|---|---|---|---|---|---|---|---|
| `ls-b-01` | precise-semantics | larasend | php | affected+query | 4 | 3 | ABSENT | PENDING |
| `ls-b-02` | precise-semantics | larasend | php | affected+query | 12 | 4 | ABSENT | PENDING |
| `ls-b-03` | precise-semantics | larasend | php | affected+query | 6 | 3 | ABSENT | PENDING |
| `ls-b-04` | precise-semantics | larasend | ts | affected+query | 4 | 4 | ABSENT | PENDING |
| `ls-b-05` | precise-semantics | larasend | ts | affected+query | 1 | 1 | ABSENT | PENDING |
| `ls-b-06` | precise-semantics | larasend | vue | affected+query | 4 | 4 | ABSENT | PENDING |
| `uo-b-01` | precise-semantics | unopim | php | affected+query | 196 | 5 | ABSENT | PENDING |
| `uo-b-02` | precise-semantics | unopim | php | affected+query | 7 | 7 | ABSENT | PENDING |
| `uo-b-03` | precise-semantics | unopim | php | affected+query | 24 | 10 | ABSENT | PENDING |
| `uo-b-04` | precise-semantics | unopim | php | affected+query | 24 | 10 | ABSENT | PENDING |
| `uo-b-05` | precise-semantics | unopim | js | affected+query | 3 | 3 | ABSENT | PENDING |
| `uo-b-06` | precise-semantics | unopim | php | affected+query | 3 | 1 | ABSENT | PENDING |
| `ls-c-route-01` | route-trace | larasend | php | path | 136 | 2 | ABSENT | PENDING |
| `ls-c-route-02` | route-trace | larasend | php | path | 123 | 3 | ABSENT | PENDING |
| `ls-c-route-03` | route-trace | larasend | php | path | 94 | 2 | ABSENT | PENDING |
| `uo-c-route-01` | route-trace | unopim | php | path | 1396 | 7 | ABSENT | PENDING |
| `uo-c-route-02` | route-trace | unopim | php | path | 657 | 4 | ABSENT | PENDING |
| `uo-c-route-03` | route-trace | unopim | php | path | 10 | 2 | ABSENT | PENDING |
| `ls-c-model-01` | model-table | larasend | php | query | 7 | 1 | ABSENT | PENDING |
| `ls-c-model-02` | model-table | larasend | php | query | 16 | 1 | ABSENT | PENDING |
| `ls-c-model-03` | model-table | larasend | php | query | 14 | 1 | ABSENT | PENDING |
| `uo-c-model-01` | model-table | unopim | php | query | 21 | 2 | ABSENT | PENDING |
| `uo-c-model-02` | model-table | unopim | php | query | 32 | 1 | ABSENT | PENDING |
| `uo-c-model-03` | model-table | unopim | php | query | 7 | 1 | ABSENT | PENDING |
| `ls-c-tests-01` | tests-for | larasend | php | tests-for | 6 | 0 | ABSENT | PENDING |
| `ls-c-tests-02` | tests-for | larasend | php | tests-for | 3 | 0 | ABSENT | PENDING |
| `uo-c-tests-01` | tests-for | unopim | php | tests-for | 14 | 2 | ABSENT | PENDING |
| `uo-c-tests-02` | tests-for | unopim | php | tests-for | 4 | 0 | ABSENT | PENDING |
| `uo-c-tests-03` | tests-for | unopim | php | tests-for | 7 | 0 | ABSENT | PENDING |
| `ls-d-01` | negative-control | larasend | php | path | 5 | 2 | ABSENT | NOT-CLEAN |
| `ls-d-02` | negative-control | larasend | ts | path | 5 | 10 | ABSENT | NOT-CLEAN |
| `ls-d-03` | negative-control | larasend | php | affected+query | 0 | 0 | ABSENT | CLEAN |
| `uo-d-01` | negative-control | unopim | php | path | 4 | 3 | ABSENT | NOT-CLEAN |
| `uo-d-02` | negative-control | unopim | php | path | 4 | 5 | ABSENT | NOT-CLEAN |
| `uo-d-03` | negative-control | unopim | php | affected+query | 0 | 0 | ABSENT | CLEAN |
| `ls-e-01` | change-impact | larasend | php | impact | 3 | 6 | ABSENT | PENDING |
| `ls-e-02` | change-impact | larasend | php | impact | 6 | 17 | ABSENT | PENDING |
| `ls-e-03` | change-impact | larasend | php | impact | 2 | 2 | ABSENT | PENDING |
| `uo-e-01` | change-impact | unopim | php | impact | 7 | 38 | ABSENT | PENDING |
| `uo-e-02` | change-impact | unopim | php | impact | 7 | 111 | ABSENT | PENDING |
| `uo-e-03` | change-impact | unopim | php | impact | 3 | 14 | ABSENT | PENDING |
| `ls-e-x-01` | change-impact-xplane | larasend | php | impact | 2 | 2 | ABSENT | PENDING |
| `ls-e-x-02` | change-impact-xplane | larasend | php | impact | 2 | 2 | ABSENT | PENDING |
| `uo-e-x-01` | change-impact-xplane | unopim | js | impact | 3 | 7 | ABSENT | PENDING |
| `uo-e-x-02` | change-impact-xplane | unopim | js | impact | 3 | 6 | ABSENT | PENDING |

