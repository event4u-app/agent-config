# First-run finding ("60 seconds") — build gate + pre-registered thresholds

> Durable gate record from the road-to-ai-employee-borrowings roadmap
> (council 2026-07-27, incl. the round-2 correction: the BUILD is not
> freeze-exempt; only its measurement phases were). Thresholds are FIXED
> HERE, BEFORE ANY BUILD DATA — a later change is a visible protocol
> amendment, never a silent retrofit. Roadmaps named by slug per
> `no-roadmap-references`.

## The deliverable (design, preserved for the gate to fire against)

Within ~60s of install, ONE concrete, checkable, UNAPPLIED finding from
the USER'S OWN repository. Detection is deterministic (existing
verifiers — the Spike-C frozen classes); the LLM is used ONLY for
ranking/explanation; `why` walks the provenance chain. Trust before
mutation.

## Gate condition — when the build MAY start

The build starts ONLY when one of:

1. the standing feature-freeze unblock list clears, OR
2. the launch-decision ADR (feedback-9.8.0 followups Phase 1) explicitly
   pulls the first-run finding as THE launch artifact.

Until then: no wrapper code, no CLI surface, no scaffolding "to be
ready" — the Spike-C fixture set + coverage/FPR baseline are the only
sanctioned precursors (they measure EXISTING verifiers).

## Pre-registered thresholds (fixed 2026-07-27, before any build data)

| Metric | Threshold | Note |
|---|---|---|
| Coverage | ≥60% of the Spike-C fixture set produce ≥1 finding within the cap | measured against the frozen set, not a re-picked one |
| First-finding false-positive rate | **≤5%** | precision over coverage is LOAD-BEARING: forced to trade, lower coverage |
| Latency | p90 ≤60s, p99 ≤90s cold | on the fixture set |
| Mutation | **ZERO** | a single fixture where the first run modifies a tracked file fails the phase outright |
| Timeout behavior | partial-output affordance | a timeout yields what was found, marked partial — never a blank failure |
| Reason codes | locked taxonomy | every finding carries a reason code from a frozen enum; no free-form classes |
| Idempotence | marker + run ledger | second run on the same repo does not re-announce the same finding |

## Honest-null consequence (binding)

Thresholds missed → the wrapper does NOT ship. The measured
coverage/precision numbers are published as the H2 product finding
("our rules encode house style, not wild violations" — adoption roadmap
hypothesis), with the same prominence as a ship decision. The ship/no-
ship decision is recorded against THESE numbers, in writing.

## Standing precondition (source honesty)

Any mechanism borrowed from Source P is implemented only after reading
its SOURCE ([DOC-ONLY] → VERIFIED-SRC). Doc-derived behavior claims are
hypotheses — the S1 lesson of the same week this gate was written.
