---
adr: 117
status: accepted
date: 2026-07-09
decision: subagents-auto-default-on
supersedes: 105
superseded_by: —
phase: auto-subagent-orchestration
type: structural
---

# ADR-117 — Flip `subagents.auto` shipped default to `on` (host-gated) on bounded-downside re-evaluation

## Status

**Accepted** · 2026-07-09. Amends ADR-105 Decision 2 ("conservative-until-proven
shipped default `ask`"). Resolved by a re-evaluation under `decision-revisit-gate`
plus a deep AI-council round (claude-sonnet-4-5 + gpt-4o, 2026-07-08, 4 rounds).

## Context

ADR-105 shipped `subagents.auto: ask` as the conservative default and gated the
flip to `on` behind a Phase-6 benchmark. That benchmark was found
**non-producible** in this package's harness (no runtime executes model
`Task`/`Agent` tool calls), so the 2026-06-26 verdict
(`orchestration-default-flip-verdict.md`) took the honest-null branch: keep
`ask`, re-gate on realized telemetry.

That re-gate was **self-locking**: realized telemetry only accrues when the
layer is `on`, but `on` was withheld pending telemetry. Meanwhile the package
evolved:

- **Cost-routing shipped.** `road-to-cost-aware-model-routing` (2026-07-08) landed
  `inferSliceTier` — delegable slices already run on the cheapest capable tier.
  The system is not cost-blind; only the default was conservative.
- **The harness now executes subagents.** Host harnesses (Claude Code) execute
  `Agent`/`Task` calls, so a directional probe is finally possible.

## Decision

The shipped default for `subagents.auto` is **`on`** on hosts whose capability
manifest reports `subagent_spawn: true`, and `off` on hosts without a subagent
primitive. `resolveShippedDefault()` is retained as the telemetry-driven
**demotion** gate.

This is a **bounded-downside** decision, explicitly **not** a passed rigorous
benchmark. The basis:

1. **Bounded downside.** `on` auto-dispatches only structurally-signalled,
   cost-routed, verified slices (per `auto-dispatch-classification`). It cannot
   delegate unstructured, tiny, or frontier-priced work.
2. **Directional probe (N=2, real, honest limits).** Two live read-only-fan-out
   delegations this session (~70k, ~86k Sonnet tokens on real work) → ~80%
   per-task saving vs the inline-Opus counterfactual, outputs verified usable.
   Small N, single task-type, arithmetic counterfactual — directional only.
3. **Reversible + monitored.** A measured telemetry regression demotes back to
   `ask` via `gateVerdict`/`resolveShippedDefault`.

## Consequences

- On subagent-capable hosts, delegable tasks auto-dispatch without a per-task
  ask; the choice is surfaced in one line.
- Realized orchestration telemetry now accrues, breaking the deadlock and
  feeding the demotion gate.
- Hosts without `subagent_spawn` are unaffected (`off`, no-op).
- The delegability floor (`SIZE_FLOOR = 1` in `auto_dispatch.ts`) is unchanged
  and noted as a follow-up refinement — the structural-signal gate already keeps
  unstructured/tiny work in-session, so it is not load-bearing for this flip.

## Alternatives

- **Keep `ask`, wait for a rigorous benchmark** — rejected: the benchmark is
  non-producible here and the telemetry re-gate is deadlocked; this is
  indefinite inertia, not caution.
- **Flip `on` universally with no cost-routing / floor argument** — rejected:
  that is the money-losing "flip on unmeasured claim" the deep council warned
  against; the bounded-downside basis is what makes this flip responsible.
- **Per-profile default (`on` only for developer)** — rejected for now: no
  per-profile-default plumbing exists (would be new code); host-gating already
  scopes the risk.

## References

- ADR-105 — automatic subagent orchestration (Decision 2 amended here).
- ADR-109 — subagent-v1 contract; ADR-110 — discipline profile.
- `agents/settings/contexts/orchestration-default-flip-verdict.md` § 2026-07-09.
- `src/agent-src/contexts/execution/orchestration-benchmark-gate.md` — demotion gate.
- `src/agent-src/contexts/execution/auto-dispatch-classification.md` — delegability + cost-routing.
