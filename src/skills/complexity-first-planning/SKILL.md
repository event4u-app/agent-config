---
name: complexity-first-planning
description: "Use when staging multi-component or uncertain work — tackle the load-bearing unknown first (risk-first decomposition), not the easy parts first."
source: package
domain: engineering
status: active
model_tier: medium
tier: senior
context_spine: [repo]
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# complexity-first-planning

Part of the Reasoning Discipline Protocol. Engage per
[`rdp-gate`](../../contexts/execution/rdp-gate.md) (skip on trivial / linear
tasks; light touch on a strong-reasoning host).

> **Provenance.** This is an **RDP derivation from general engineering discipline
> (risk-first / critical-path / pre-mortem)** — it is **not** an Anthropic-
> documented Fable behavior. Fable's "start at the top of your difficulty range"
> is about *task selection* (give the model harder tasks), not intra-task order.
> The skill stands on its own merit; it is not sold as a frontier-model transplant.

## When to use

- Staging multi-component work where the hardest/most-uncertain part is not yet proven.
- A plan whose later steps depend on an assumption that could collapse.

Do NOT use for single-step, linear, or fully-specified tasks (no load-bearing
unknown to resolve), or when the user has already fixed the sequence.

## Procedure

1. **Name the unknowns.** List the components + which carry real uncertainty
   (technical feasibility, an unverified integration, an ambiguous requirement).
2. **Rank by load-bearing risk.** The load-bearing unknown is the one whose
   failure invalidates the most dependent work — not the one that is merely hard.
3. **Resolve it first.** Spike / probe / prototype the load-bearing unknown
   before building anything that depends on it. Record the result in the notes
   file (see [`notes-first-reasoning`](../../rules/notes-first-reasoning.md)):
   prediction → result → lesson.
4. **Cascade.** Once the riskiest assumption holds (or is corrected), sequence
   the dependent work. If it fails, the cheap early failure saved the rework.

## Output

A short ordered plan that leads with the load-bearing unknown + how it will be
proven, then the dependent steps. One recommendation, not a survey.

## Do NOT

- Build the easy parts first to show progress, then discover the hard part breaks them.
- Treat "hardest" as "most code" — rank by *dependency blast radius*, not effort.
- Over-plan a strong-reasoning host (it sequences risk natively — keep it light).

## See also

- [`rdp-gate`](../../contexts/execution/rdp-gate.md) — engagement gate.
- [`feature-planning`](../feature-planning/SKILL.md) — composes this for the breakdown.
- [`notes-first-reasoning`](../../rules/notes-first-reasoning.md) — where the
  prediction/result/lesson of the spike is recorded.
