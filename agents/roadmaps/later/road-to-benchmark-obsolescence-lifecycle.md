---
complexity: lightweight
status: later
---

# Road to benchmark-obsolescence lifecycle — detect when the model outgrew the rule

> A benchmark-backed claim has two ways to go stale, and this package only
> handles one. It catches regressions when a claim is re-run. It does **not**
> model the other case: the base host passes the evals **without** the artefact,
> because the technique migrated into default model behaviour. Then the rule is
> not broken — it is **no longer necessary**, and shipping it is dead weight
> carrying a live claim.
>
> This state has already been **measured** here (the strong-host null: vanilla =
> package = placebo) but never modelled as a lifecycle with a re-run cadence.
>
> Source + council cut:
> [`elder-ponytail-harvest-cut`](../../settings/contexts/elder-ponytail-harvest-cut.md).

## Why this is parked, not open

Both council members agreed this is a genuine **package-wide honesty primitive**
and deserves its own lifecycle rather than riding on a borrow roadmap. Both also
agreed it must not be built yet: with one benchmark-backed rule in the tree,
lifecycle machinery is being designed at N=1, which is the premature-abstraction
failure this package's own guidance forbids.

**Un-parks when:** a second benchmark-backed claim ships (the first candidate is
the solution-minimalism ladder if its Phase 3 reports). At that point two
independent claims exist to calibrate a staleness window against, and the Phase 3
harness is already the re-run instrument, so the remaining work is trigger wiring
plus a lifecycle field.

## Prerequisites before promotion

- [ ] At least **two** benchmark-backed claims exist whose evidence is a pinned
      report — enough to calibrate a re-run cadence against real variance rather
      than one data point.
- [ ] The re-run instrument is a committed harness someone other than its author
      can run (the reproduce path from
      [`road-to-solution-minimalism`](../archive/road-to-solution-minimalism.md)
      Phase 3 is the candidate).
- [ ] A decision on the staleness window with a stated basis — host model
      generations shipping per year, not a round number picked for looking
      reasonable.

## Sketch (design only — do not implement from this)

- **Lifecycle states**, reusing the existing four-value lifecycle vocabulary
  rather than inventing a fifth vocabulary:
  `active` → `redundant-on-strong-hosts` (the measured strong-host null,
  retroactively labelled) → `outgrown` (the base host passes without the
  artefact) → `retired`.
- **Re-run triggers, pre-registered:** a new host model generation on any pinned
  benchmark host, **or** a claim older than the staleness window. Same
  offline-gate shape as the existing staleness check that fails the build on
  unverified-beyond-window evidence. A claim whose trigger has fired renders with
  a staleness banner until it is re-verified or downgraded.
- **Honest downgrade path:** an `outgrown` verdict does **not** delete the
  artefact. It moves out of the default packs with the null published — the same
  move an earlier cancellation already modelled. An `outgrown` result is a
  publishable finding, not a failure.
- **Named absorption candidate:** minimalism / YAGNI discipline. The discourse
  around it (a ~90k★ source, three independent benchmarks, a vendor blog series)
  is plausible future training data, so it is the likeliest claim here to be
  absorbed by a base model. The package that detects its own obsolescence is the
  one whose remaining claims stay credible.

## Explicit non-goals

- No new governance layer, no runtime daemon, no writable runtime state.
- Not a replacement for the existing claims ledger or the pinned-report
  rendering — this adds an *ageing* dimension to them, nothing else.
