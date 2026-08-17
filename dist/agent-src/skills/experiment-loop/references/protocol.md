# experiment-loop — the iteration protocol

Loaded on demand by [`experiment-loop`](../SKILL.md). One iteration, in order.

## The cycle

1. **Read the register from disk.** Not from the conversation, not from a
   variable held since the last cycle. The baseline for this iteration is the
   `score` of the most recent `keep` row, or the declared baseline if there is
   none.
2. **Make ONE focused change.** One hypothesis per iteration. A batched
   iteration produces a keep you cannot attribute and therefore cannot revert.
3. **Append the register row** with `decision: "pending"` — before the commit,
   before the evaluation. See [`register-format.md`](register-format.md) for why
   the ordering is this way round.
4. **Commit.** The revert is then a git operation rather than a manual undo, and
   the branch carries one commit per iteration whether it survives or not.
5. **Evaluate** — run the evaluator, read its
   [evaluator-output](../../../../../docs/contracts/evaluator-output.md) verdict.
6. **Decide**, and update the row:

   | Verdict | Decision |
   |---|---|
   | `pass: true` and `score > baseline` | **keep** |
   | `pass: true` and `score <= baseline` | **revert** — no strict improvement |
   | `pass: false` | **revert** — the tree is red |
   | non-zero exit · absent JSON · timeout | **revert** — the experiment failed, the measurement did not happen |
   | `metric_state: "unreadable"` | **revert** — an unread metric is not a zero |

7. **Revert if the decision says so**, then loop.

## The two exit conditions

Both are **machine-checkable predicates**. Neither is prose, and that is
deliberate: a stop condition written loosely rots, and the rot is invisible
because the loop keeps running.

**Condition A — the bound.** `iterations_run >= max_iterations`, where
`max_iterations` was written into the register's first row before the first
change. Reaching it is a normal exit, not a failure.

**Condition B — the exit signal.** A predicate declared at the start, evaluated
against the register each cycle. Two usable shapes:

- `consecutive_reverts >= N` — the metric has stopped moving under this
  hypothesis class. Route to [`pivot-ladder.md`](pivot-ladder.md).
- `score >= target` — the run had a destination after all, and reached it.

**Why two and not one.** A bound alone burns the whole budget on a metric that
stopped moving at iteration three. An exit signal alone is an unbounded loop
wearing a condition: if the signal never fires — and a subtly wrong predicate
never fires — nothing stops it. Each guards a different failure direction, so
neither is the redundant one.

## What ends a run that is not an exit condition

Nothing. Specifically **not**: the number looking good enough, the change
starting to feel risky, or the register getting long. Those are judgements, and
a loop that stops on a judgement produces a result nobody can reproduce. If the
run should stop for a reason the predicates do not cover, that is a finding
about the predicates — record it and fix them for the next run.
