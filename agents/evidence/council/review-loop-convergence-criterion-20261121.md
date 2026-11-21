<!-- evidence-type: analysis -->

# No fixed knee, criterion (a) at K = 3 with an explicit contract

**Date:** 2026-11-21 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** analysis, 2 rounds, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Question:** `review-loop-convergence-criterion-20261121.question.md` (committed verbatim beside this record)

Executes step 1.1 of `road-to-review-loops-that-converge`. The run was invoked
with `council_cli run <question> --prompt-mode analysis --effort medium`. The
first attempt skipped the anthropic seat on a stale `other` probe record from an
earlier run that day; the stale entry in the runtime-local probe store was
cleared, and the second attempt reached both seats (the store now records `ok`
for both).

## Seat positions

**anthropic (claude-sonnet-4-5).**

- Rejects (c): the pooled curve shows no clean knee, so a fixed round number is
  not supported.
- (a) is the only criterion the data weakly supports; K is a guess until a
  replay validates K in {2, 3, 4} against what a stop would have cost.
- Counts non-decreasing windows (ties included) as "working as designed" for an
  advisory signal, since a human reads it.
- Asks for an explicit precedence when signals overlap, a defined contract for
  severity-less loops and gaps, and proposed a separate `scope-drift` verdict
  and a re-raised threshold.
- Blind spot named: the sample is the ten longest loops, with no comparator of
  short loops.

**openai (codex-default).**

- Rejects a fixed knee for the same reason; per-round contributor counts fall to
  one loop after round 28.
- Replayed (a) with K = 3 over the printed series: it fires in eight of ten
  loops, and seven of those later record a new high/critical finding outside
  `fix-introduced` (`session-pins-phase-2-20261108` r54 after a 52-round quiet
  streak).
- (b) as worded fires on flat counts (`1, 1, 1`); ties should not read as
  divergence.
- Asks for an outcome replay at each first trigger (open and later severe
  findings, rounds saved), and a contract defining `insufficient-data`, gaps,
  `stalled` and precedence.
- Blind spot named: no outcome evidence of what an earlier stop would have left
  unresolved.

## Where the seats agree

1. No fixed round number (candidate (c) rejected).
2. Criterion (a) is the usable core; its cost must be measured by replay before
   any binding use.
3. The verdict contract must define `insufficient-data`, gaps, `stalled` and
   precedence explicitly.

## Where they differ

Whether a non-decreasing window with ties is `diverging` (anthropic: acceptable
for an advisory signal; openai: a false positive). The decision row takes the
stricter reading: ties are `stalled`, only a strict increase is `diverging`.

## What the decision adopts and rejects

Recorded as D5 in the roadmap. Rejected: anthropic's `scope-drift` verdict and
re-raised threshold — the pre-registered table in step 0.4 named no lever
(scope-widened 22.7 %, re-raised 16.1 %, both under 40 %), and adding one after
seeing the data would undo the pre-registration. The replay (step 1.3) reports
the late high/critical findings both seats asked for, which is the outcome
evidence they named as missing.
