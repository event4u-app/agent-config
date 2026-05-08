---
name: roadmap:process-full
cluster: roadmap
sub: process-full
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process every open step across every phase of a roadmap until the file is fully closed. Largest execution scope of the /roadmap cluster — runs continuously across phase boundaries.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "process the whole roadmap, finish the roadmap, komplette roadmap abarbeiten"
  trigger_context: "existing agents/roadmaps/*.md and user wants the entire file done end-to-end"
---

# /roadmap:process-full

Whole-roadmap execution scope of the [`/roadmap`](../roadmap.md)
cluster. Same canonical loop as
[`/roadmap:process-phase`](process-phase.md), but does **not** stop at
phase boundaries — continues until every step is closed (or a halt
condition fires).

## Instructions

Run the canonical loop in
[`contexts/execution/roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md)
with the **scope delta below**.

## Scope delta

- **Working set:** every open step across every phase, in document
  order. **Horizon markers do not narrow the working set** — see
  Iron Law below.
- **Stop after:** the entire roadmap reaches `count_open == 0`, or a
  halt condition fires (Hard-Floor, council-off + ambiguity,
  security-sensitive, scope-out-of-roadmap, test/quality red).
- **Phase boundary handling:** at every phase boundary, run the
  per-phase quality pipeline when `quality_cadence: per_phase` (or
  `per_step`). On red → stop, surface, do **not** silently roll into
  the next phase.
- **Final archival:** when the roadmap is fully closed, run the
  archival check from
  [`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival).

## Iron Law — Full is Full

```
/roadmap:process-full PROCESSES EVERY OPEN STEP IN THE FILE.
HORIZON MARKERS, "OUT-OF-HORIZON" LABELS, "GATED ON PHASE X"
NOTES, AND PHASE-INTERNAL "OPTIONAL" TAGS DO NOT NARROW THE
WORKING SET. ONLY THE FIVE HALT CONDITIONS STOP THE RUN.
```

Roadmaps frequently carry "Horizon (N-week visible plate)" sections or
"(out-of-horizon, gated on Phase N)" sub-headings as authoring devices.
Those are **archival annotations**, not execution gates.
`/roadmap:process-full` ignores them by construction. Horizon-respecting
execution → invoke `/roadmap:process-phase` (single phase) or
`/roadmap:process-step` (single step) instead.

## Rules

- **No silent acceleration past a halt.** Every halt condition stops
  the run; the user resumes on the next turn.
- **No silent stop at a horizon marker.** Encountering "out-of-horizon",
  "gated on Phase N", "deferred", or any equivalent annotation is
  **not** a halt condition. Continue.
- **Phase quality pipeline runs at every phase boundary** when cadence
  is `per_phase` or `per_step`. `end_of_roadmap` skips per-phase and
  runs only at the final archival check.
- All other rules from
  [`process-phase § Rules`](process-phase.md#rules) apply unchanged.

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/roadmap:process-step`](process-step.md) — single-step variant
- [`/roadmap:process-phase`](process-phase.md) — default scope, single phase
- [`roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md) — canonical mechanics
