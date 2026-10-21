<!-- evidence-type: analysis -->

# No quorum: the truth-table round returned no answer, twice

AI council, 2026-10-21, `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
design mode, 2 rounds with peer review requested, CLI transport, `$0.00`. The
prompt is committed verbatim beside this file as
`gate-aggregation-truth-table-20261021.question.md`. The draft it asks about is
`agents/evidence/analysis/gate-aggregation-truth-table-20261021.md`.

## What happened

| Attempt | anthropic | openai | Quorum |
|---|---|---|---|
| 1 | `exit_1` after 210 s (the seat's CLI exited during its own session-end hooks) | `timeout` at 300 s | 0/2, INCONCLUSIVE |
| 2 | `timeout` (the pre-run probe already read the seat as unavailable) | `timeout` | 0/2, INCONCLUSIVE |

Both attempts used CLI quota and returned no text from either seat. **There is
no verdict here, in either direction.** This record exists so that the next run
does not mistake an empty response file for a concluded round, and so that the
draft's proposals for the two open cells are not read as accepted because no
one objected.

## Why it was not retried a third time

Two identical failures with zero answers mean the seats were not reachable at
that time. They say nothing about the question. A third attempt at the same
time would spend quota against the same outage. The drain run that made these
attempts was also stopped once by a spend limit, which fits an availability
problem on the provider side. A re-run is owed once the seats answer the
pre-run probe again. The same question file should be sent, unchanged.

## What stays open

- Both undecided cells of the D24 truth table, *snapshot below baseline* and
  *snapshot unavailable*. The draft proposes a value for each. A proposal is not
  a decision.
- Whether D24's items 3 (fixtures) and 4 (a report-only schema draft) may
  proceed. The draft asks this as Q5. Without an answer, the stricter D24
  reading stands, and no schema file lands.
