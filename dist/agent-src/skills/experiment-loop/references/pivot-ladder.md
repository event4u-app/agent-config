# experiment-loop — the pivot ladder

Loaded on demand by [`experiment-loop`](../SKILL.md), when the exit signal
`consecutive_reverts >= N` fires. The metric has stopped moving. The question is
whether that is a fact about the system or about the hypotheses being tried.

Climb one rung at a time. Each rung is a **new run** with a fresh register and a
re-declared baseline — never a quiet continuation of the old one, because a run
whose hypothesis class changed mid-flight cannot be read afterwards.

## Rung 1 — a different hypothesis class, same metric

The reverts share a shape: every attempt tried to shave the same structure. Pick
a class the run has not touched — a different module, a different layer, a
different kind of change — and rerun with the current score as the baseline.

Stop climbing here if the first iteration of the new class keeps.

## Rung 2 — check the metric measures what you meant

Before concluding the system is optimal, confirm the number is the number. The
measured failure mode: a diff-volume metric that looked like shipping volume was
counting the repository's own review bookkeeping — a committed copy of the diff
being measured — so the ranking it produced was of the wrong thing entirely.
Excluding the bookkeeping moved the p90 by more than half and reordered the top
five.

Ask: does the metric include artefacts the change did not author? Generated
files, snapshots, vendored trees, its own output? Correcting that is a
**measurement fix** and legitimate.

## Rung 3 — decide whether tuning is the honest move

Rung 2's correction has a twin that is not legitimate: adjusting the metric until
the answer is pleasant. The discriminator is stated once, plainly:

> **Removing an input that was never part of the quantity is a correction.
> Moving a threshold or growing an exclusion set until the result improves is
> tuning.** A correction can be justified without reference to its effect on the
> outcome. Tuning cannot.

If the only available move needs the outcome to justify it, stop. The run's
answer is that the metric does not move under changes of this kind, and that is
a real result worth recording.

## Rung 4 — publish the null

No rung produced a keep. Write the run up: the metric, the bound, the hypothesis
classes tried, the register path, and the conclusion that the metric did not
move. A published null is why the next person does not re-run this.

**Do not climb back down.** Re-running rung 1 with slightly different wording is
the shape that turns a bounded loop into an unbounded one, and it burns budget
producing rows that all say the same thing.
