# Originality audit — entity-neutralized shingle overlap

> Anti-reskin gate over 552 authored artifacts (skills · personas · commands), 
class-scoped, scaffold-subtracted, k=8. Thresholds: FAIL 60 / WARN 40. 
This report blocks NOTHING on its own — `lint_originality --changed` is the CI gate.


- Artifacts scanned: **552**

- Pairwise comparisons: **70059**

- Overlap distribution: worst **42.9%** · p95 **0%** · median **0%**

- Pairs ≥ WARN (40%): **4** (0 ≥ FAIL)


## Pairs at or above the warn threshold

| Class | A | B | overlap |
|---|---|---|--:|
| command | `tests` | `override` | 42.9% |
| command | `fix` | `override` | 41.8% |
| skill | `flux` | `livewire` | 40.6% |
| skill | `blade-ui` | `livewire` | 40.2% |
