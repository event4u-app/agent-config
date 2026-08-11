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
  - "contexts/execution/auto-orchestration-activation.md"
  - "contexts/execution/auto-dispatch-classification.md"
routes_to:
  - "skill:subagent-orchestration"
workspaces: [engineering]
packs: [engineering-base]
# obligation: line 35
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

- `emergency.orchestration_halt` is not set,
- the host-capability manifest reports `subagent_spawn: true`,
- the task is classified **delegable** per
  [`auto-dispatch-classification`](../contexts/execution/auto-dispatch-classification.md)
  (≥1 independent, well-specified slice above the size floor).

Always-on orchestration (road-to-always-on-orchestration Phase 1) removed the
`subagents.enabled`/`subagents.auto` settings this used to gate on — there is
no more per-layer on/off setting. A matched delegable signal → dispatch,
surfacing the chosen mode + per-subtask tiers in one line, never silent. An
AMBIGUOUS verdict (no enumerated signal matched) → **ask**, always — a verdict
to the user, never a speculative spawn. The emergency halt, or no host
primitive → run in-session (clean no-op).

## What it makes binding

1. **Decompose** the task into independent / ordered slices.
2. **Tier-size** each slice (`lite|medium|high`) per the classification context —
   never the orchestrator's own session tier (the cost win is the per-call
   downsize; see [`subagent-routing`](../contexts/execution/subagent-routing.md)).
   Where `subagents.model_ceiling` caps the tier and the slice does not fit under
   it, the worker **escalates and never silently delivers the degraded result**;
   the orchestrator re-slices, runs in-session, or surfaces the ceiling to the
   human, and never raises the ceiling itself (class C — `settings:set` refuses
   it by construction). Absent is *uncapped*, never a low cap. Full contract:
   [`subagent-boundary § The model ceiling`](../docs/contracts/subagent-boundary.md).
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
6. **Record** telemetry after each dispatch — on hook-capable hosts the
   `orchestration-record` concern (`post_tool_use`) emits the line
   deterministically for every Agent/Task completion; on hosts without the
   slot, run `orchestration_record` yourself (one validated line: spawn_count,
   token_delta + provenance, tier, task_class) per
   [`orchestration-telemetry`](../contexts/execution/orchestration-telemetry.md)
   § Emit. Measured before the hook existed: 1 of 370 dispatches captured —
   the model-carried path alone leaves the value question unmeasured.

## Carriers — how this rule reaches a session (and what stays model-carried)

No host runs the tier-2 rule router, so this file's triggers alone never load
it. The obligation travels on three carriers instead: the always-loaded
AGENTS.md line (delegate-by-default + end-review), the `delegation-nudge`
concern on `user_prompt_submit` (runs `classifyTask` on cheap prompt signals
and injects a one-line verdict ONLY when the classifier says
`do-in-parallel`/`do-in-steps` — silence otherwise; delivery on
`user_prompt_submit` is end-to-end verified), and the `end-review-nudge`
concern on `stop` (ONE `review_skipped` telemetry line per mutating
no-review session — verified; its advisory line reaches the dispatcher
output, but host-side forwarding of stop-slot context to the model is
unverified, so the model-facing end-review carrier is the AGENTS.md line
plus this telemetry). The
capability gate itself resolves from the committed host registry merged with a
live environment probe in `src/scripts/_lib/host_capability.ts`
(`probeHostCapabilities` — capability is a fact about the host, never a
settings override).

**Never read a `false` capability as a host limitation without checking where it
came from.** The registry holds one row, so on every other host all six fields
are the all-false safe default — which records that *nobody answered*, not that
the host cannot spawn. `agent-config routing:doctor [--platform <host>]` prints
the value **and** its provenance per field (`registry` = a committed observation
this repo made once · `live-probe` = established in this process · `default` =
no answer). Run it before concluding delegation is unavailable here; the
same-shaped wrong guess about the council is the incident
[`council-availability`](council-availability.md) exists for. What stays
model-carried, honestly: the decomposition itself, the per-return
verification, and every dispatch on hosts without hook slots. The nudges are
advisory by design — whether they change behaviour is measured by the
telemetry, not assumed.

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
