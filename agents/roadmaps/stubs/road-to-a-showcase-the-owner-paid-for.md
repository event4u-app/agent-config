---
complexity: lightweight
review_by: 2026-12-28
---

# Stub: the first paid showcase run

> **Stub — not active work.** Carries decision D5 of
> `road-to-a-baseline-that-has-to-catch-up`: the zero-cost foundation
> (bundles, artifact tasks, graders, ladders, entry points) lands there; the
> run that buys real numbers waits here.
>
> **Arrivals:** 3 — latest `inbox-2026-11-wo` (2026-11-10): all three sources ask again for AC against no rules and a minimal prompt on real projects (graded P0 twice), "the next score jump must come from independent evidence". Third arrival: put to the owner in that round's reply as a spend question. Before that, latest `inbox-2026-11-d` (2026-11-01): the 19.2.0 review
> set finds the five showcase claims still `unbacked` (`docs/CLAIMS.md`), backed
> flat at 63 across 19.0.0 → 19.2.0 while unbacked grows (46 → 51 → 55,
> re-counted), and asks for "one measured claim per release". Re-verified: the
> paid tiers refuse without `--max-usd` (`_lib/showcase_plan.ts`), so the run is
> blocked on the owner's budget, not untriggered; `internal/bench/ui/run.ts` is
> the port-fidelity scorer, not the showcase runner. Earlier: the 19.1.0 set
> (same round) named it "the most important open debt".

## What waits here

- Owner sets a USD ceiling per tier (`:quick`, full) and the hosts: a
  mid-tier Claude host is mandatory (the tree measured its null there), plus
  the cheapest host; k ≥ 5 per arm per task for any published verdict.
- One `:quick` run per task on the cheapest host proves the graders receive
  the deliverable; then the full tier.
- Results land as bundles, render into `docs/examples/bench/`, and the vanilla
  arm's login outputs become the held-out corpus `account-surface-finds-planted`
  waits for.
- The judge family for a pairwise vision judge differs from the arm family.

## Why it is deferred

Spend is owner-reserved; nothing in the foundation needs a paid call.

## Trigger

The owner names a budget per tier, or a release asks for `bench:showcase:quick`.
