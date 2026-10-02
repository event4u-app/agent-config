<!-- evidence-type: analysis -->

# Graph feeder recall — 2026 Q4

**Status: `underpowered`. n = 0 of a required n = 50.**

This is the pre-registration of a measurement, written before its data exists,
and it is deliberately not the measurement. ADR-277 reopens detector F when its
catch rate is read off labelled data; `road-to-a-graph-that-feeds-the-gate` step
3.2 shipped the instrument that produces that data, and it shipped in the same
change as this page. There is therefore no stop record older than the recorder,
and every number below is a bar rather than a result.

Writing the bars first is the point. A recall threshold chosen after the counts
are in is a threshold chosen by the counts.

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

## Current reading

| Arm | Positives caught | n | Recall | 95 % Wilson |
|---|---|---|---|---|
| F | — | 0 | — | [0, 1] |
| graph | — | 0 | — | [0, 1] |
| union | — | 0 | — | [0, 1] |

`[0, 1]` at n = 0 is the honest interval and is not `[0, 0]`: nothing was
measured, which is a different statement from measuring zero. The same
distinction `capture_rate.ts` makes in code.

**`underpowered`** — below n = 50 this page reports the bar and the gap, never a
rate. A recall quoted off a handful of rows would be read as a result and reused
as one.

## What this page does NOT authorize

Nothing. Step 3.4 of the owning roadmap — promoting the graph verdict into
detector F's live decision — stays deferred, and it is deferred behind an owner
amendment to ADR-277 rather than behind this page. A filled-in table here is an
input to that amendment, never a substitute for it, and no reading of these
numbers changes what the stop gate refuses.

## What closes the gap

- Stop records accumulate wherever the gate runs in a repository with a built
  code graph. The instrument is on by default and writes nothing where no graph
  exists, so the corpus grows from ordinary use rather than from a campaign.
- At n ≥ 50 across distinct sessions, run the protocol above and replace the
  `Current reading` table, the status line, and this section with the result and
  the labeller attribution.
