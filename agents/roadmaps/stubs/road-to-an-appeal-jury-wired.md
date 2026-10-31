---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: an appeal jury wired into the bracket

> **Stub — not active work.** Created 2026-10-31 by
> `road-to-a-loss-that-can-be-appealed` (decision E6).

`/judge bracket` accepts an appeal-jury result as an optional, recorded input
(`playCard(..., { jury })`), but nothing produces one: `juryPairwise` in
`src/scripts/ai_council/jury_aggregate.ts` is pinned shadow-only by AC-9 of its
roadmap, enforced by `tests/scripts/ai_council/jury_aggregate.test.ts`
("the aggregator is imported by tests only").

**Trigger.** The AC-9 condition lifts — the free-jury shadow ledger accumulates and
the free-jury claims in `docs/CLAIMS.md` (κ, n_eff/k) are no longer `unbacked`.

**Then.** Wire `juryPairwise` as the producer of `JuryInput` for appealable
matches (both orders, ≥ 2 families, ≤ 5 seats, free seats per `seats.ts`), keep the
card with the paid seat (ADR-257), and amend the AC-9 test in the same change.
