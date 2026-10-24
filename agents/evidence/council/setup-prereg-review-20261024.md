<!-- evidence-type: analysis -->

# FREEZE 2/2 in round 3 — review of the Phase 5 pre-registration

**Date:** 2026-10-24 · **Members:** `anthropic`, `openai` · **Present: 2 of 2** each round · CLI, $0.00 ·
**Prompts:** `setup-prereg-review-20261024.question.md`, `…-r2-…`, `…-r3-…` beside this file, each
carrying the full draft it reviewed.

- **Round 1 — revise / revise.** The 31-case obligation class fell under the n ≥ 299 power rule and
  could never pass (openai); the train slice was called a negative control yet admitted six
  regressions (both); "voids the result" was unscoped; the corpus was read at the run's commit; the
  latency guard's mechanics were open. All revised.
- **Round 2 — freeze / revise.** Rule 2's denominator was ambiguous and its count unrecorded
  (openai). Counting it: 239 non-critical positives, where zero regressions give a 1.25 % bound — D2's
  1 % margin cannot be powered, which is D2's own revisit condition.
- **Round 3 — freeze / freeze.** Rule 2 now requires zero non-critical regressions and reports the
  bound beside it, stating the 1 % margin was not established. Both seats: replacing the unpowered
  margin with zero tolerance is council-decidable — it is stricter than D2, and D2 delegated exactly
  this revisit to the council at 5.1; no computed-arm data had been seen. The openai seat asked that
  the result schema emit the frozen n, the zero-rule verdict, the bound and the "1 % not established"
  sentence mechanically.
