## Acceptance criteria

- [x] `run-continuation.jsonl` holds at least one `engage` event from a
      worktree-started run, with the run id recorded here.
      Run id `12653f90d7cb4243821392afd5d8c4db`, recorded in step 0.0.
- [~] The AUTONOMY AXIS in `interruption_report` reports a non-zero
      median re-engagement count for at least one run.
      **Satisfied on the per-run reading, unsatisfiable on the aggregate
      one, and therefore DEFERRED rather than closed.** A median is taken
      *across* runs, so "median … for at least one run" cannot be
      satisfied as literally written by any number of runs. The per-run
      breakdown is what the qualifier points at, and it reports
      `12653f90d7cb4243  … re=1` — non-zero for exactly one run, as
      asked. The aggregate `median re-engagements:` stays **0**, and will
      until a majority of the window's runs engage (13 of 24 today); that
      is a property of the statistic, not a gap in the evidence.

      **Reopened 2026-08-19 on R2 finding 5, and the glyph is the whole
      point.** The previous revision ended "anyone reading the criterion
      the aggregate way should reopen this box" — and then marked the box
      `[x]`, which is the one glyph that makes that instruction
      unreachable. `[x]` counts as done, so once step 0.1 closes the
      archival sweep would have seen `count_open == 0` **and**
      `count_deferred == 0` and archived this roadmap over a criterion the
      roadmap itself flags as unresolved: the silent-archive-of-open-work
      case Iron Law 3 of `roadmap-progress-sync` exists to catch, routed
      around by glyph choice rather than by argument. `[~]` routes it
      through the deferred-resolution gate instead, where the two readings
      are decided by someone rather than left "settled" by a checkbox.

      **What closes it:** either a window in which a majority of runs
      engage, so the aggregate median is non-zero on the criterion's
      literal wording — or a deliberate re-wording of the criterion to the
      per-run reading, which is a decision about what was being measured
      and not a re-measurement.
