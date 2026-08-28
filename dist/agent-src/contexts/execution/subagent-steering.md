# Subagent Steering & Guardrails (Phase 5)

First-class lifecycle for auto-dispatched subagents, plus the guardrails that
keep "auto-dispatch by default" from becoming a token sink.

## Lifecycle

```
dispatch → monitor → status → escalate / kill
```

- **dispatch** — spawn per the [`spawn contract`](subagent-spawn-contract.md),
  routed per [`subagent-routing`](subagent-routing.md).
- **monitor** — where the host manifest reports `status_polling: true`, check
  progress; otherwise fire-and-collect.
- **status** — every return uses the fixed 4-status envelope from
  [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md):
  `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` · `BLOCKED`.
- **escalate / kill** — the orchestrator may kill a runaway subagent and
  escalate to the user. **The orchestrator never merges autonomously** —
  integration is the orchestrator's call after verification, never the
  subagent's.

## Budget + parallel cap

- The N=3 autonomous budget (`autonomous-execution`) binds **per validation
  target**: three consecutive failed attempts on the same target halts the run
  and surfaces the three attempts. `budgetHalt()` is the deterministic counter.
- `subagents.max_parallel` caps concurrent dispatch. No speculative fan-out:
  a subagent is spawned only for a classified-delegable target, never on spec.

## Transient-failure retry — tier downshift

On a transient subagent failure (HTTP 429, 5xx, or timeout), retry **once** at
the next-lower model tier (haiku → if already haiku, escalate to the `spawn_failure`
counter) before counting a failed attempt. Maximum one downshift per subagent
call. If the downshifted retry also fails, increment the `spawn_failure_rate`
counter normally. Never downshift twice on the same slot — deterministic cap
prevents silent drift to the cheapest model on every failure.

This is the only automatic response to a transient failure; structural or
semantic errors (e.g. `BLOCKED` status envelope) do not trigger a tier
downshift — they escalate to the orchestrator immediately.

## Verify-fail escalation — the downshift cascade (M3)

Cheap-first cascade for DOWNSHIFTED slices only
(road-to-cost-aware-model-routing, council 2026-07-08). Transient failures
(above) and verify-fails are distinct: a transient retries downward once; a
**verification failure escalates upward**.

```
VERIFY-FAIL ON A DOWNSHIFTED RETURN → RE-DISPATCH ONE TIER UP.
COUNTS AGAINST THE EXISTING N=3 BUDGET — NEVER A NEW BUDGET.
ATTEMPT 1 lite → ATTEMPT 2 medium → ATTEMPT 3 = SLICE FAILED,
ORCHESTRATOR REPLANS AT SESSION TIER.
ESCALATION TRIGGER IS THE JUDGE VERDICT / DETERMINISTIC VERIFY RESULT —
NEVER THE SUBAGENT'S OWN CONFIDENCE.
```

- **Scope:** slices with `tier_source: static | inferred` only. `inherit`
  slices keep the existing same-tier retry semantics — no behavior change
  outside the downshift path.
- **Budget accounting:** each escalated attempt consumes one of the slice's
  three attempts (`budgetHalt()` unchanged). Two failed attempts mark the
  slice failed; the orchestrator replans — a slice's verify-fail never
  poisons the orchestrator trajectory, only the final verified return (or
  the failure mark) enters its context.
- **Telemetry:** the re-dispatch records `escalated_from: <failed tier>` and
  appends to `verify_result_by_tier`.
- **Economics guard:** a class that escalates > 40% of the time is cheaper
  started on the higher tier — the escalation-rate tripwire (below) promotes
  its static default; the cascade is for the tail, not the norm.

Deterministic reference: `escalateOnVerifyFail()`.

## Failure-type stop — the N=3 budget applied per subagent type

Two consecutive **verification-failed** returns from the same subagent type in
one session exhaust that type's dispatch budget: the two failures plus the
escalation step ARE the three attempts of the existing N=3 budget — this is an
application of that budget at type granularity, **not a new mechanism and not
a circuit breaker**. When it fires the orchestrator:

1. stops dispatching that subagent type for the rest of the session,
2. surfaces both failed returns to the human,
3. runs the remaining slices in-session.

The Iron Law below stands unchanged — there is still no automatic
cohort-disable, and the stop is session-scoped state the orchestrator holds,
never a persisted flip. Deterministic reference: `typeStop()`.

## Ordered-slice dependency gate (do-in-steps)

An ordered slice **declares its parent**; no slice dispatches before its
parent's return has been verified by the orchestrator. This makes the
implicit `do-in-steps` contract ("step N output → judge → step N+1 input")
explicit and checkable: `sliceDispatchAllowed(declaredParent,
verifiedReturns)` refuses the dispatch while the parent lacks a verified
return in session state. Root / independent slices (no declared parent)
always pass. A refused slice is not an error — it is the ordering contract
doing its job; the orchestrator verifies (or revises) the parent first.

## Rollback guardrails — surfaced, not auto-disabled

```
A RESIDENT PROCESS HERE IS GOVERNED, NEVER AUTOMATIC. NO COHORT-DISABLE.
BREACHES ARE SURFACED FROM THE AUDIT LOG FOR THE MAINTAINER / USER TO ACT ON.
THE ONLY AUTOMATIC STOP IS THE PER-TARGET N=3 BUDGET.
```

> **Amended 2026-08-27 (ADR-249).** The first line used to read *"A CONFIG
> PACKAGE RUNS NO DAEMON"*, and that premise no longer holds: a **supervised**
> resident process is permitted in core under four governance conditions
> (`docs/contracts/resident-process-governance.md`, class P1). The block's force
> is unchanged, because the daemon clause was never what it governed — the rule
> here is that a breach never stops a cohort by itself, and that is if anything
> more load-bearing now than when nothing could be running. The replacement
> states the adopted constraint rather than an absence, which is the wording rule
> the same reversal imposes on every surface: name what the repository holds
> itself to, never a state of the world.


The guardrail thresholds (`breachedGuardrails()`), read off the
[`orchestration-telemetry`](orchestration-telemetry.md) audit signals:

| Signal | Threshold | Meaning when breached |
|---|---|---|
| `token_blowup` | spend > 2× single-agent baseline | the layer is costing more than it saves |
| `spawn_failure` | > 10% of spawns fail | host/primitive instability — degrade to single-agent |
| `verify_skip` | > 1% complete without required verification | safety gap — investigate immediately |
| `user_override` | > 30% of users set the layer off | the default is wrong for this population |

A breach is a maintainer/user signal, surfaced — never an automatic flip.

## Cost-routing tripwires — steering policy for downshifted dispatch

Two tripwires guard the cost-aware downshift path
(road-to-cost-aware-model-routing, council 2026-07-08). Like the rollback
guardrails they are **surfaced, never auto-flipped** — steering policy over
the routing telemetry fields (`task_class`, `tier_chosen`, `escalated_from`,
`verify_result_by_tier` in [`orchestration-telemetry`](orchestration-telemetry.md)),
not a new mechanism:

| Tripwire | Threshold | Action when fired |
|---|---|---|
| **Escalation-rate promotion** | per-class escalation rate > 40% over the rolling window | The class's default tier is wrong — cascading it costs more than starting high (decision-theoretic escalation analysis). Promote the class's static default one tier and log the promotion; do not keep cascading. |
| **Verify-pass drift** | a tier's verify-pass rate drops below its trailing baseline | Verifier or model drift — a drifting verifier silently escalates everything (cost ~3x). Surface the drift to the user with the per-tier numbers; never silently absorb the extra escalations. |

Deterministic references: `escalationPromotionCandidates()` and
`verifyPassDrift()` over `readTierRoutingMetrics()` aggregates. The per-tier
quality view (spend by tier, escalation count by class, verify-pass rate by
tier) is surfaced via `/cost:report` — the delayed-signal quality guard: cost
dashboards alone look fine while quality regresses.

## Kill-switch

```
emergency.orchestration_halt: true
```

A single, no-deploy settings flip fully disables the layer (`isLayerDisabled()`)
for the duration of an incident — the one audited switch that survives
always-on orchestration (road-to-always-on-orchestration Phase 1;
`docs/contracts/settings-classes.md` § "The one exception"). Disarming it
requires a non-empty `emergency.orchestration_halt_justification`.

## Reference implementation

[`src/scripts/_lib/subagent_steering.ts`](../../../../src/scripts/_lib/subagent_steering.ts)
(`isLayerDisabled`, `budgetHalt`, `typeStop`, `sliceDispatchAllowed`,
`breachedGuardrails`, `readTierRoutingMetrics`,
`escalationPromotionCandidates`, `verifyPassDrift`), covered by
[`tests/scripts/_lib_subagent_steering.test.ts`](../../../../tests/scripts/_lib_subagent_steering.test.ts).

## Related

- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 budget.
- [`auto-orchestration-activation`](auto-orchestration-activation.md) — `enabled`/`auto` keys.
- [`orchestration-telemetry`](orchestration-telemetry.md) — the audit signals the guardrails read.
- [`subagent-response-contract`](subagent-response-contract.md) — the structured body returned inside this 4-status envelope + the orchestrator's synthesis duties.
