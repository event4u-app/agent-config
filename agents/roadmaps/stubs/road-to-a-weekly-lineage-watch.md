---
complexity: lightweight
review_by: 2027-01-24
---

# Stub: a weekly lineage watch on the maintainer's machine

> **Stub — not active work.** Created 2026-10-24 by `road-to-a-graph-that-follows-you`
> (step 10.2). It is a stub because its result needs elapsed time: whether a
> weekly watch produces signal or noise is only readable after it has run several
> times.

## Scope

Schedule `code-graph lineage watch` weekly as a local task (never CI — the key is
local and logs in a public repository are public). After four runs, read the share
of reports that led to at least one accepted verdict.

## Trigger

Step 10.2 of `road-to-a-graph-that-follows-you` merged, and at least one source in
the local ledger (`runtime/lineage/sources.jsonl` under the user-global home) was
switched on with `code-graph lineage watch enable <source-id>`.

## Kill criteria

- Four runs produce no accepted verdict — lower the cadence to monthly or turn the
  watch off for the sources that only produced noise.
