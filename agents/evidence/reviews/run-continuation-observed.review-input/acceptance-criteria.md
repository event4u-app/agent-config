## Acceptance criteria

- [x] `run-continuation.jsonl` holds at least one `engage` event from a
      worktree-started run, with the run id recorded here.
      Run id `12653f90d7cb4243821392afd5d8c4db`, recorded in step 0.0.
- [x] The AUTONOMY AXIS in `interruption_report` reports a non-zero
      median re-engagement count for at least one run.
      **Closed on the per-run reading, and the criterion's own wording is
      inconsistent — stated rather than quietly reinterpreted.** A median
      is taken *across* runs, so "median … for at least one run" cannot
      be satisfied as literally written by any number of runs. The
      per-run breakdown is what the qualifier points at, and it reports
      `12653f90d7cb4243  … re=1` — non-zero for exactly one run, as
      asked. The aggregate `median re-engagements:` stays **0**, and will
      until a majority of the window's runs engage (13 of 24 today); that
      is a property of the statistic, not a gap in the evidence. Anyone
      reading the criterion the aggregate way should reopen this box
      rather than treat the two readings as settled.
