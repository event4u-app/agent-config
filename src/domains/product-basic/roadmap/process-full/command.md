---
model_tier: medium
name: roadmap-process-full
pack: product-basic
tier: 2
visibility: internal
cluster: roadmap
sub: process-full
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process every open step across every phase of a roadmap until the file is fully closed. Largest execution scope of the /roadmap cluster — runs continuously across phase boundaries.
suggestion:
  eligible: true
  trigger_description: "process the whole roadmap, finish the roadmap, komplette roadmap abarbeiten"
  trigger_context: "existing agents/roadmaps/*.md and user wants the entire file done end-to-end"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

- **Execution mode:** read `execution.mode` from frontmatter. Under
  `autonomous` / `phase-checkpoints` the loop's § 3 pre-scan derives
  the run-start **execution contract**
  ([`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md));
  ONE acceptance activates all run grants (feature branch, chunked
  commits, push to that branch only, PR-open, batched artifact
  drafting, council auto-enable) — no further asks until a safety
  floor. `mode: autonomous` is the flagship pairing for this wrapper:
  full working set + contract = uninterrupted run to the defined end
  state.
- **Working set:** every open step across every phase, in document
  order. Phase-internal annotations like `(deferred)` / `(optional)` /
  "gated on Phase N" do not narrow the working set.
- **Stop after:** the entire roadmap reaches `count_open == 0`, or a
  halt condition fires (Hard-Floor, council-off + ambiguity — the
  latter only outside an accepted contract with council available,
  security-sensitive, scope-out-of-roadmap, test/quality red).
- **Phase boundary handling:** at every phase boundary, run the
  per-phase quality pipeline when `quality_cadence: per_phase` (or
  `per_step`) AND `quality.local_auto_run: true` — under the default
  (`false` / missing) the pipeline never runs locally; remote CI is
  the gate. On red → stop, surface, do **not** silently roll into
  the next phase. Under `mode: phase-checkpoints`, additionally emit
  a compact status LINE at every boundary — but under `process-full`
  this is a NON-BLOCKING status, NOT a stop-and-wait: the run continues
  to the next phase immediately. `phase-checkpoints` narrows to a
  stop-and-wait only under `/roadmap:process-phase`, never here (a
  process-full invocation overrides the mode's boundary-wait). Under
  `autonomous`, boundaries are silent (quality pipeline aside).
- **Final archival:** when the roadmap is fully closed, run the
  archival check from
  [`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival).

## Iron Law — Full is Full

```
/roadmap:process-full IS LAW: IT PROCESSES EVERY OPEN STEP IN THE FILE,
TO COMPLETION, ACROSS EVERY PHASE. ONLY THE FIVE HALT CONDITIONS STOP IT.
PHASE-INTERNAL "(DEFERRED)" / "(OPTIONAL)" / "GATED ON PHASE X" NOTES DO
NOT NARROW THE WORKING SET. A PHASE BOUNDARY IS NOT A STOP.
```

The **five — and only five — halt conditions** (exhaustive; nothing else
stops the run):

1. **Hard-Floor** trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)).
2. **Council-off + genuine ambiguity** (only outside an accepted contract with council available).
3. **Security-sensitive** surface reached.
4. **Scope-out-of-roadmap** work discovered.
5. **Test / quality red** that cannot be cleared within the N=3 budget.

```
FORBIDDEN NON-HALT REASONS — NEVER STOP THE RUN FOR ANY OF THESE:
  · "running low on context / token budget"
  · "quality would degrade / deserves a fresh focused run later"
  · "avoid a PR pile-up" / "let the open PRs merge first"
  · "this phase is large / touches a deep subsystem"
  · "phase-checkpoints mode, so I'll checkpoint and wait"
  · any agent-invented caution not in the five halt conditions above.
INVENTING A HALT REASON IS A VIOLATION OF THE COMMAND AND THE USER'S WILL.
IF CONTEXT RUNS OUT MID-RUN, KEEP LANDING COMPLETE STEPS UNTIL IT DOES —
NEVER ANNOUNCE A BOUNDARY-STOP BY CHOICE.
```

Phase-internal `(deferred)` / `(optional)` / `gated on Phase N` tags are
authoring annotations, not execution gates. `/roadmap:process-full`
ignores them by construction. If the user wants narrower execution they
invoke `/roadmap:process-phase` (scope = single phase) or
`/roadmap:process-step` (scope = single step) instead.

Time-boxed plate / horizon framing is opt-in via
`roadmap.horizon_weeks` in `.agent-settings.yml` (default `0` =
forbidden, per template rule 16 in `templates/roadmaps.md`). If a
roadmap carries such phrasing — whether by legacy or by an opt-in
setting — treat it as ordinary prose during execution, never as a
gate. Phase ordering and explicit dependency gates govern the loop.

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
- **No silent stop at an authoring annotation.** Encountering
  "gated on Phase N", "deferred", "optional", or any equivalent
  phase-internal annotation is **not** a halt condition. Continue.
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
