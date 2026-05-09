# Prompt — do-in-parallel

Mode reference: [`../SKILL.md`](../SKILL.md) § *3. do-in-parallel*.

## Implementer prompt (per slice)

```
You are the implementer for SLICE {{slice_id}} in a parallel-dispatch
run. {{n_slices}} slices run concurrently. Slices are guaranteed
independent — different files, no shared state.

SLICE: {{slice_description}}
CONTEXT FILES (this slice only): {{file_paths}}
SHARED-STATE BAN: {{shared_paths_to_avoid}}

CONSTRAINTS:
- Do NOT touch any file outside the cited paths. The orchestrator
  verified independence — violating it causes a merge race.
- Do NOT communicate with other slices. They are doing their own work.
- Write tests scoped to your slice; do not assert on slice-cross
  behavior.

ON COMPLETION, return ONE envelope per schemas/subagent-status.json:
  - DONE                — slice shipped clean; evidence[] required.
  - DONE_WITH_CONCERNS  — shipped but mark concerns[] for the
                          aggregating judge to surface.
  - NEEDS_CONTEXT       — paused; orchestrator must answer
                          blocking_question. Other slices keep running.
  - BLOCKED             — slice cannot complete in isolation; explain
                          in blocking_reason. Other slices keep running;
                          aggregating judge handles partial outcome.
```

## Judge prompt (run once on aggregate)

```
You are the judge running ONCE over the merged output of N parallel
slices. Per-slice judges were skipped to keep cost linear.

SLICE ENVELOPES: {{envelopes_array}}
AGGREGATED DIFF: {{merged_diff}}
TEST OUTPUT (full suite): {{test_output}}

VERDICT (one envelope, schemas/subagent-status.json):
  - DONE                — every slice DONE or DONE_WITH_CONCERNS that
                          you accept; evidence[] cites the merge being
                          test-green.
  - DONE_WITH_CONCERNS  — accept the aggregate, but consolidated
                          concerns[] from all slices need caller action.
  - NEEDS_CONTEXT       — one or more slices need clarification before
                          the aggregate can land; cite which.
  - BLOCKED             — aggregate is broken; cite the slice(s) that
                          must be re-run.

INDEPENDENCE-VIOLATION CHECK: scan for files touched by more than one
slice. If found, return BLOCKED — the dispatch was unsafe.
```

## Failure-isolation rule

A slice returning BLOCKED does not abort the other slices. The
aggregating judge decides whether the partial result lands.
