# Spike s01 — a session-bound keep-or-revert loop on a toy metric

**Date:** 2026-08-17
**Roadmap:** [road-to-metric-loop-and-review-integrity.md](../../roadmaps/road-to-metric-loop-and-review-integrity.md) Phase 0
**Tree:** `6a679cc19` (branch base `origin/main`)
**Kill criterion (pre-registered):** fewer than five clean iterations.

## Setup

A scratch git repository (scratchpad-only, nothing shipped) with three parts:

- **Subject** — `src/fmt.ts`, a pluralisation helper written deliberately verbose.
- **Verifier** — `evaluate.mjs`, emitting the s02 contract shape
  `{pass, score, metric}` where `score = -metric` (line count; lower is better)
  and `pass` comes from a seven-case behavioural test.
- **Driver** — `step.mjs`: **commit before verify**, evaluate, keep on strict
  improvement **and** `pass`, otherwise `git revert`. Loop state in an append-only,
  gitignored `register.jsonl`, **re-read from disk each cycle**, never from memory.

Baseline: `metric 24`, `pass true`.

## Result — 6 clean iterations, floor was 5

| # | Change | metric | pass | decision |
|---:|---|---:|---|---|
| 1 | collapse `error` branch to a ternary | 20 | ✅ | keep |
| 2 | collapse `warning` branch | 16 | ✅ | keep |
| 3 | collapse `note` branch | 12 | ✅ | keep |
| 4 | replace the three branches with a plural map | 6 | ✅ | keep |
| 5 | **golf: drop singular handling** (metric-gaming probe) | **2** | ❌ | **revert** |
| 6 | single expression, singular preserved | 3 | ✅ | keep |

24 → 3 across the run. **Kill not triggered** (6 ≥ 5).

**Iteration 5 is the load-bearing row.** It improved the metric by 67 % (6 → 2) and
broke the behaviour. The dual gate — `pass && score > baseline`, not `score >
baseline` alone — caught it and the branch was reverted to the last kept state.
This is the Risk-Register rank-1 failure ("the loop optimizes a metric into a worse
system") reproduced deliberately and contained.

## Two defects the run surfaced, both in the loop machinery

**1. The revert path was dead until the first non-improvement, and it was broken.**
The driver called `git revert --no-edit -q HEAD`. `git revert` has no `-q`, so the
first time a revert was actually needed the driver exited 129. Four green iterations
had passed without ever exercising it. This is precisely the "stop conditions rot
when written loosely" shape the roadmap's Context section names — the untested half
of a two-branch decision is the half that rots.

**Consequence for Phase 3:** the keep branch and the revert branch each need a test.
A loop protocol whose revert has never run is a one-branch loop with a comment.

**2. The register and the branch diverged — twice, reproducibly.**
The driver commits, evaluates, reverts, and only *then* appends the register row. So
when the revert crashed, the commit had already landed and **no register row was
written**: the branch had advanced by one iteration the register did not know about.
Reproduced a second time on a later iteration, which is why it is recorded as a
defect rather than a one-off.

**Consequence for Phase 3:** the register row is written **before** the
keep-or-revert action, then updated with the outcome — or the action is made
idempotent and replayable from the register. "Re-read from disk each cycle" protects
against conversational state decay; it does not protect against a crash between the
mutation and the record. The roadmap's exit criterion ("the register reconstructs the
run without the transcript") is exactly what this defect breaks, and it would not
have been visible without running the loop.

## Honest scope

"Clean iteration" here means the protocol executed and recorded a correct decision.
The spike does **not** measure *context* degradation over a long session — six
iterations is far below where that would appear, and the run was driven in one
session by one agent. The pre-registered floor was an iteration count and that is
what was measured; the degradation question is unanswered and stays open.

## Verdict

**PASS.** 6 ≥ 5. Phase 3 proceeds, with the two machinery defects above as design
constraints rather than as discoveries to be made again.
