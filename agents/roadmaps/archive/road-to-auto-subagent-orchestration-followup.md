---
complexity: structural
status: ready
parent_roadmap: road-to-auto-subagent-orchestration
---

# Roadmap: Follow-up to automatic subagent orchestration — benchmark & default-flip

> Run the empirical benchmark that gates the auto-orchestration default, then
> flip the shipped default toward `on` if (and only if) it proves a net win.

## Context

This roadmap collects the two items deferred from
[`agents/roadmaps/archive/road-to-auto-subagent-orchestration.md`](archive/road-to-auto-subagent-orchestration.md)
(Phase 6). The full feature — settings, activation, routing, spawn contract,
verification budget, steering, kill-switch, docs — shipped in the parent; only
the evidence-gated default-flip remains. See the parent's archive entry +
[ADR-105](../../docs/decisions/ADR-105-automatic-subagent-orchestration.md) for
the original rationale and the resolved council verdicts.

The gate mechanism (`gateVerdict`, `resolveShippedDefault`) and the benchmark
wiring already exist (`src/scripts/_lib/orchestration_gate.ts`,
`src/agent-src/contexts/execution/orchestration-benchmark-gate.md`). What
remains is the **empirical run** and the one-line flip it authorises.

> Blocked until the user authorises the live `bench:ab` run (API spend on a
> representative delegable-task corpus). Execution starts when that clears.

## Prerequisites

- [x] Read `AGENTS.md` and the parent archive entry.
- [x] Confirm `bench:ab` value-harness config + the `subagents.*` settings are in place. Confirmed: harness exists; `subagents.auto: ask` is the current shipped default; gate helpers `gateVerdict`/`resolveShippedDefault` in place.

## Phase 1: Benchmark & default-flip (carried from parent Phase 6)

- [-] Measure orchestrated vs. single-agent via the headless `bench:ab` harness —
      **cancelled: not credibly producible here.** Verified 2026-06-26 (AI-council
      2026-06-26 + evidence): the harness re-invokes `claude --print` and scores
      file changes; it does NOT execute model `Task`/`Agent` tool calls (the
      `package-recursive` arm is a scripted re-call loop, not subagent execution),
      there is no delegable-task corpus, and no arm toggles `subagents.auto`. A
      real value measurement would need an agent-execution runtime (against the
      no-runtime identity); a decision-propensity proxy is the wrong layer for a
      global default flip. Verdict + method recorded in
      `agents/settings/contexts/orchestration-default-flip-verdict.md`.
- [x] **Honest-null exit taken → keep `subagents.auto: ask`** (already the shipped
      default; no flip). The flip to `on` is re-gated on accumulated real-world
      `orchestration-telemetry` (realized value), fed through the existing
      `gateVerdict`. `on` stays the destination, reached by evidence, not assumed.

## Acceptance Criteria

- [x] A reproducible/auditable verdict exists (method + evidence + decision):
      `agents/settings/contexts/orchestration-default-flip-verdict.md` — the
      honest negative finding stands in for a benchmark that cannot be credibly
      produced in the headless harness.
- [x] The shipped `subagents.auto` default reflects the verdict — `ask` (honest-null).
- [x] Quality gates pass (refs + linters green; no code change to the default).
