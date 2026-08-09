# Blind register — plan 2 (orchestrator-first execution; outcome withheld at writing time)

## 1. Three most probable causes of death, ranked

**#1 — `gateVerdict()` is structurally unrunnable on a single-arm retrospective corpus.** The gate takes exactly two inputs, `net_win` and `quality_held`. The plan itself concedes the counterfactual (in-session cost) "is not on disk", and a backfill of the orchestrated arm can never produce paired outputs for `quality_held`. So Phase 2 was decidable in only one direction: every family lands INDETERMINATE, and criterion (3) pre-registers INDETERMINATE as not-a-pass. Worse, any "defensible" baseline estimate is method-sensitive — an overhead-bound method and a context-displacement method plausibly flip fail↔pass for the same family, making any per-family "proven" verdict an artifact of analyst choice. The roadmap dies at its own stopping rule: an honest null that was guaranteed by construction, not discovered.

**#2 — Async dispatches carry no cost, collapsing per-family power.** The extractor sources `totalTokens` from the parent transcript, but asynchronously launched dispatches write only a launch acknowledgement; completion cost never returns to the parent. If most of the 369 dispatches are async, the measured population shrinks by an order of magnitude, and the per-family split (the unit the stopping rule binds) leaves families at n≈1 or n=0 — UNDERPOWERED and unprovable. The "clears the ≥20 gate by a wide margin" exit criterion is true in aggregate and false per family, which is the only granularity that matters.

**#3 — The host-capability fix is self-declared, gitignored, and unverifiable.** Phase 0's override lives in project-local, uncommitted settings and *is* its own evidence — "the manifest has no registry to appeal to". A fresh clone, worktree, or settings reset silently returns the normalizer to all-false, `auto_dispatch` resumes `inSession('host has no subagent_spawn primitive')`, and nobody notices because inert delegation looks identical to no delegable work. The initiative's precondition regresses without any tripped gate, and Phases 3–4 would sit on a foundation that evaporated.

## 2. One untested hidden dependency

The plan assumes **a single canonical baseline-estimation method exists** for converting measured orchestrated cost into a `token_delta` verdict. Phase 0 pre-registers thresholds (PROVE ≥15% / DROP median>0) but never pre-registers *which baseline method the thresholds are evaluated against* — and never tests whether two defensible methods agree even in sign on the one existing datapoint.

## 3. One modification that makes failure survivable

Add a **Phase 1.5 prospective micro-probe**: ~10 real tasks run two-arm (dispatched vs in-session, same task text), producing a genuinely `measured` counterfactual and paired outputs for `quality_held`. Then an INDETERMINATE backfill degrades into "run the cheap probe" instead of a terminal null — the retrospective corpus becomes prior, not verdict. ADR-133 permits it: it is measurement, not a subsystem.

## 4. Tripwire metric with a horizon

**Metric:** compute both candidate baseline methods (overhead-bound and context-displacement) on the single 2026-07-28 datapoint and any first 5 backfilled lines; count sign disagreements on `net_win`.
**Threshold/horizon:** any sign flip between methods, detected **before Phase 1 completes** (i.e. before the CLAIMS entry is fed numbers). One flip means cause #1 is live — halt and pre-register the method (or the micro-probe) before reading further data.
