# Cost-Aware Model Routing — Verdict (2026-07-08)

Durable disposition of `road-to-cost-aware-model-routing` (the roadmap itself
gets archived; this note is the citable conclusion).

## What shipped

- **Telemetry (Phase 0):** routing fields `task_class` / `tier_chosen` /
  `tier_source` / `escalated_from` / `verify_result_by_tier` on the
  orchestration audit object; mirrored in `subagent_routing.ts`
  (`TierSource`, `RoutingDecision.tier_source`) and
  `subagent_steering.ts` (`parseOrchEntries`, `readTierRoutingMetrics`).
- **M1 static floor (Phase 1):** normative subagent category → tier table in
  `model-recommendations.md` + `subagent-configuration.md` (read-only fan-out
  → `lite`; mechanical → `lite|medium`; implementation → `medium`;
  review/synthesis → `medium|high`). Judge asymmetry invariant: downshifting
  an implementer never downshifts its judge; a judge is never `lite`.
- **M4 tripwires (Phase 2):** per-class escalation rate > 40% → promote the
  class's static tier (`escalationPromotionCandidates`); per-tier verify-pass
  drift → surface (`verifyPassDrift`). Per-tier quality view in
  `/cost:report`. Surfaced, never auto-flipped.
- **M2 tier inference (Phase 3):** deterministic per-slice inference keyed on
  the v1 classifier's task-TYPE outputs (`inferSliceTier` in
  `auto_dispatch.ts`; spec in `auto-dispatch-classification.md § v1.5`).
  Unknown → `inherit`, never guess down; size signals are negative guards only.
- **M3 verify-fail escalation (Phase 4):** one tier up per verify-fail within
  the existing N=3 budget (`escalateOnVerifyFail`); confined to
  `tier_source: static|inferred`; trigger is the judge/deterministic verify
  result, never subagent self-confidence.

## Evidence

`downshift-cost-reduction` claim (docs/CLAIMS.md) is **backed,
FAMILY-SCOPED**: read-only fan-out family, n=10 paired live dispatches
(haiku vs sonnet, 20 telemetry lines), 10/10 exact-match on both arms,
29.4% fewer raw tokens, 76.5% USD-weighted cost reduction; negative control
held (open-ended slices never resolve below session tier). Full run:
`internal/bench/routing-downshift/results-2026-07-08.md`.

## What stays gated (do not flip without a new run)

- **Mechanical-edit family downshift** — unmeasured; needs its own paired run
  before any `lite` default for mutating slices.
- **Tier downgrades of existing shipped units** — `production-validator`
  `inherit`→`medium`; the bulk re-tier of `model_tier: inherit` skills.
- **The `subagents.auto: ask→on` flip** — owned by the orchestration-scope
  gate, not this verdict.

## Council provenance

anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-08, 2 rounds ($0.14):
M1+M4 foundation-first; M2 keyed on task-TYPE outputs only (raw size metrics
rejected); M3 = +1 tier within N=3; rejected: trained preference-data routers,
external proxy routers, LLM classifier in v1, self-confidence signals.
