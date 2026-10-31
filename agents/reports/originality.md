# Originality audit — entity-neutralized shingle overlap

> Anti-reskin gate over 544 authored artifacts (skills · personas · commands), 
class-scoped, scaffold-subtracted, k=8. Thresholds: FAIL 60 / WARN 40. 
This report blocks NOTHING on its own — `lint_originality --changed` is the CI gate.


- Artifacts scanned: **544**

- Pairwise comparisons: **68163**

- Overlap distribution: worst **40.6%** · p95 **0%** · median **0%**

- Pairs ≥ WARN (40%): **3** (0 ≥ FAIL)


## Pairs at or above the warn threshold

| Class | A | B | overlap |
|---|---|---|--:|
| skill | `flux` | `livewire` | 40.6% |
| skill | `blade-ui` | `livewire` | 40.2% |
| command | `tests` | `override` | 40% |
