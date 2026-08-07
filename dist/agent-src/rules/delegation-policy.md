---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Delegable multi-part work + auto-orchestration on — decompose, tier-size, dispatch to subagents instead of in-session"
triggers:
  - keyword: "delegate"
  - keyword: "orchestrate"
  - keyword: "subagent"
  - keyword: "parallel"
  - phrase: "review these"
  - phrase: "analyze the codebase"
  - phrase: "for each"
  - keyword: "analyse"
  - keyword: "analyze"
load_context:
  - "../contexts/execution/auto-orchestration-activation.md"
  - "../contexts/execution/auto-dispatch-classification.md"
routes_to:
  - "skill:subagent-orchestration"
workspaces: [engineering]
packs: [engineering-base]
# obligation: "WHEN THE ACTIVATION GATE CLEARS, DECOMPOSE THE TASK, TIER-SIZE EACH SLICE" — src/rules/delegation-policy.md:35
obligation_frequency: "per-task"
---

# Delegation Policy

The loadable auto-trigger for the automatic subagent-orchestration layer. It is
the single source of the "delegate by default" behaviour — the
`subagent-orchestration` skill and `reasoning-orchestrator` point here rather
than restating the trigger.

## The Iron Law

```
WHEN THE ACTIVATION GATE CLEARS, DECOMPOSE THE TASK, TIER-SIZE EACH SLICE,
AND DISPATCH TO SUBAGENTS — DO NOT DO ALL THE WORK IN-SESSION.
AMBIGUITY DEFAULTS TO ask / no-op — NEVER SPECULATIVE SPAWN.
THE ORCHESTRATOR NEVER ADOPTS A SUBAGENT RETURN UNVERIFIED.
```

## When it fires

Only when the activation gate from
[`auto-orchestration-activation`](../contexts/execution/auto-orchestration-activation.md)
clears — all of:

- `subagents.enabled` **and** `subagents.auto != off`,
- the host-capability manifest reports `subagent_spawn: true`,
- the task is classified **delegable** per
  [`auto-dispatch-classification`](../contexts/execution/auto-dispatch-classification.md)
  (≥1 independent, well-specified slice above the size floor).

`subagents.auto: ask` → ask once before dispatching, in the shape
[`settings-ask-protocol`](settings-ask-protocol.md) fixes (the answer is not
persisted — `subagents.auto` is class C); `auto: on` → surface the chosen mode
+ per-subtask tiers in one line. Any gate failing, or `auto: off`, or no host
primitive → run in-session (clean no-op).

## What it makes binding

1. **Decompose** the task into independent / ordered slices.
2. **Tier-size** each slice (`lite|medium|high`) per the classification context —
   never the orchestrator's own session tier (the cost win is the per-call
   downsize; see [`subagent-routing`](../contexts/execution/subagent-routing.md)).
3. **Dispatch** via the form gate + matching `subagent-orchestration` mode
   (independent → do-in-parallel; ordered → do-in-steps; risk/correctness →
   + judge; UI-heavy → live-app judge, efficacy-gated).
4. **Verify** every return per
   [`verify-budget`](../contexts/execution/verify-budget.md); the cross-model
   judge Iron Law and the N=3 budget ([`autonomous-execution`](autonomous-execution.md))
   are never lifted.
5. **Respect the failure-type stop and the ordering gate** — two consecutive
   verification-failed returns from one subagent type stop that type for the
   session (an application of the N=3 budget, no new mechanism), and an
   ordered slice never dispatches before its declared parent's return is
   verified. Both per
   [`subagent-steering`](../contexts/execution/subagent-steering.md).
6. **Record** telemetry after each dispatch — run `orchestration_record`
   (one validated line: spawn_count, token_delta + provenance, tier, task_class)
   per [`orchestration-telemetry`](../contexts/execution/orchestration-telemetry.md)
   § Emit. This is the agent-behavioral capture the savings report reads;
   skipping it leaves the value-of-orchestration question unmeasured.

## Scope — does NOT

- Make the orchestrator switch its **own** model (the user owns `/model`).
- Fire on trivial / single-step / fully-in-head work.
- Spawn on an unclassifiable task — that is ask/no-op, not a speculative spawn.
- Lift any safety floor or delegate a Hard-Floor action
  ([`non-destructive-by-default`](non-destructive-by-default.md)).

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — the form gate + 9 modes this selects.
- [`subagent-boundary`](../docs/contracts/subagent-boundary.md) — what a subagent owns vs never owns (task-meaning, memory, pack-surface, safety-floor bypass).
- [`auto-orchestration-activation`](../contexts/execution/auto-orchestration-activation.md) — the gate.
- [`reasoning-orchestrator`](../skills/reasoning-orchestrator/SKILL.md) — RDP dispatch, now gated here.
