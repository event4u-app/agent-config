# Originality audit — entity-neutralized shingle overlap

> Anti-reskin gate over 501 authored artifacts (skills · personas · commands), 
class-scoped, scaffold-subtracted, k=8. Thresholds: FAIL 60 / WARN 40. 
This report blocks NOTHING on its own — `lint_originality --changed` is the CI gate.


- Artifacts scanned: **501**

- Pairwise comparisons: **57730**

- Overlap distribution: worst **40%** · p95 **0%** · median **0%**

- Pairs ≥ WARN (40%): **1** (0 ≥ FAIL)


## Pairs at or above the warn threshold

| Class | A | B | overlap |
|---|---|---|--:|
| command | `tests` | `override` | 40% |
