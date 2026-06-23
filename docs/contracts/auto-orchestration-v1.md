---
stability: beta
keep-beta-until: 2026-09-23
---

# Auto-Orchestration v1

**Purpose.** Pin the data shapes the automatic subagent-orchestration layer
depends on — the host-capability manifest, the spawn brief, and the
orchestration telemetry object — so producers and consumers agree without
re-deriving them. Behaviour (when to dispatch, how to route, how to verify)
lives in the context docs; this contract pins the **shapes**.

**Scope.** The three JSON shapes below + the activation precondition. Does not
define classification rules, routing policy, or the verification budget — those
are the cited context docs.

Last refreshed: 2026-06-23. Decided in
[ADR-105](../decisions/ADR-105-automatic-subagent-orchestration.md).

## Host-capability manifest

Resolved once per session, cached. Safe default = all-false.

```json
{ "schema_version": 1, "subagent_spawn": false, "parallel_spawn": false, "status_polling": false, "separate_quota_pool": false }
```

Full semantics: [`host-capability-manifest`](../../src/agent-src/contexts/execution/host-capability-manifest.md).

## Spawn brief

Composed per delegated sub-task; knowledge is references only, capped.

```json
{ "task": "<sub-task>", "role_mode": "reviewer|null", "profile": "<id|null>", "personas": ["<id>"], "knowledge_refs": ["<id-or-path>"] }
```

Full semantics: [`subagent-spawn-contract`](../../src/agent-src/contexts/execution/subagent-spawn-contract.md).

## Orchestration telemetry

Optional `orchestration` object on an [`audit-log-v1`](audit-log-v1.md) line —
additive, non-breaking, counts + ids only.

```json
{ "task_size_estimate": 0, "spawn_count": 0, "tiers": [], "token_delta": 0, "wall_clock_ms": 0, "outcome": "DONE", "verify_mode": "deterministic" }
```

Full semantics: [`orchestration-telemetry`](../../src/agent-src/contexts/execution/orchestration-telemetry.md).

## Activation precondition

Auto-dispatch is attempted only when:

```
subagents.enabled AND subagents.auto != off AND manifest.subagent_spawn AND task-is-delegable
```

Any failing → in-session. Full gate:
[`auto-orchestration-activation`](../../src/agent-src/contexts/execution/auto-orchestration-activation.md).

## Cross-references

- [ADR-105](../decisions/ADR-105-automatic-subagent-orchestration.md) — the decisions.
- [`subagent-routing`](../../src/agent-src/contexts/execution/subagent-routing.md) — model downshift + quota bonus.
- [`auto-dispatch-classification`](../../src/agent-src/contexts/execution/auto-dispatch-classification.md) — delegability rules.
- [`verify-budget`](../../src/agent-src/contexts/execution/verify-budget.md) — verification budget.
- [`subagent-steering`](../../src/agent-src/contexts/execution/subagent-steering.md) — guardrails + kill-switch.
- [`orchestration-benchmark-gate`](../../src/agent-src/contexts/execution/orchestration-benchmark-gate.md) — the default-flip gate.
