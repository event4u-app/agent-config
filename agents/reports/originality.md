# Originality audit — entity-neutralized shingle overlap

> Anti-reskin gate over 496 authored artifacts (skills · personas · commands · subagents), 
class-scoped, scaffold-subtracted, k=8. Thresholds: FAIL 60 / WARN 40 / RAW_FAIL 85. 
The full audit is armed (FAIL + the raw batch guard); `--changed` adds the corpus-excluded batch guard for the PR path.


- Artifacts scanned: **496**

- Pairwise comparisons: **56151**

- Overlap distribution (DF): worst **40%** · p95 **0%** · median **0%**

- Surfaced pairs: **1** (0 ≥ FAIL/RAW_FAIL)


## Surfaced pairs (DF ≥ WARN, or raw ≥ RAW_FAIL)

| Class | A | B | overlap | raw |
|---|---|---|--:|--:|
| command | `tests` | `override` | 40% | 54.1% |
