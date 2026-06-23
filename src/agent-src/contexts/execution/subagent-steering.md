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

## Rollback guardrails — surfaced, not auto-disabled

```
A CONFIG PACKAGE RUNS NO DAEMON. THERE IS NO AUTOMATIC COHORT-DISABLE.
BREACHES ARE SURFACED FROM THE AUDIT LOG FOR THE MAINTAINER / USER TO ACT ON.
THE ONLY AUTOMATIC STOP IS THE PER-TARGET N=3 BUDGET.
```

The guardrail thresholds (`breachedGuardrails()`), read off the
[`orchestration-telemetry`](orchestration-telemetry.md) audit signals:

| Signal | Threshold | Meaning when breached |
|---|---|---|
| `token_blowup` | spend > 2× single-agent baseline | the layer is costing more than it saves |
| `spawn_failure` | > 10% of spawns fail | host/primitive instability — degrade to single-agent |
| `verify_skip` | > 1% complete without required verification | safety gap — investigate immediately |
| `user_override` | > 30% of users set the layer off | the default is wrong for this population |

A breach is a maintainer/user signal, surfaced — never an automatic flip.

## Kill-switch

```
subagents.enabled: false   (or  subagents.auto: off)
```

A single, no-deploy settings flip fully disables the layer (`isLayerDisabled()`).
This is the canonical disable — no code change, effective on the next run.

## Reference implementation

[`src/scripts/_lib/subagent_steering.ts`](../../../../src/scripts/_lib/subagent_steering.ts)
(`isLayerDisabled`, `budgetHalt`, `breachedGuardrails`), covered by
[`tests/scripts/_lib_subagent_steering.test.ts`](../../../../tests/scripts/_lib_subagent_steering.test.ts).

## Related

- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 budget.
- [`auto-orchestration-activation`](auto-orchestration-activation.md) — `enabled`/`auto` keys.
- [`orchestration-telemetry`](orchestration-telemetry.md) — the audit signals the guardrails read.
