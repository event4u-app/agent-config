---
model_tier: medium
name: roadmap-process-phase
pack: product-basic
tier: 2
visibility: internal
cluster: roadmap
sub: process-phase
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process every open step in the next or current phase of a roadmap, then stop. Default execution scope of the /roadmap cluster.
suggestion:
  eligible: true
  trigger_description: "process the next phase, finish this phase autonomously, eine phase abarbeiten"
  trigger_context: "existing agents/roadmaps/*.md and user wants the next phase done end-to-end"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:process-phase

Default execution scope of the [`/roadmap`](../roadmap.md) cluster.
Sibling of [`/roadmap:process-step`](process-step.md) and
[`/roadmap:process-full`](process-full.md). Replaces the legacy
`/roadmap execute` (which paused for confirmation before every step).

## Instructions

Run the canonical loop in
[`contexts/execution/roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md)
with the **scope delta below**. The loop file owns roadmap discovery,
pre-run summary, cadence resolution, the § 3 pre-scan (execution
contract when frontmatter declares `execution.mode: autonomous |
phase-checkpoints` — see
[`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md) —
otherwise the legacy commit-step ask), the step loop with AI-council
branching, halt conditions, and the archival check.

## Scope delta

- **Execution mode:** read `execution.mode` from frontmatter; under
  `autonomous` / `phase-checkpoints` the run-start contract governs
  the run's grants. `phase-checkpoints` behaves like `autonomous`
  inside this single phase (its checkpoint prompt fires at the
  boundary, where this wrapper stops anyway).
- **Working set:** all open steps in the **first phase with
  `count_open > 0`**. If every phase is closed → report "Roadmap
  already complete." and run the archival check from
  [`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival).
- **Stop after:** the phase boundary. Do **not** advance into the next
  phase. Use [`/roadmap:process-full`](process-full.md) for continuous
  execution across phases.
- **Quality cadence at the boundary:** run the per-phase pipeline when
  `quality_cadence: per_phase` (or `per_step`). Skip when
  `end_of_roadmap`.

## Rules

- **Autonomous within the phase, never beyond.** The user picks
  `process-step` for one step or `process-full` for the whole roadmap.
- **No commit, push, branch, PR, tag, or bulk-destructive op** without
  explicit permission this turn **or an accepted run-start execution
  contract** (whose grants cover exactly: the run's feature branch,
  chunked commits on it, push to that branch only, PR-open — never
  merge; see
  [`roadmap-execution-contract § 3`](../../contexts/execution/roadmap-execution-contract.md)) —
  see [`commit-policy`](../../rules/commit-policy.md) and
  [`scope-control § git-ops`](../../rules/scope-control.md#git-operations--permission-gated).
  Roadmap-listed commit steps follow the single-upfront-ask flow in
  [`roadmap-process-loop § 3`](../../contexts/execution/roadmap-process-loop.md#3-pre-scan--execution-contract-or-commit-step-ask).
- **Every checkbox edit syncs the dashboard in the same response** per
  [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md).
- **AI-council consultations run silently when council is on.** No
  per-call confirmation. The opt-in covers the whole run.
- **Decline = silence.** Once the user said "skip council", do not
  re-offer for the rest of this run.
- **Halt cleanly on Hard-Floor or true ambiguity.** Surface state,
  wait. Resume on the user's next turn from the same checkbox.

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/roadmap:process-step`](process-step.md) — single-step variant
- [`/roadmap:process-full`](process-full.md) — across-phases variant
- [`/roadmap:create`](create.md) — sibling, scaffolds roadmaps
- [`roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md) — canonical mechanics
- [`roadmap-management`](../../skills/roadmap-management/SKILL.md) — checkbox + archival mechanics
