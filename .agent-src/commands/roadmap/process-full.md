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

Roadmaps frequently carry a "Horizon (N-week visible plate)" section
or "(out-of-horizon, gated on Phase N)" sub-headings as an authoring
device. Those are **archival annotations**, not execution gates.
`/roadmap:process-full` ignores them by construction. If the user
wants horizon-respecting execution, they invoke `/roadmap:process-phase`
(scope = single phase) or `/roadmap:process-step` (scope = single
step) instead.

## Iron Law — Real-time dashboard

```
EVERY DONE STEP FLIPS [ ] → [x] BEFORE THE LOOP MOVES TO THE NEXT STEP.
DASHBOARD REGENERATES IN THE SAME REPLY THAT FLIPPED THE BOX.
NO BATCH FLIP AT THE ARCHIVE COMMIT. NO "I'LL DO IT AT THE END."
```

`/roadmap:process-full` is the worst offender for batching because it
runs continuously across many steps. Flipping all 13 boxes in the
single archive commit defeats the dashboard's purpose — the user
loses progress visibility for the entire run. Per Iron Law 2 of
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md): the
flip + regen pair is atomic with the step's work, executed inside
[`roadmap-process-loop § 5`](../../contexts/execution/roadmap-process-loop.md#5-step-loop)
step 5.

## Rules

- **No silent acceleration past a halt.** Every halt condition stops
  the run; the user resumes on the next turn.
- **No silent stop at a horizon marker.** Encountering "out-of-horizon",
  "gated on Phase N", "deferred", or any equivalent annotation is
  **not** a halt condition. Continue.
- **No silent batch flip.** Each step's checkbox flips in the same
  reply that lands its work — never deferred to the archive commit.
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
