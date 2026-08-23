# Originality audit — entity-neutralized shingle overlap

> Anti-reskin gate over 525 authored artifacts (skills · personas · commands), 
class-scoped, scaffold-subtracted, k=8. Thresholds: FAIL 60 / WARN 40. 
This report blocks NOTHING on its own — `lint_originality --changed` is the CI gate.


- Artifacts scanned: **525**

- Pairwise comparisons: **63606**

- Overlap distribution: worst **40%** · p95 **0%** · median **0%**

- Pairs ≥ WARN (40%): **1** (0 ≥ FAIL)


## Pairs at or above the warn threshold

| Class | A | B | overlap |
|---|---|---|--:|
| command | `tests` | `override` | 40% |
