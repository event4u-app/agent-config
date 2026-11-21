<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-21 for step 1.1 of
     road-to-review-loops-that-converge, committed verbatim beside the record. -->

# Which convergence criterion should end a review loop?

A repository that ships rules, skills and hooks for AI coding agents runs two
kinds of review loop: council ratification (two model seats review a change,
round after round, until both agree it may merge) and completion review (a
fresh reviewer per round, until a round has no open high or critical finding).
Some loops ran long: 43 ratification subjects reached five or more rounds (the
longest 56 and 31), and 18 completion reviews did (the longest 25 and 21).

A shadow script will compute, per loop and after every round, one of three
verdicts: `converging`, `stalled` or `diverging`. It changes nothing on its
own; it is advisory. A later, separate decision may make a stop binding.

## The data

Two independent model readers classed every new finding of the ten longest
loops by origin; a third settled the rounds they disagreed on (95 of 226 rounds
identical before adjudication, 61.3 % class-count overlap):

- `fix-introduced` — about something the previous round's fix changed;
- `re-raised` — restates a point an earlier round raised and that was answered;
- `single-seat` — one seat only, medium or low severity;
- `scope-widened` (deterministic) — the round cites a repository path that is
  in neither round 1 nor the subject's diff;
- `other`.

Over the 71 rounds whose new findings exceeded the previous round's (353
findings): fix-introduced 38.0 %, scope-widened 22.7 %, re-raised 16.1 %,
single-seat 15.9 %, other 7.4 %. No class is above 40 %.

Per loop, each round as `new findings / new high-or-critical findings that are
not fix-introduced` (`-` = round not visible in the record):

```
act-references-ratification: r1=6 | 6/0 3/0 6/1 3/0 3/2 2/0 1/0 1/1 3/1 2/2 2/0 2/1 1/0 2/1 1/0 -
behavior-vocabulary-close: r1=0 | 12/1 15/0 13/0 6/0 8/0 8/0 7/0 5/0 7/0 10/0 9/0 8/1 6/0 5/1 5/0 8/0 7/0 6/0 4/0 2/0
compact-checkpoint-concern-20261108: r1=5 | 5/0 3/0 1/0 4/0 4/0 5/0 1/0 1/0 5/0 6/0 3/0 4/0 3/0 0/0 1/1 0/0 2/1 1/0 -
design-consistency-default-ratification: r1=4 | 3/0 2/0 1/0 1/0 1/0 1/0 1/0 2/0 2/0 4/1 3/0 3/1 3/1 2/0 1/0 1/0 2/0 2/0 -
fix-release-shape-allows-its-own-census: r1=4 | 4/0 3/0 4/0 4/0 5/0 3/0 2/0 3/0 4/0 5/0 2/0 3/0 2/0 3/0 5/0 4/0 5/0 6/1 5/0 5/0 5/0 3/0 5/0 8/0
gate-classification-ledger: r1=5 | 10/0 4/1 4/1 7/1 7/0 - 6/0 5/1 9/0 5/1 4/0 6/1 6/1
session-pins-phase-2-20261108: r1=7 | 6/0 5/0 8/0 6/0 7/0 4/0 4/0 3/0 2/0 4/0 4/0 5/0 5/0 4/0 2/0 4/0 7/0 7/0 6/0 3/0 3/0 7/0 3/0 4/0 4/0 5/0 3/0 5/0 3/0 6/0 3/0 4/0 6/0 4/0 3/0 5/0 3/0 3/0 4/0 1/0 3/0 5/0 8/0 3/0 7/0 5/0 3/0 2/0 3/0 3/0 6/0 4/0 3/2 3/0 -
session-start-contracts-ratification: r1=6 | 6/0 3/0 2/0 2/0 3/0 1/0 2/0 2/0 - 2/0 5/0 3/0 4/0 1/0 0/0 1/0 1/0 1/0 1/0 0/0 0/0 1/0 1/0 1/0 1/0 3/0 - - - -
verified-stale-lock-reclaim-ratification: r1=8 | 1/0 3/0 3/0 1/1 0/0 0/0 1/0 3/2 1/0 1/0 4/0 1/0 - 0/0 1/0 - -
web-launch-write-time-ratification: r1=6 | 5/1 5/0 - 6/0 6/0 3/0 6/2 7/0 4/1 1/1 2/2 2/2 -
```

Pooled across those loops, the mean number of new findings per round is 5.8 at
round 2, 3.0–4.7 through round 14, and 2.0–4.3 afterwards; it does not fall to
zero. New high-or-critical findings that are not fix-introduced average 0.0–0.6
per round, with no clean knee.

## The candidates

- (a) `converging` after K consecutive rounds without a new high or critical
  finding that is not fix-introduced;
- (b) `diverging` when the number of new findings is non-decreasing over three
  consecutive rounds;
- (c) the knee of the pooled yield curve as a fixed round number.

Because no origin crossed 40 %, no seat-novelty or fix-size criterion is
pre-registered for this decision.

## What to answer

1. Which criterion, or which combination, should the shadow script compute,
   and why? Define `stalled` precisely if your answer uses it.
2. The numeric parameter: K for (a), the window for (b), or the knee round
   for (c).
3. What the data above cannot tell you that would change your answer.

Constraint: the verdict must be computable from per-round counts, severities
and origin classes alone, and a loop whose rounds carry no severity must get an
explicit `insufficient-data` verdict rather than a guess.
