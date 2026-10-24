<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (fifth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent would implement
     the result. -->

# How should a report-only validator surface a run in which it could not assess every producer?

You are advising on one design point of an internal CI governance roadmap.
Answer on the facts below. Where a fact is missing, say so and say what would
settle it. The agent asking you will implement whatever is chosen.

## The system

A new validator runs CI check scripts ("producers"). Each producer reports
per-aspect results over a pipe. The validator records three separate
dimensions:

- **collection outcome** per producer: exited, signalled, timed out, output
  limited, not started;
- **protocol outcome** per producer: complete, incomplete, invalid, absent;
- **validator health** per run: `healthy`; `degraded` when the validator
  itself could not assess one or more producers (an internal exception while
  handling it, or it stopped before starting some), with those producers marked
  `unassessed` or `not-attempted`; `failed` when it could not write or read back
  its summary, or could not read its registry.

The validator is in **report-only mode**. Existing CI checks keep their own exit
codes and stay the required gates. The validator runs as a separate,
non-required CI job. It has two exits:

- an **evaluation exit**, which is 0 in report-only mode by definition;
- an **operational exit**, non-zero when health is `failed`.

The open question is what the operational exit and the reported run status
should be when health is `degraded`.

## The two positions a previous review round took

- Position 1: a `degraded` run that exits 0 operationally is fail-open by
  default. Automation that reads the exit code will treat it as a successful
  run although some producers were never assessed.
- Position 2: in report-only mode an exit of 0 may be intentional, because the
  job is not an enforcement gate. What is missing is an explicit mode contract.
  In report-only mode the result must not be advertised as an enforcement
  signal. In any future enforcing mode, `failed`, `degraded`, `unassessed` and
  `not-attempted` must fail closed. Making the operational exit non-zero for
  `degraded` would collapse the separation between health and evaluation.

## Constraints

- No enforcing mode exists yet. Introducing one needs a separate approval.
- A standing finding from an earlier round: treating absent, unverifiable or
  malformed evidence as a pass is disqualifying regardless of rate.
- The operational exit is the only signal the CI job's status shows. The run
  status and per-producer details appear in a written summary.

## Questions

**Q1.** In report-only mode, should a `degraded` run make the operational exit
non-zero, leave it 0, or do something else? Give the reason.

**Q2.** Whatever the exit, may a `degraded` run's reported run status ever read
as a pass or as `complete`?

**Q3.** What, if anything, must the mode contract say so that this choice cannot
silently carry into an enforcing mode later?

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
