<!-- evidence-type: analysis -->

# F3b — a non-convergent product trade-off

The other half of F3. The council did not converge, and the question is
user-visible with no source of truth to pick between the two outcomes — so the
record still carries the proposal the owner confirms. Dropping the block here
would leave a decision nobody closed.

- **Question:** when a sync fails halfway, does the surface show the partial
  result or the last known-good one?
- **Ownership:** product-owned
- **Convergence:** 1/2 split

## Evidence

- Both behaviours are implementable at the same cost; the difference is what
  the user is told has happened.
- No existing screen in the product establishes a precedent either way.

## Member positions

- Member A — partial result, with a banner. A user who sees nothing cannot tell
  a failed sync from an empty account.
- Member B — last known-good. A partial view that looks complete is the worse
  failure, and the banner is read by nobody.

## Verdict

No convergence. Confidence: low — the split is on a product judgement, not on
an unresolved fact.

## Options

1. Show the partial result with a failure banner — the council's Member A
   position; the user can tell a failure from an empty state, at the cost of a
   view that is briefly inconsistent.
2. Show the last known-good state — Member B; never inconsistent, at the cost
   of a silent staleness the banner would otherwise have surfaced.
3. Neither — the owner names a third behaviour, and the council re-runs against
   it.

## Revisit if

A precedent screen lands in the product, or telemetry shows users acting on a
stale view.
