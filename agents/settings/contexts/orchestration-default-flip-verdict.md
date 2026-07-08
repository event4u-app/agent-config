# Orchestration default-flip — verdict history

> **Current state (2026-07-09): the shipped default is `on`** on subagent-capable
> hosts. The 2026-06-26 "keep `ask`" decision below is preserved **verbatim** for
> the record — it is superseded by the re-evaluation in
> [§ Superseding decision (2026-07-09)](#superseding-decision-2026-07-09--flip-to-on-on-bounded-downside-re-evaluation)
> at the end of this file (ADR-117).

**Decision (2026-06-26).** The shipped default `subagents.auto` stays **`ask`**.
It is NOT flipped to `on`. The flip is re-gated on accumulated real-world
`orchestration-telemetry`, not a synthetic headless benchmark.

This is the honest-null branch the gate (`orchestration-benchmark-gate`,
`gateVerdict`/`resolveShippedDefault`) was built to allow — reached because a
credible benchmark is **not producible in the current harness**, not because a
benchmark ran and lost.

## Method + evidence (auditable)

The flip requires a net token-or-time win at held quality on delegable tasks,
measured orchestrated-vs-single-agent. Verified at HEAD:

- **No delegable-task corpus** exists (`ab-tracka`, `ab-trackb-v2`,
  `router-coverage`, `rtk`, `telegraph` — none is multi-part/parallelizable).
- **No bench arm toggles `subagents.auto`.**
- **The harness does not execute model-emitted `Task`/`Agent` tool calls.**
  `bench_ab_v2_run.ts::run_one_recursive` (the closest thing, ADR-106's D₂ arm)
  is a *scripted* loop: it re-invokes `claude --print` (`run_live`) and uses the
  deterministic v2 scorer as the critic. It does **not** spawn/execute subagents.
  The bench scores file changes from headless single-shot prints.

So measuring **realized** orchestrated value would require building an
agent-tool-execution harness — effectively a runtime — which contradicts the
package's no-runtime identity. A cheaper **decision-propensity** proxy (does
`auto: on` make the model *emit* more `Task` calls, at estimated cost) measures
the wrong layer for a global default change — the same category error a prior
routing-precision benchmark fell into. Neither is a sound basis to flip a
shipped default that affects every capable host.

## AI-council convergence (inline per `no-roadmap-references`)

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-26, 2 rounds): the orchestration
*decision* is observable headlessly, BUT a credible *value* measurement is not —
**explicitly contingent** on whether the recursive arm executes real `Agent`
tool calls. It does not (verified: scripted re-call loop), so the build-the-bench
case collapses by its own stated falsifier, and telemetry is the right instrument
for the gate. Telemetry's opt-in selection bias is acknowledged but it measures
**realized** value from the actual `ask`-mode population — the right signal for a
default change, and unbiased toward the propensity-vs-value confound.

## What would justify flipping to `on` later

Accumulated `orchestration-telemetry` from real `ask`-mode delegations showing a
net token-or-time win at held quality on a meaningful sample — fed through the
existing `gateVerdict`. Until then, `ask` is correct: `on` is the destination,
reached by realized evidence, never assumed.

## Superseding decision (2026-07-09) — flip to `on` on bounded-downside re-evaluation

**Decision (2026-07-09).** The shipped default `subagents.auto` is flipped to
**`on`** on subagent-capable hosts (`off` elsewhere). This supersedes the
2026-06-26 "keep `ask`" decision above. Recorded in ADR-117.

**Why revisited (not relitigation).** Per `decision-revisit-gate`, the
2026-06-26 verdict was settled-under-conditions, and three conditions changed:

1. **New mechanism.** The 2026-06-26 branch answered a *quality* question. The
   open question here is *cost*: on reasoning-mass ≪ execution-mass slices,
   cost-routing to a cheaper tier is a large token saving the quality-null never
   addressed.
2. **Cost-routing already shipped.** `road-to-cost-aware-model-routing`
   (2026-07-08) landed `inferSliceTier` — delegable slices already run on the
   cheapest capable tier. The system is **not** cost-blind; only the shipped
   default was conservative. This structurally bounds the downside of `on`.
3. **The deadlock.** The 2026-06-26 re-gate ("flip on realized telemetry") was
   self-locking: telemetry needs `on`, `on` was withheld pending telemetry.

**Basis — honest.** This is a **bounded-downside** decision, NOT a passed
benchmark. A rigorous paired bench:ab remains non-producible here (no runtime
executing model `Task`/`Agent` calls). The evidence is:

- **Directional probe (N=2, real).** Two live read-only-fan-out delegations this
  session consumed ~70k and ~86k Sonnet tokens on genuinely-occurring work;
  inline-Opus counterfactual ≈ same token mass at ~5× the rate → ~80% saving per
  task, outputs verified usable. Small N, single task-type, arithmetic
  counterfactual — directional, not rigorous.
- **Bounded downside.** `on` auto-dispatches only structurally-signalled,
  cost-routed, verified slices — it cannot delegate unstructured, tiny, or
  frontier-priced work. Anthropic's "reversible ≠ costless" catastrophe
  (deep council 2026-07-08) assumed a cost-blind system; the real system is
  cost-routed, so the worst case is far smaller.
- **Reversible + monitored.** `resolveShippedDefault()` is now the demotion gate:
  a measured telemetry regression flips the default back to `ask`.

**AI-council (inline per `no-roadmap-references`).** Deep council
(claude-sonnet-4-5 + gpt-4o, 2026-07-08, 4 rounds): split — Anthropic argued
validate-before-flip (strongest single argument), gpt-4o argued bounded
incremental rollout suffices. The flip follows gpt-4o's path, strengthened by
the post-council finding that the classifier is cost-routed (which defuses
Anthropic's core catastrophe premise).

**revisit-if / demotion trigger.** Accumulated real-world orchestration
telemetry showing a net token-or-time *loss* or a quality regression on the
delegable subset → demote to `ask` via `gateVerdict`/`resolveShippedDefault`.

## See also

- `auto-orchestration-activation` — the `subagents.auto` key.
- `orchestration-telemetry` — the realized-value signal the flip is re-gated on.
- ADR-105 — automatic subagent orchestration.
