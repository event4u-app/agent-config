# Orchestration default-flip — verdict: keep `ask`, re-gate on real telemetry

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

## See also

- `auto-orchestration-activation` — the `subagents.auto` key.
- `orchestration-telemetry` — the realized-value signal the flip is re-gated on.
- ADR-105 — automatic subagent orchestration.
