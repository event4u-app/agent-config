---
stability: beta
keep-beta-until: 2026-08-12
---

# ADR — `forecast-construction-shape`: the O2 ↔ H10 interface

> **Status:** Decided · 2026-05-13
> **Builds on:** [`cross-wing-handoff.md`](cross-wing-handoff.md) § 5 W4 chain;
> [`wing4-handoff.md`](../guidelines/wing4-handoff.md) § Chain 4;
> [`gtm-handoff.md`](../guidelines/gtm-handoff.md) § Chain 2 (H10 side).

## Decision

`forecasting` (O2, Wing-4, finance-partner) and `forecast-accuracy`
(H10, Wing-3, RevOps) compose through a **typed interface**, not a
shared implementation. O2 owns the cognition of *how a forecast is
constructed*; H10 owns the cognition of *which deals belong in
commit*. The interface is the only contract that crosses the wing.

Interface payload (the `forecast-band.json` artifact):

| Field | Type | Meaning |
|---|---|---|
| `construction_shape` | enum `top-down` · `bottom-up` · `hybrid` | Which construction shape the forecast was built from. Top-down anchors against TAM × penetration × motion; bottom-up sums deal-level conviction; hybrid is the explicit two-call reconciliation. |
| `commit_value` | money | Sum of commit-categorised deals × in-window close-rate, or top-down commit-band lower bound. |
| `best_case_value` | money | Commit + best-case-tagged, or top-down best-case-band upper bound. |
| `pipeline_value` | money | Population from which commit / best-case are drawn. Not a forecast category, included for ratio reasoning. |
| `confidence_band` | `{plus_pct: float, minus_pct: float}` | Historical-deviation-derived band around commit. **MUST** be present; a forecast without a band has no honesty about its prior miss-rate. |
| `retro_signature` | `{horizon: enum, last_two_actual_vs_predicted: [pct, pct]}` | The accuracy retro this band was calibrated against. Horizon = `quarterly` · `monthly` · `annual`. |
| `segment_scope` | string list | Customer-segment slots the forecast covers (from spine). Empty list = blended; explicit list = per-segment. |
| `fiscal_period` | string | Reporting cadence slot from `fiscal-period` spine: `monthly` · `quarterly` · `annual` · `multi-year-plan`. |
| `construction_inputs` | object | Shape-specific inputs: top-down → `{tam, penetration_band, motion_band}`; bottom-up → `{commit_count, best_case_count, evidence_floor}`; hybrid → both. |

## Why this was a real question

Three options were on the table:

1. **Shared implementation in one wing.** Forecasting lives entirely
   in Wing-3 (RevOps) or Wing-4 (Finance). Rejected: forecasting is
   constructed from finance fundamentals and consumed from deal-level
   evidence — collapsing it into one wing forces the other to
   re-derive cognition.
2. **Free-form text handoff.** O2 emits prose; H10 reads prose.
   Rejected: prose drifts every quarter, the linter cannot catch
   contract breaks, and the retro loop loses the comparison shape.
3. **Typed interface, owned by O2.** Accepted: O2 owns the shape so
   that drift is a producer-side fix. H10 consumes against the
   contract and never re-derives forecasting cognition.

## Citation-evidence gating

This ADR is the gating artefact. O2 cites the ADR in its frontmatter
and procedure. H10 cites the ADR in its `Related Skills` carve-out
and validates its `commit-list.md` against the `forecast-band.json`
shape. `task lint-handoffs` (Phase 3.2) walks the cross-wing graph
and rejects a contract break.

## Parallel-development rule

O2 ships an **interface-first stub** (this ADR + a stub procedure
that emits the typed artifact from a single bottom-up case). The
stub counts as ≥ 100 % of `O2-interface`. H10 starts after the
interface lands, parallel to O2 implementation. O2 cannot break the
contract without an ADR revision and a co-ordinated H10 update.

## Counter-evidence the agent should listen for

Three signals that this ADR is wrong and needs revisiting:

1. **H10 re-derives forecasting cognition.** If `forecast-accuracy`
   starts shipping top-down vs bottom-up reasoning, the interface
   leaked and one of the two skills is mis-scoped. Re-cut the
   boundary.
2. **A third consumer reads `forecast-band.json`.** A new skill
   composing the interface means the contract is load-bearing for
   the broader spine and should graduate from beta to stable.
3. **The confidence-band is consistently absent.** Forecasts that
   ship without a band are using the interface as a shape but
   skipping the calibration; the field should become required-on-
   parse, not required-on-cognition.

## See also

- [`wing4-handoff.md`](../guidelines/wing4-handoff.md) § Chain 4 —
  finance → GTM prose around this contract.
- [`gtm-handoff.md`](../guidelines/gtm-handoff.md) § Chain 2 — H10
  side prose; identical contract, opposite consumer.
- [`cross-wing-handoff.md`](cross-wing-handoff.md) § 5 — wing-scoped
  contract policy this ADR follows.
