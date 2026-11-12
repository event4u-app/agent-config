<!-- evidence-type: analysis -->

# Five-arm confirmation — protocol

**Status:** frozen before any trial. Funded by
`agents/evidence/owner-directives/2026-11-12-five-arm-confirmation-budget.md`.

## Why

The primary contrast of
`agents/evidence/preregistration/five-arm-comparison-protocol-20261110.md` read
INCONCLUSIVE. Its numbers were 144 pairs, a mean d of +0.049 and a 90 % CI of
[−0.003, +0.100]. This run re-measures that one contrast with enough pairs to
resolve an effect of that size.

## 1. Instrument, frozen

- **Harness and model.** The harness, CLI and model are those of the
  2026-11-10 protocol § 1: `claude-sonnet-5-5`, `--budget 1` and
  `--pre-model-reruns 2`.
- **Images.** The run uses the images that Stage B ran on, so it re-measures
  the same tree:
  - built from `7713a5fd12`;
  - `bench-base` `sha256:b627d7b7e2cd…`;
  - `bench-ac` `sha256:90faf886c97c…`, with 91 of 103 rule files thinned.

  The report's `images` block must match all of these. If the images were
  rebuilt from another tree, the run is void.
- **Arms.** `vanilla` and `package` only.
- **Tasks.** The eight tasks Stage A selected. The list is in
  `agents/evidence/metrics/five-arm-pilot-selection-20261110.md`.
- **Seeds.** 63, so the run has 1,008 trials and 504 pairs. The runner numbers
  seeds from 0. Seeds 0–17 repeat Stage B's labels, but they are fresh trials,
  and no earlier trial is pooled with them.

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms vanilla,package \
  --tasks capH-debug-08,hdrL-multistep-01,capH-debug-07,capH-debug-05,hdrH-callers-01,hdrH-done-01,safeF-guard-02,trapA-overeng-03 \
  --seeds 63 --model claude-sonnet-5-5 --budget 1 --max-usd 42 --pre-model-reruns 2
```

**Cap.** $42. A stopped run is not resumed past its cap. A run stopped by the
cap is scored on the pairs it completed, and the downgrade below applies.

**Validity.** Any of these voids the run:

- `tree_dirty` is not false;
- a trial ran on an image other than its arm's;
- a counted trial fails `model_check.ok`;
- the report names a model other than `claude-sonnet-5-5`.

A run that never reaches the model is an environment failure. It is not scored.

## 2. Decision rule

**Contrast: `package` minus `vanilla`.** Pairs are matched by task and seed.
The statistic is the mean d of J, where J is `discipline_score` if
`capability_pass` holds and 0 otherwise. The interval is a two-sided 90 % t
interval, computed from **this run's pairs only**.

| Reading | Rule |
|---|---|
| BETTER | lower bound > 0 |
| WORSE | upper bound < 0 |
| INCONCLUSIVE | otherwise |

**Downgrade.** If fewer than 80 % of the 504 planned pairs complete, a BETTER
or WORSE reading becomes INCONCLUSIVE.

**Never pooled.** Stage A, Stage B and this run are separate measurements. The
decision to confirm was taken after seeing Stage B's near-miss. Pooling the two
would make the interval depend on that look, so only this run's own interval
decides.

**Power, stated before data.** Stage B gives a per-pair standard deviation of
d of about 0.375. With 504 pairs, a true effect of +0.049 gives a lower bound
above 0 with probability of about 0.90. At a true effect of +0.03 that
probability falls to about 0.55.

**Also reported, deciding nothing:**

- the per-task mean d;
- per arm, the cost per solved task, priced as in the 2026-11-10 protocol § 4
  with bootstrap seed 20261112;
- per arm, the input tokens, turns and wall time per run.

## 3. What a reading leads to

- **BETTER:** `docs/CLAIMS.md` may carry one claim, scoped to this corpus,
  `claude-sonnet-5-5` and tree `7713a5fd12`: the package beats no rules by the
  measured margin. The claim states the interval and the eight-task scope.
- **WORSE or INCONCLUSIVE:** the result is published as it stands, and no claim
  is written. The owner's budget covers no further rerun.

## 4. What this cannot show

- **Eight tasks.** The t interval treats pairs as independent. Effects differ
  strongly between the tasks: in Stage B the per-task means ranged from −0.25
  to +0.33. A reading generalises to these eight tasks, not to the corpus.
- **One model and one discipline corpus.** The limits of the 2026-11-10
  protocol § 6 apply.
- **The images predate `main`.** They predate the 20.3 and 20.4 releases, so
  the run measures the tree at `7713a5fd12`, not the current one.
