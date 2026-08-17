---
model_tier: inherit
name: experiment-loop
description: "Use to drive a scalar metric down or up across bounded iterations — keep on strict improvement, revert otherwise, state on disk. Triggers 'minimize X', 'optimize until it stops improving'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# experiment-loop

> A bounded **change → commit → evaluate → keep-or-revert** cycle against a
> **scalar metric**, where the decision input is an
> [evaluator-output](../../../docs/contracts/evaluator-output.md) verdict and the
> loop's entire state lives in an append-only register on disk.

This file **routes**. The protocol, the register format, and the pivot ladder are
reference files loaded on demand — a loop doctrine read in full on every session
that merely mentions optimization is a payload nobody asked for.

| Need | Load |
|---|---|
| The iteration protocol and its two exit conditions | [`references/protocol.md`](references/protocol.md) |
| The register's row shape and write ordering | [`references/register-format.md`](references/register-format.md) |
| What to do when the metric stops moving | [`references/pivot-ladder.md`](references/pivot-ladder.md) |

## When to use

* The goal is expressible as **"minimize X"** or **"maximize X"** against a
  mechanical verifier — bundle size, violation count, query count, runtime.
* A verifier already emits, or can be wrapped to emit, the evaluator-output
  contract. Wrapping is usually free: three of this repo's verifiers were wrapped
  with zero changes to any of them.

Do **NOT** use when:

* The target is a **known end state**, not a number — "make the tests pass" has a
  destination, so use [`verify-repair-loop`](../verify-repair-loop/SKILL.md),
  which converges toward it. This skill has no destination; it has a direction.
* The verdict is **subjective craft** — no scalar, nothing to optimize.
* The metric is a **proxy nobody agreed on**. Optimizing an unowned proxy is how
  a loop makes a system worse while its number improves.

## The Iron Law

```
THE METRIC IS NEVER SOVEREIGN. `pass` IS.
KEEP ONLY ON `pass && score > baseline`. A CHANGE THAT IMPROVES THE NUMBER
AND BREAKS BEHAVIOUR IS REVERTED — MEASURED, NOT ASSUMED.
COMMIT BEFORE YOU EVALUATE, SO EVERY REVERT IS A GIT OPERATION.
THE REGISTER IS WRITTEN BEFORE THE ACTION IT RECORDS, NEVER AFTER.
STATE LIVES ON DISK AND IS RE-READ EACH CYCLE — NEVER IN THE CONVERSATION.
```

Each line is a measured failure, not a preference. Spike s01 ran a change that
improved its metric by 67 % and broke the behaviour it measured; only `pass`
reverted it. The same run crashed between its commit and its register append,
twice, leaving the branch one iteration ahead of its own record.

## Procedure

1. **Inspect the verifier before trusting it.** Run the evaluator once on the
   unchanged tree and check its verdict: `pass` must be true and `metric_state`
   must be `present`. A baseline taken from an evaluator that is already red, or
   whose metric is unreadable, is not a baseline — every later comparison
   inherits the defect silently.
2. **Fix the metric and the verifier** before the first change. Name the
   evaluator, its direction, and the baseline score.
3. **Declare the bound** — a maximum iteration count, written into the register's
   first row. An unbounded loop is not this skill.
4. **Iterate** per [`references/protocol.md`](references/protocol.md): one focused
   change, commit, evaluate, keep or revert, append the outcome.
5. **Exit** on either condition (both machine-checkable, never prose): the bound
   is reached, or the explicit exit signal fires.
6. **Report** from the register, not from memory. If the register cannot
   reconstruct the run without the transcript, the run is not reportable.

## Validation

* The register reconstructs the run with the transcript discarded — every kept
  change traceable to a row, every row to a commit.
* Both branches ran at least once. **A loop whose revert branch never executed
  is a one-branch loop with a comment**; spike s01 found its revert broken on
  first use after four green iterations.
* The final tree passes the evaluator with `pass: true`.

## Output format

1. **The register path**, and the iteration count actually run against the bound.
2. **A metric line**: baseline → final, and the number of keeps versus reverts.
3. **The exit condition that fired**, named — bound reached, or exit signal.
4. **Every reverted iteration listed** with its reason. A revert is a result the
   next run needs, not noise to summarise away.

## Gotcha

* **A metric that improves while the system degrades.** The reason `pass` is
  sovereign. Never widen a verifier to make an iteration keep.
* **A revert path that has never run.** Exercise it deliberately once.
* **A register appended after the mutation.** A crash in between leaves the
  branch ahead of the record; write the row first, then update its outcome.
* **Loop state in the conversation.** It decays silently and the loop keeps
  comparing against a baseline it no longer holds.
* **Iterating past the bound because the number is still moving.** The bound is
  the contract; extending it is a new run with a new baseline.

## Do NOT

* Do NOT keep a change on `score` alone.
* Do NOT edit the verifier to move the metric.
* Do NOT batch several changes into one iteration — a keep you cannot attribute
  is a keep you cannot revert.
* Do NOT delete a register row. Rows are append-only, including the embarrassing
  ones.
