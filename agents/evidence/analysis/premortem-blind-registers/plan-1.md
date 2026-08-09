# Blind register — plan 1 (adversarial-council Mode 9 benchmark; outcome withheld at writing time)

## 1. Three most probable causes of death, ranked

**#1 — The residual pool collapses to a sample size that cannot clear the dual threshold.** The claim is measured on defects that *survive* Stage 1's strong single judge. But the corpus is curated by the same maintainer who knows the bar, and "judge-survivable subtlety" is only confirmed empirically at Stage 1 run time. If the judge catches most planted items, the residual subset shrinks to a handful — and with N≈5–10 residuals, the +8 percentage-point absolute lift and the "FP not worse within noise" clause are statistically undecidable. The run completes, `evaluateCouncilBench` emits a verdict dominated by noise, and the honest thing to record is neither `backed` nor a clean null but "underpowered" — a state the pre-registered claim has no vocabulary for. The initiative dies as a permanently `unbacked` claim nobody trusts in either direction.

**#2 — Corpus curation stalls indefinitely because the validity gate is adversarial to its own author.** Phase 1 requires defects that fool a strong cross-model judge *and* an independent read confirming this isn't "the parity corpus in disguise". Curating genuinely judge-survivable defects means iterating against the judge — but each probe against the judge is itself a (possibly paid) run, and the plan gates all spend behind the maintainer. The cheapest compliant path is to not iterate, hand-author subtle defects blind, and fail the validity gate — repeatedly. With "corpus effort is the real cost" already named and no effort budget or deadline attached, the roadmap parks in `later/` and the claim rots at `unbacked`, which is functionally the honest-null outcome without the honesty of recording it.

**#3 — The maintainer spend gate never fires.** Phase 2 waits for explicit this-turn approval of a paid cross-vendor run whose payoff, on success, is enabling a surface that "remains advisory / default-off regardless of outcome". The plan's own acceptance criteria guarantee the Mode 9 surface ships identically whether the run happens or not — so the marginal value of spending is a resolved claim entry, not a behavior change. A rational maintainer defers forever; the deferred item from the predecessor roadmap becomes the deferred item of this one.

## 2. One untested hidden dependency

The plan assumes **Stage 1's "strong single cross-model judge" is a stable, defined baseline**. It never pins which model, which prompt, or which effort level constitutes "the" judge — yet the entire residual pool, both lift thresholds, and the FP comparison are defined relative to it. A judge swap (provider deprecation, model version bump between corpus validation and registered run) silently redefines the residual set and makes the pre-registered numbers unreproducible.

## 3. One modification that makes failure survivable

Add a **pre-registered minimum-power gate before Phase 2 spend**: the corpus ships with a required residual-pool floor (e.g. ≥25 items surviving Stage 1, verified in a cheap Stage-1-only dry run). If the floor is missed, the outcome is a defined third verdict — `corpus-insufficient`, claim stays `unbacked`, Phase 1 reopens with the judge's catch-list as curation feedback. This converts cause #1 from a wasted paid run producing an unusable verdict into a cheap, recoverable loop.

## 4. Tripwire metric with a horizon

**Metric:** Stage-1 survival rate of curated corpus items (fraction surviving the single judge), measured on an unpaid/dry Stage-1 pass. **Threshold + horizon:** if, within 30 days of Phase 1 start, fewer than 30% of curated items survive the judge — or fewer than 25 absolute survivors exist — cause #1 is materializing: the corpus cannot power the dual threshold, and curation must pivot before any Phase 2 spend request.
