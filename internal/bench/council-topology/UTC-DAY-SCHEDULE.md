# Council-topology benchmark — the UTC-day schedule

**Emitted 2026-08-31 (drain run 11) from the frozen manifest, not authored.**
Reproduce with `expandManifest()` -> `partitionIntoDays()` -> `summariseManifest()`
in `src/scripts/ai_council/topology_bench_manifest.ts`. That partitioner is greedy
and deterministic in cell order, so this table is a function of the committed spec
and regenerates byte-identically on any machine.

This artefact discharges ONE of the three conjuncts in
`road-to-inbox-harvest-2026-08-e-council-topology-evidence.md` blocker
`phase-2-benchmark-cost` — *"the spend is authorised with its UTC-day schedule
recorded"*. It does **not** claim the runner exists; it does not.

## Totals

| Figure | Value |
|---|---|
| cells | 384 |
| eligible cells | 352 |
| deferred (`not_eligible`) cells | 32 |
| cells reusing another arm's output | 48 |
| minimum calls | anthropic **814** · openai **770** · total **1584** |
| worst-case calls | anthropic **924** · openai **880** · total **1804** |
| per-provider daily cap | 50 |
| **UTC days** | **20** |

Days are booked at **worst-case** calls, never expected: the retry reserve has to
be held before a cell starts, or a bounded re-ask discovers the ceiling by crossing
it. A cell never spans a day boundary — a cell split across days acquires
day-as-confounder inside a single observation.

## The schedule

| UTC day | cells | anthropic booked | openai booked | anthropic headroom | openai headroom |
|---|---|---|---|---|---|
| 1 | 20 | 47 | 45 | 3 | 5 |
| 2 | 18 | 49 | 47 | 1 | 3 |
| 3 | 18 | 47 | 45 | 3 | 5 |
| 4 | 17 | 46 | 43 | 4 | 7 |
| 5 | 18 | 48 | 45 | 2 | 5 |
| 6 | 18 | 49 | 47 | 1 | 3 |
| 7 | 20 | 50 | 48 | 0 | 2 |
| 8 | 19 | 47 | 45 | 3 | 5 |
| 9 | 18 | 49 | 47 | 1 | 3 |
| 10 | 18 | 47 | 45 | 3 | 5 |
| 11 | 17 | 46 | 43 | 4 | 7 |
| 12 | 18 | 48 | 45 | 2 | 5 |
| 13 | 18 | 49 | 47 | 1 | 3 |
| 14 | 20 | 50 | 48 | 0 | 2 |
| 15 | 19 | 47 | 45 | 3 | 5 |
| 16 | 18 | 49 | 47 | 1 | 3 |
| 17 | 18 | 47 | 45 | 3 | 5 |
| 18 | 17 | 46 | 43 | 4 | 7 |
| 19 | 18 | 48 | 45 | 2 | 5 |
| 20 | 37 | 15 | 15 | 35 | 35 |

**Booked total: anthropic 924 · openai 880 across 20 UTC days.**
Both figures equal the worst-case column above (924 / 880), which is the check that the partition loses no cell.

## What this schedule costs beyond the calls

**Both providers are monopolised for 20 consecutive UTC days.** Mean daily booking
is 46.2 anthropic and 44.0 openai against a cap of 50, so the residual headroom is
roughly 3 to 5 calls per provider per day — not enough for a two-seat council round
at two rounds, which is what this repository's recorded decisions are taken with.
For the duration, **no other council work can proceed**, and that is a property of
the schedule rather than a risk it carries.

This is stated here because it is the half of the cost that the call total does not
show, and because the roadmap that owns this benchmark also requires every
contested decision to be settled by the council. Those two obligations cannot both
be met during the 20 days. The tension is recorded, not resolved: resolving it is a
scheduling decision for whoever starts the run.

## What this artefact does NOT establish

- **The runner does not exist.** `topology_bench_manifest.ts` `main()` only
  `--emit`s JSON and contains no provider dispatch. A schedule for a runner that
  has not been written is a plan, not a pending execution.
- **All 352 eligible cells read `pending`.** `PHASE2_COMPLETE_STATUSES` admits only
  `success`, `declared_gap` and an observed null; `pending` is excluded at the type
  layer and at module load. Not-run is not a null, and this schedule does not make
  it one.
- **At N=2 trials per item the benchmark licenses no promotion claim.** Step 2.6's
  pre-registered floors are n >= 5 and n >= 10; `TRIALS_PER_ITEM` is 2, which clears
  neither. The manifested Phase 2 produces descriptive comparison only. That is 2.6
  read honestly, and this schedule does not change it.
