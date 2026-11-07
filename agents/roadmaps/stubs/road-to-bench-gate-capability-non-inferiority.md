---
complexity: lightweight
review_by: 2026-12-28
---

# Stub: the bench gate requires capability non-inferiority

> **Stub — not active work.** Carries decision D3 of
> `road-to-a-bench-that-fails-when-nothing-was-done`: that roadmap prints a
> capability non-inferiority gate beside the deciding `cap_sig || dis_sig`
> gate (`internal/bench/core/bench_ab_v2_stats.ts`), in shadow. Flipping which gate
> decides is the question that waits here.
>
> **Arrivals:** 1 — `inbox-2026-11-bn` (2026-11-04): an owner-commissioned
> review asks for verified resolution as the primary endpoint and discipline
> only conditional on it (source decision D1). Same mechanism as this stub;
> the margin is still the owner's to pre-register.

## What waits here

- Make the non-inferiority form decide: a PASS needs the package arm's
  capability rate not below the vanilla arm's by more than a margin, and
  discipline is read as `discipline_given_capability`.
- A published PASS that flips under the new gate gets a dated re-assessment
  in `docs/benchmark.md`; the pinned result itself stays.

## Why it is deferred

The margin is a pre-registered threshold. Choosing it after the shadow numbers
are visible would fit the bar to the data, so it is chosen by the owner before
the next paid A/B, not inside the repair.

## Trigger

The next paid `bench:ab:v2` run is planned (any host), or the shadow column
from the parent roadmap's step 1.4 disagrees with the deciding gate on a
pinned report.
