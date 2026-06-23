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

- [ ] Read `AGENTS.md` and the parent archive entry.
- [ ] Confirm `bench:ab` value-harness config + the `subagents.*` settings are in place (shipped in the parent).

## Phase 1: Benchmark & default-flip (carried from parent Phase 6)

- [ ] Use the `bench:ab` value harness to measure orchestrated vs. single-agent
      on a representative delegable-task set: token delta, wall-clock, outcome
      quality. Pin the comparison method (paired, activation-aware) per the
      existing bench mechanics. (parent Phase 6, deferred — needs live API spend)
- [ ] On a passing gate (net token-or-time win at held quality), flip the
      **shipped** default for `subagents.auto` to `on` on hosts whose manifest
      reports `subagent_spawn` (off elsewhere) — the one-line edit
      `resolveShippedDefault` is built for. Honest-null exit: no win → keep
      `ask`. (parent Phase 6, deferred — gated on the step above)

## Acceptance Criteria

- [ ] A reproducible benchmark report exists (arms, task set, metrics, verdict).
- [ ] The shipped `subagents.auto` default reflects the benchmark verdict
      (`on` on capable hosts if it passed, `ask` otherwise).
- [ ] All quality gates pass — see `quality-tools`.
