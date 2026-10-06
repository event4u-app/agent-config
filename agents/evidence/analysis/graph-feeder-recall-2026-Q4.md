<!-- evidence-type: analysis -->

# Graph feeder recall — 2026 Q4

**Status: `underpowered`. Labelled n = 16 of a required n = 50, and the positive
stratum is 0 of a required 25.** Recall is **undefined**, which is a different
statement from measuring zero, and the reason it is undefined is not that too
few rows accrued — enough did. It is that the rows carry no positives and that
one of the two arms was measuring nothing at all.

**Accrual, re-measured 2026-10-06: 84 rows across 5 distinct sessions** in
`agents/state/graph-feeder/`. The accrual bar the step set — n ≥ 50 across
distinct sessions — is **met for the first time**. Taking the reading is what
produced everything below, and none of it is what the bar was expecting.

The pre-registration (next two sections) is kept verbatim. It was written before
any data existed and is not edited now that data does: a design amended by the
party that has seen the counts is a design chosen by the counts. The result is
added after it, not merged into it.

## What is being measured

Two detectors answer the same question — *did this turn change production code
without the test that would have caught the failure?* — from different evidence:

| Arm | Evidence | Where |
|---|---|---|
| **F** | the transcript: production edits, no test file touched, a completion claim | `detectUntestedChange`, `src/scripts/hooks/turn_end_gate_hook.ts` |
| **graph** | the code graph: changed symbols with no accepted `tests` edge reaching them or their file | `untested`, `src/scripts/code_graph/verbs.ts` |

**Both arms read the same path set.** The feeder filters the turn's edit paths
through detector F's own `_isProductionSource` predicate before handing them to
the graph, so a difference between the two verdicts is a difference in EVIDENCE
and never in input. A completion review found the first implementation passing
every edit path to the graph while F filtered — which would have had the graph
arm firing on exactly the turns F is silent for, and a recall table comparing
two detectors answering different questions is worse than no table.

The feeder writes both verdicts for the same stop, so recall, the union, and
each arm's unique catches are all readable from one record:
`agents/state/graph-feeder/<session>.jsonl`, one row per stop, written only
where a graph exists.

## The labelling protocol

```
50 STOP RECORDS. 25 CARRYING AN UNTESTED PRODUCTION EDIT, 25 NOT.
LABELLED BY A PERSON OR A COUNCIL SEAT — NEVER BY THE HOOK'S OWN RUN,
AND NEVER BY THE MODEL WHOSE DETECTOR IS BEING SCORED.
```

Risk-Register rank 4 of the owning roadmap names the failure this forbids: a
corpus labelled by the model under test decides its own promotion. The label is
the ground truth, so its independence is the whole experiment; a row's own `f`
and `graph` fields are the predictions and may never be read while labelling.

Procedure, once n ≥ 50 rows exist:

1. Draw rows from `agents/state/graph-feeder/*.jsonl` across distinct sessions.
   A row's `paths` and `path_count` are the labeller's input; `f`, `f_mode`,
   `graph`, `graph_untested` and `graph_tested` are withheld.
   **A row whose `path_count` exceeds its `paths` length is DROPPED, not
   labelled**, and the count of drops is reported with the rest. `paths` is
   capped at five in tool-call order, so a longer turn can present a labeller
   with five paths that do not include the deciding one — and a ground truth
   decided on a hidden path is not a ground truth. A review raised this as a
   measurement-validity problem rather than a display one, and it is treated as
   one. (The paths are production-source only, per the filter above, so the
   truncation can no longer hide a production edit behind docs and tests; it can
   still hide the sixth production edit behind five others.)

   **Truncation is the only cause of that inequality, and it is kept that way
   on purpose.** An edit outside the workspace root is written as the literal
   `<outside-workspace>` rather than dropped — so the lengths stay equal and
   the exclusion rule above keeps meaning one thing. Dropping it would have
   been a second cause wearing the first one's signal, and would have thrown
   away a labellable in-repo path from a corpus blocked for want of rows. The
   marker is also what a labeller needs in order to answer `cannot tell`
   honestly instead of judging a turn whose out-of-tree half is invisible.
2. For each row, the labeller answers one question: **did this turn change
   production code that no test exercises?** Yes / no / cannot tell. A
   `cannot tell` is dropped and replaced, and the count of drops is reported —
   a corpus that needed many replacements is a corpus with a definition problem.
3. Record who labelled (a named person, or the council seats and the session
   date) alongside the counts. An unattributed label set does not satisfy this
   step.
4. Report, for F, for the graph, and for their union: recall =
   caught / 25 positives, with the 95 % Wilson interval from
   `wilsonInterval(caught, 25)` (`src/scripts/_lib/capture_rate.ts`). Report
   false positives against the 25 negatives on the same footing.

Wilson rather than the normal approximation for the reason that module records:
near a proportion of 1 the normal interval runs above 1 and understates the
spread, which is exactly where a detector's recall is expected to sit.

---

# The 2026-10-06 reading

## The draw

Pinned at the moment of the draw, because `agents/state/` is live and gitignored
and a later reader will see different numbers. Re-measure before reusing any of
these; this is a reading taken on a date, not a standing fact. Branch
`drain/graph-feeds-the-gate-20261006`, base `f3cc5db98`.

| | count |
|---|---|
| rows accrued | 84 |
| distinct sessions | 5 |
| dropped — `path_count` exceeded `paths` length (protocol step 1) | 3 |
| kept | 81 |
| kept rows with **no** production path — negative by construction | 65 |
| **rows carrying a production edit, and so labellable** | **16** |
| distinct production files across those 16 rows | 4 |
| rows from the single largest session | 14 of 16 |
| turns on which detector F fired, over all 84 rows | **0** |
| graph verdicts that were `untested` or `tested` | **0** |

The last two rows are the reading. Everything else is context for them.

## Arm 2 was not measuring anything — the whole window is void

**19 rows carried a production path. 18 of them reached the graph at all, and
all 18 recorded `no-seeds`.** The nineteenth never consulted the graph: its
`graph_state` was `behind:0`, which the feeder skips by design, so it recorded
`null`. Those are the only two values any path-carrying row has ever held.

That is not the graph having nothing to say about those files. It is the feeder
handing `untested` an **absolute** path while the graph keys its node ids on
**repo-relative** ones, so `seedsForFiles` resolved nothing on every call.

(An earlier version of this paragraph wrote "18 of 18 at draw time, 19 of 19
counting the rows later dropped as truncated". The second figure was wrong —
19 minus the 3 truncated drops is 16, not 18 — and the completion review of this
change caught it against the draw table thirteen lines above. The split is
18 consulted / 1 skipped, and the truncation drops are a separate axis that cuts
across both.)

Probed against the real index at `c58d7eae`, before the repair:

| file | path form | seeds | untested | unresolved |
|---|---|---|---|---|
| `src/scripts/check_memory.ts` | relative | 60 | 59 | 0 |
| `src/scripts/check_memory.ts` | absolute | 0 | 0 | 1 |
| `src/scripts/_lib/prompt_shape.ts` | relative | 7 | 5 | 0 |
| `src/scripts/_lib/prompt_shape.ts` | absolute | 0 | 0 | 1 |

It survived step 3.2's review because **every fixture in the suite fed a
relative path** — the one shape no host emits. Claude Code writes `file_path`
absolute. The arm looked healthy in the only case it was ever tested on.

Repaired in the same change as this reading (`toRepoRelative`, applied inside
`graphUntestedVerdict` and to the stored row), with regression tests written
against the absolute form and seen red first.

```
NO GRAPH-ARM ROW RECORDED BEFORE THAT REPAIR IS ADMISSIBLE EVIDENCE
ABOUT THE GRAPH. THE ARM'S ACCRUAL RESTARTS AT ZERO.
```

The F arm's rows are unaffected: F never read the graph, and its verdict is
taken from the transcript.

## Arm 1 — the labelled corpus, and why recall is undefined

The 16 labellable rows, labelled **2026-10-06 by the AI council** — seats
`anthropic` and `openai`, quorum 2/2, subscription transport, $0.0000 billed.
The seats were given `paths` and `path_count` and the grep evidence for how each
file is reached from the test tree. `f`, `f_mode`, `graph`, `graph_untested` and
`graph_tested` were withheld, and the prompt stated no expected outcome in
either direction.

**What left the machine, recorded because the record did not previously say.**
Every pre-repair row stored an ABSOLUTE host path — that is finding (i) above —
so "the seats were given `paths`" needed reconciling with it. The draw
relativised each path against the workspace root before the corpus was
assembled, so the strings the two external seats received were the
repo-relative forms shown in the table below (`src/scripts/check_memory.ts` and
the other three), and no home-rooted path was sent. The table renders exactly
those strings, abbreviated after first mention only where the directory repeats;
the abbreviation is presentational and the first occurrence of each of the four
files carries its full repo-relative form. A completion review raised this as
unrecoverable from the artefact, which it was.

The convergence is inlined below rather than cited by path, per
`no-roadmap-references`: a council response lives under `agents/runtime/`, which
is gitignored and auto-pruned, so a path to it is dead in every clone and would
rot silently — `check_council_references.ts` excludes `agents/evidence/analysis`
from its scan roots, so nothing would have failed the build over it. The labels
and both seats' reasoning are reproduced here because here is the only place
they survive.

| row | session | turn | production paths | label |
|---|---|---|---|---|
| R01 | `21f33898` | 7 | `src/scripts/_lib/prompt_shape.ts` | no |
| R02 | `21f33898` | 29 | `src/scripts/check_memory.ts` | no |
| R03 | `ffb1f1a5` | 2 | `src/scripts/check_release_pr_shape.ts` | no |
| R04 | `ffb1f1a5` | 3 | `src/scripts/check_release_pr_shape.ts`, `src/scripts/report_evidence_temperature.ts` | no |
| R05 | `ffb1f1a5` | 4 | both of the above | no |
| R06 | `ffb1f1a5` | 5 | both of the above | no |
| R07 | `ffb1f1a5` | 6 | `report_evidence_temperature.ts` | no |
| R08 | `ffb1f1a5` | 7 | both of the above | no |
| R09 | `ffb1f1a5` | 8 | `check_release_pr_shape.ts` | no |
| R10 | `ffb1f1a5` | 9 | `check_release_pr_shape.ts` | no |
| R11 | `ffb1f1a5` | 11 | `report_evidence_temperature.ts` | no |
| R12 | `ffb1f1a5` | 12 | both of the above | no |
| R13 | `ffb1f1a5` | 14 | `report_evidence_temperature.ts` | no |
| R14 | `ffb1f1a5` | 15 | `check_release_pr_shape.ts` | no |
| R15 | `ffb1f1a5` | 15 | `check_release_pr_shape.ts` | no |
| R16 | `ffb1f1a5` | 15 | `check_release_pr_shape.ts` | no |

**16 of 16 `no`. Zero `cannot tell`, so zero replacements. Both seats agreed on
every row.** Every one of the four files is reached by a test: three by a static
import, and `check_memory.ts` by a test that spawns it through `tsx` and asserts
on its stdout and exit code. Both seats were asked whether subprocess execution
counts as exercising, independently, and both said yes.

## Current reading

| Arm | Positives caught | positives in corpus | Recall | 95 % Wilson |
|---|---|---|---|---|
| F | — | **0** | **undefined** | [0, 1] |
| graph | — | **0**, and the arm was void | **undefined** | [0, 1] |
| union | — | **0** | **undefined** | [0, 1] |

`[0, 1]` is the honest interval for a measurement that did not happen, and it is
not `[0, 0]` — the same distinction `capture_rate.ts` makes in code. **Recall
with no positives in the ground truth is 0/0.** It is not a low score for the
detectors and must never be quoted as one.

**`underpowered`** — below n = 50 this page reports the bar and the gap, never a
rate. A recall quoted off a handful of rows would be read as a result and reused
as one.

That clause is the pre-registration's, restored here verbatim. **An earlier
version of this reading deleted it and published a false-positive rate with a
Wilson interval off 16 rows in the same change** — while the status line still
said `underpowered` and roadmap D7 still said the pre-registration had not been
amended. A completion review caught it. Dropping a constraint and then
exercising the freedom it withheld is precisely the move this page exists to
forbid, and "it was a specificity rate, not a recall rate" is a reading of the
clause arrived at **after** seeing the counts, which is the thing the clause
guards against. The rule says *never a rate*. So no rate is published.

What the corpus supports, as COUNTS, which is what the bar-and-the-gap means:

| Arm | fired | opportunities | labelled negatives it fired on |
|---|---|---|---|
| F | **0** | 84 accrued rows | **0 of 16** |
| graph | **0** usable verdicts | 19 path-carrying rows | — (the arm was void) |

No rate, no interval, no denominator arithmetic. The counts say what happened;
turning them into a proportion is the step the clause withholds until n ≥ 50.

What this does and does not bear on: it is **specificity** evidence, not recall
evidence. It is consistent in direction with ADR-277's already-discharged
false-positive half (0 in 335 turns) and adds 16 independently labelled
negatives to the pile. It settles nothing about recall, which is the half
ADR-277 left open and the half this page exists for. And the 16 are not 16
independent observations in any case — see the clustering below.

## Why the corpus has no positives, and why that is not a corpus you can fix by waiting

The four files are all well-tested infrastructure in this repository's own
`src/scripts/`. That is not bad luck in the draw — it is what this repository's
sessions *are*. The accrual channel is governance and maintenance work on a
suite whose own gates refuse untested production edits, so the base rate of the
positive class in this channel is at or near zero.

Three further properties of the draw, all raised independently by both council
seats and recorded because they bound any future reading taken here:

1. **The 16 rows are not 16 independent observations.** They cover 4 distinct
   files, and 14 of them come from one session. Treating them as independent
   would bias any interval computed from them.
2. **R14, R15 and R16 are identical in every recorded field** — same session,
   same turn 15, same file, same `path_count`. Whether they are three tool-call
   groups or one event recorded three times is not decidable from the row.
3. **A construct gap the pre-registration did not name.** The labelling evidence
   is *file-level reachability* — is this file imported or executed by some
   test. The question asks about *the changed code*. A test that imports a
   module but never calls the function the turn edited leaves the changed code
   unexercised while the file reads as covered. Both seats flagged this; one
   called it the strongest blind spot in the exercise. The `tests` edge the
   graph arm walks has exactly the same granularity, so this is a property of
   both arms and not of the labelling.

## What this page does NOT authorize

Nothing — unchanged, and now with a second reason. Step 3.4 of the owning
roadmap, promoting the graph verdict into detector F's live decision, stays
deferred behind an owner amendment to ADR-277. A filled-in table here would be
an input to that amendment and never a substitute for it; **this table is not
even that**, because an undefined recall is not an input to a promotion
decision. No reading on this page changes what the stop gate refuses.

Nor does anything here discharge ADR-277's `review_trigger`. That trigger asks
for F's catch rate *on labelled data*. A labelled corpus with no positives does
not supply a catch rate, so the trigger remains unfired and F's recall half
remains exactly as open as it was.

## What closes the gap

The gap is no longer "wait for rows". It is a positive stratum, and the
roadmap's `blocker: b1-labelled-positives-unreachable` carries the decision,
because the available moves are not all ones an agent may take.

- **Post-repair graph rows.** The arm restarts at zero today. Nothing can be
  said about graph recall until rows accrue through the repaired feeder.
- **Positives from a channel that produces them.** This repository's own
  sessions do not. A consumer repository under ordinary feature work does.
- **Not by amending the design here.** Lowering the positive stratum, or
  substituting a specificity reading for the recall one, after the counts are
  in is the failure the pre-registration was written to prevent. It is recorded
  as an option for the owner in the blocker, not taken.
