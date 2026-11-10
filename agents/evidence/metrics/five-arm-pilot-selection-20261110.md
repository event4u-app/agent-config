<!-- evidence-type: analysis -->

# Five-arm comparison — Stage A selection

Stage A of `agents/evidence/preregistration/five-arm-comparison-protocol-20261110.md`
(§ 2), run on `main@7713a5fd12`, the merge that carries the protocol.

## Run

Report `internal/bench/reports/ab-v2/2026-11-10T17-24-52Z-ab-v2-paired.json`,
gitignored in the primary checkout:

- arms `vanilla` and `package`, 38 tasks, 2 seeds: 152 runs, **$9.27** against
  the $15 cap;
- `claude-sonnet-5-5`, `tree_dirty` false;
- `bench-ac` 91 / 103 rule files thinned, `bench-ac-full` 0 / 102;
- no environment failure and no `model_check` failure. Two trials errored after
  reaching the model, and § 3 scores them as the harness does.

## Selection

Pooled mean J over each task's four trials, read for this rule only. The
contrast between the two arms was not computed.

| Task | Pooled J |
|---|---|
| `capH-debug-08` | 0.50 |
| `hdrL-multistep-01` | 0.50 |
| `capH-debug-07` | 0.625 |
| `capH-debug-05` | 0.25 |
| `hdrH-callers-01` | 0.75 |
| `hdrH-done-01` | 0.25 |
| `safeF-guard-02` | 0.75 |
| `trapA-overeng-03` | 0.75 |

The band [0.10, 0.90] holds 8 tasks, ordered above by distance from 0.5 with
ties broken by task id. No fill-up was needed. Of the other 30 tasks, 29 pooled
at 1.00 and one at 0.00. The corpus is mostly at its ceiling on Sonnet 5.5, so
step 1.4 stays open: 8 tasks sit inside (0, 1) on the pooled reading, and
whether at least five do on each arm is read in Stage B.

## Stage B parameters, derived from § 3

k = 8, seeds = min(18, floor(780 / 40)) = **18**: 720 runs, capped at $65.
