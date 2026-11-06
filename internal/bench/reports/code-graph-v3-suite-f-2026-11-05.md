# Code-graph benchmark v3 — suite F, 2026-11-05

Registered in `internal/bench/code-graph/PREREGISTRATION-v3-2026-11-05.md` § Bars
(F primary, F gate). Tasks: `suite-f-tasks-v3-2026-11-05.yaml` — 24 tasks, 18
localise-and-fix and 6 pr-review-missed-callers; 11 `larasend`, 13 `unopim`.

## Verdict

**GATED** — neither a pass nor a null. No agent arm was run and no task was scored.

## Why the gate cannot open for this registration

The registration scores suite F only if `dispatch-event-capture-reliability` measures
**≥ 95 % on the run's own audit stream**. That claim's own definition
(`docs/CLAIMS.md`, `claim: dispatch-event-capture-reliability`, population clause)
reports any corpus with **fewer than 50 dispatches** as UNDERPOWERED, which "may not be
cited as a pass".

The run's own stream is bounded by its design: 24 tasks × 2 arms (floor, floor +
native) = **48 agent dispatches**, one per task and arm. Neither arm dispatches
subagents of its own — the floor is a grep-and-read agent. 48 is below the 50-dispatch
floor, so the gate reads UNDERPOWERED in every outcome, whatever the capture rate. Adding
dispatches that do no task work to clear the floor would manufacture the reading the
gate exists to check, so it was not done.

Consequence: running the 48 arms would buy a result that cannot be scored. The pilot
planned for this step (one task per subject and arm, 4 dispatches) was dropped for the
same reason — 4 dispatches settle nothing either.

## Context reading — not the gate, stated so it is not mistaken for one

The install-wide stream was re-counted with the method of
`agents/evidence/analysis/dispatch-event-capture-2026-08-30.md` (numerator: audit lines in
this checkout's `agents/runtime/state/audit/` carrying an `orchestration` sub-object with
`spawn_count ≥ 1`; denominator: `Agent` tool-use blocks, de-duplicated by id, in every
transcript store whose sessions write to that directory — main checkout plus
`.claude/worktrees/*`, across every local Claude profile).

| Window | Recorded | Dispatches | Rate |
|---|---|---|---|
| 2026-10-06 → 2026-11-05 | 1,084 | 1,106 | 98.0 % |

This is one machine's gitignored runtime state, not the run's own stream, and it does not
re-resolve the 2026-08-30 claim. It says one thing only: the capture rate is no longer
the obstacle — the power floor is. A first count that read only one profile's transcript
store returned 1,084 recorded against 145 observed; the store set above is the corrected
denominator, the same effect the 2026-08-30 analysis documents for worktrees.

## What would open it

Per § No renegotiation, a corrected experiment is a **new, dated registration**, never a
repaired continuation of this one. A registration whose gate can be met needs a power
source the design actually produces — for example ≥ 2 independent repetitions per task
and arm (≥ 96 dispatches), or a gate read over a stated install-stream window that
contains the run. Either is a decision for that registration, not for this report.

## Effect on the class verdict

None. The registration states suite F's result is published either way and does not
substitute for a class win; the null path stands as recorded in
`code-graph-v3-2026-11-05-scored.md` (zero of six classes won).
