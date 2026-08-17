# experiment-loop — the register

Loaded on demand by [`experiment-loop`](../SKILL.md). The register is the run:
if it cannot reconstruct what happened with the transcript discarded, the run
was not recorded.

## Shape

An **append-only JSONL** file, one row per iteration, **untracked** (the run is
evidence, not source). Re-read from disk at the top of every cycle.

Row 0 declares the run:

```json
{"row": 0, "evaluator": "bundle-size", "direction": "minimize",
 "baseline_score": -142000, "max_iterations": 12,
 "exit_signal": "consecutive_reverts >= 3"}
```

Each iteration:

```json
{"row": 1, "label": "drop the polyfill for evergreen targets", "head": "a1b2c3d",
 "baseline_score": -142000, "score": -138400, "metric": 138400,
 "metric_state": "present", "pass": true, "decision": "keep",
 "reason": "strict improvement"}
```

`decision` is one of `pending` · `keep` · `revert`. `reason` is one of
`strict improvement` · `no strict improvement` · `test red` ·
`evaluator failed` · `metric unreadable`.

## Write the row BEFORE the action it records

This is the ordering that costs a run to learn. The obvious sequence — commit,
evaluate, revert, then append — leaves a window in which the branch has advanced
and the register has not. Spike s01 hit it twice: the revert threw, the process
died, and the row was never written, so the register described a run one
iteration shorter than the branch.

So: append the row with `decision: "pending"` first, then act, then rewrite that
row's decision. A crash then leaves a visible `pending` — a row that says "an
iteration started here and we do not know how it ended", which is recoverable —
instead of silence, which is not.

**"Append-only" and "rewrite the last row" are not in conflict.** Append-only
governs *history*: no row is ever deleted and no earlier row is ever edited. The
pending row is the write frontier, not history, until its outcome lands.

## Why on disk and not in the conversation

Two independent references converged on files-as-truth after documenting silent
degradation of in-conversation loop state, and the mechanism is not exotic: a
baseline held in context drifts as the context is summarised, and the loop keeps
comparing against a number that is no longer the one it kept. Nothing errors.
The run just quietly stops meaning anything.

Re-reading from disk each cycle costs one file read and removes the entire
class.

## Reporting from the register

The final report is derived, never remembered: iterations run against the bound,
baseline → final score, keeps versus reverts, the exit condition that fired, and
every reverted iteration with its reason. A revert is the most informative row in
the file — it is the hypothesis the metric rejected, and the next run needs it.
