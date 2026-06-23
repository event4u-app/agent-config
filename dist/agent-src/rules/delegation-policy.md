---
type: "auto"
tier: "2b"
alwaysApply: false
source: "package"
description: "Delegable multi-part work + auto-orchestration enabled — decompose, tier-size each slice, dispatch to subagents instead of doing it all in-session"
triggers:
  - keyword: "delegate"
  - keyword: "orchestrate"
  - keyword: "subagent"
  - keyword: "parallel"
  - phrase: "review these"
  - phrase: "analyze the codebase"
  - phrase: "for each"
load_context:
  - "../contexts/execution/auto-orchestration-activation.md"
  - "../contexts/execution/auto-dispatch-classification.md"
routes_to:
  - "skill:subagent-orchestration"
workspaces:
  - engineering
packs:
  - engineering-base
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

`subagents.auto: ask` → ask once before dispatching (per
[`user-interaction`](user-interaction.md)); `auto: on` → surface the chosen mode
+ per-subtask tiers in one line. Any gate failing, or `auto: off`, or no host
primitive → run in-session (clean no-op).

## What it makes binding

1. **Decompose** the task into independent / ordered slices.
2. **Tier-size** each slice (`lite|medium|high`) per the classification context —
   never the orchestrator's own session tier (the cost win is the per-call
   downsize; see [`subagent-routing`](../contexts/execution/subagent-routing.md)).
3. **Dispatch** via the matching `subagent-orchestration` mode (independent →
   do-in-parallel; ordered → do-in-steps; risk/correctness → + judge).
4. **Verify** every return per
   [`verify-budget`](../contexts/execution/verify-budget.md); the cross-model
   judge Iron Law and the N=3 budget ([`autonomous-execution`](autonomous-execution.md))
   are never lifted.

## Scope — does NOT

- Make the orchestrator switch its **own** model (the user owns `/model`).
- Fire on trivial / single-step / fully-in-head work.
- Spawn on an unclassifiable task — that is ask/no-op, not a speculative spawn.
- Lift any safety floor or delegate a Hard-Floor action
  ([`non-destructive-by-default`](non-destructive-by-default.md)).

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — the 7 modes this selects.
- [`auto-orchestration-activation`](../contexts/execution/auto-orchestration-activation.md) — the gate.
- [`reasoning-orchestrator`](../skills/reasoning-orchestrator/SKILL.md) — RDP dispatch, now gated here.
