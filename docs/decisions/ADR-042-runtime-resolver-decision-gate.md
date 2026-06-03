---
adr: 042
status: accepted
date: 2026-06-03
decision: runtime-resolver-decision-gate
supersedes: —
superseded_by: —
phase: v6.0.0 · governance, evals, evidence-based pruning
type: decision
---

# ADR-042 — Runtime pack resolver: STOP (projection-time filtering is sufficient)

## Status

**Accepted** · 2026-06-03. Records the Phase 5 decision gate of
[`road-to-6.0.0-c-governance-and-evals`](../../agents/roadmaps/road-to-6.0.0-c-governance-and-evals.md)
(Step 9). Builds directly on
[`ADR-040`](ADR-040-execution-model-projection-time-filtering.md)
(projection-time filtering, not a runtime resolver).

## Context

6.0.0-B shipped **projection-time** (build/install-time) pack-scoped filtering.
The final phase of 6.0.0-C is a STOP/GO gate: do we ALSO build a **runtime
resolver** that re-resolves the active pack set mid-session, live, as the user
switches context?

The gate criterion (from the roadmap): *"Only if the answer is 'switching
demanded' does a runtime resolver earn its place. If not, STOP — projection-time
filtering was sufficient and a runtime resolver is over-engineering."*

The evidence at decision time:

- **ADR-040 already chose projection-time** as the mechanism and did not
  foreclose runtime resolution forever — it scoped 6.0.0 to projection-time.
  Overturning that precedent requires extraordinary, proven demand.
- **No telemetry exists.** The measurement events (`rule.tier2_loaded`,
  `persona.cited`, `skill.activated`) were only just added in this roadmap's
  Phase 3; the evidence-based-pruning contract requires ≥ 30 days before any
  usage claim is trustworthy. There is zero accumulated data showing
  mid-session switching demand.
- **A lightweight mid-session affordance already exists.** `/profile:activate`
  writes an ephemeral `runtime.active_packs` overlay that *biases* the surfaced
  set (recommendation-bias MVP, no persistence, no execution-gating). Users can
  already bias mid-session without a resolver.

## Decision

**STOP. Do not build a runtime pack resolver now.** Projection-time filtering
(ADR-040) plus the `/profile:activate` recommendation-bias overlay is sufficient
for the surfacing problem 6.0.0 set out to solve. A runtime resolver would cross
a new config→execution trust boundary, introduce state-sync complexity (what
happens when projection-time config changes while runtime state is active?), and
add a context-window tax (every pack switch = a new system prompt) — all with
**no evidence** the problem it solves exists.

> **Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 3-round
> design debate, 2026-06-03):** both members converged on **STOP**. The burden
> of proof rests on PROCEED and is not met without telemetry; `/profile:activate`
> already covers mid-session biasing; building the resolver now is "speculative
> engineering". Both flagged a sharper refinement: high `/profile:activate`
> usage alone would justify making the overlay *persistent*, NOT a full
> resolver — only an **execution-gating** need (skills *unavailable*, not just
> de-prioritised) that the overlay cannot serve would justify the resolver.

## Re-trigger condition (falsifiable)

This decision reopens only when **all** of the following hold, measured over a
**≥ 30-day** telemetry window:

1. **Switching frequency** — `/profile:activate` invoked ≥ 2×/session in ≥ 40%
   of sessions.
2. **Pack diversity** — users switch between ≥ 3 distinct pack combinations
   (not just toggling one pack on/off).
3. **Execution-gating need** — explicit user feedback requesting *execution-level*
   gating (skills made unavailable in a mode, not merely de-prioritised) that
   projection-time + `/profile:activate` cannot serve.

If only (1) and (2) hold without (3), the correct response is to make
`/profile:activate` **persistent across sessions** (a config-write), NOT to
build a resolver. The resolver earns its place only when the need is
execution-gating, not recommendation-bias.

## Consequences

- **Positive.** No new trust boundary, no state-sync complexity, no
  context-window tax. The 6.0.0 rebuild ships with the simplest mechanism that
  solves the stated problem. ADR-040's precedent is reaffirmed, not eroded.
- **Positive.** The re-trigger condition is concrete and data-bearing — a future
  decision is made on telemetry, not on a guess, consistent with the
  evidence-based-pruning posture of this whole roadmap.
- **Negative / accepted.** If a real execution-gating need emerges, it waits for
  the next ≥ 30-day telemetry window before it can be acted on. Accepted: the
  cost of waiting is low (the overlay covers biasing today), and the cost of
  building speculatively is high.

## Alternatives considered

- **PROCEED — build the runtime resolver now.** Rejected: no evidence of demand,
  overturns ADR-040 without cause, adds a new trust boundary and context-window
  cost. The council's hardest pushback throughout the 6.0.0 rebuild.
- **Build a smaller "persistent `/profile:activate`" instead.** Deferred, not
  rejected: it is the *correct* response IF re-trigger conditions (1)+(2) fire
  without (3). Not warranted now (no telemetry), but it is the cheaper next step
  if data later shows persistence demand.

## References

- [`ADR-040`](ADR-040-execution-model-projection-time-filtering.md) — the projection-time decision this gate reaffirms.
- [`evidence-based-pruning.md`](../contracts/evidence-based-pruning.md) — the ≥ 30-day telemetry posture the re-trigger condition follows.
- [`local-analytics.md`](../contracts/local-analytics.md) — the `/profile:activate` switching signal the re-trigger reads.
- [`command-clusters.md`](../contracts/command-clusters.md) § `profile` cluster — the `/profile:activate` overlay.
