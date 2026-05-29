---
name: roadmap:process-step
tier: 2
cluster: roadmap
sub: process-step
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process the single next open step of a roadmap and stop. Smallest execution scope of the /roadmap cluster — one step in, one step out.
suggestion:
  eligible: true
  trigger_description: "process the next step, do the next roadmap step, einen schritt abarbeiten"
  trigger_context: "existing agents/roadmaps/*.md and user wants exactly one step done autonomously"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:process-step

One-step execution scope of the [`/roadmap`](../roadmap.md) cluster.
Same canonical loop as [`/roadmap:process-phase`](process-phase.md),
bounded to a single iteration.

## Instructions

Run the canonical loop in
[`contexts/execution/roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md)
with the **scope delta below**.

## Scope delta

- **Working set:** the **first checkbox `[ ]` in document order**
  inside the first phase with `count_open > 0`. If every step is
  closed → report "Roadmap already complete." and run the archival
  check from
  [`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival).
- **Stop after:** one full iteration of
  [`roadmap-process-loop § 5`](../../contexts/execution/roadmap-process-loop.md#5-step-loop)
  (sub-steps 1–7). After the checkbox edit + dashboard regen, **stop**.
- **Quality cadence:** run the per-step pipeline only when
  `quality_cadence: per_step`. Skip otherwise.
- **Phase boundary:** if this single step happens to close the phase,
  do **not** advance. Report the phase as complete and stop.
- **Roadmap boundary:** if this single step happens to close the
  entire roadmap, run the archival check before reporting.

## Rules

- **Stop after one step**, even if the next step is trivial. The user
  picks `process-phase` or `process-full` when they want more.
- All other rules from
  [`process-phase § Rules`](process-phase.md#rules) apply unchanged:
  Hard-Floor, no auto-commit, dashboard sync, AI-council silent-when-on,
  decline = silence.

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/roadmap:process-phase`](process-phase.md) — default scope, single phase
- [`/roadmap:process-full`](process-full.md) — across-phases variant
- [`roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md) — canonical mechanics
