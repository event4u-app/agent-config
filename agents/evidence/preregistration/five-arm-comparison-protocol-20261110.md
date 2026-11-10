<!-- evidence-type: analysis -->

# Pre-registration: five arms on one task set, Sonnet 5.5

**Written:** 2026-11-10, before any run of this comparison, and merged to `main`
before the first pilot trial. The runs read this file and change nothing in it.
A deviation is recorded in the result beside the frozen value it departs from.

**Why.** Every source of round `inbox-2026-11-wo` asks the same question: does
the package beat no rules and a minimal prompt, and at what price per solved
task? The owner released the budget for it
(`agents/evidence/owner-directives/2026-11-10-five-arm-bench-budget.md`).

**What it is not.** It is not a real-project benchmark. It uses this repo's
discipline corpus (`internal/bench/corpora/ab-trackb-v2.yaml`) on one model,
and it answers the question for that corpus only.

## 1. Instrument, frozen

- Harness: ab-v2 container, CLI `2.1.316`, `--budget 1`, default runner timeout,
  `--pre-model-reruns 2`.
- Model: `claude-sonnet-5-5`.
- Tree: the `main` commit that carries this file. Images are built from it with
  `bench_ab_images --with-full-layer`.

| Arm | What the model gets |
|---|---|
| `vanilla` | no package rules (`setting_sources: project,local`) |
| `minimal-prompt` | no package rules plus the runner's one-paragraph minimal prompt |
| `profile-minimal` | no package rules plus the router kernel only |
| `package` | the default install: the adapted reduced layer |
| `package-full` | the same tarball installed with `init --full` |

**Validity, per stage.** Any failure voids that stage.

- `ac.thinned > 0` and `ac_full.thinned == 0`.
- `tree_dirty == false`.
- Every trial ran on its arm's image.
- `model_check.ok` on every counted trial.
- The report names `claude-sonnet-5-5`.

## 2. Stage A — pilot, selects the tasks

**Pool:** every task in the corpus except `memA-recall-01`, `memB-supersede-01`
and `memC-stale-01`, which need a seeded memory store. That leaves 38 tasks.

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms vanilla,package --tasks <the 38> --seeds 2 \
  --model claude-sonnet-5-5 --budget 1 --max-usd 15 --pre-model-reruns 2
```

**Selection rule.** For each task, the pooled mean J over its four pilot trials,
`J = discipline_score` if `capability_pass` else 0. A task is selected when that
mean lies in **[0.10, 0.90]**.

- More than 12 qualify: keep the 12 closest to 0.5. Ties break by task id,
  ascending.
- Fewer than 6 qualify: add tasks in order of closeness to 0.5 until there are 6.
- The pilot is read for selection only. No pilot trial enters Stage B.

## 3. Stage B — the comparison

`k` = the number of selected tasks. Seeds = `min(18, floor(780 / (5k)))`. The
runner numbers seeds from 0, so seeds 0 and 1 repeat the pilot's for two arms;
those are fresh trials, and no pilot trial is pooled with them.

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms vanilla,minimal-prompt,profile-minimal,package,package-full \
  --tasks <the k> --seeds <S> --model claude-sonnet-5-5 --budget 1 \
  --max-usd 65 --pre-model-reruns 2
```

**Cap.** $15 for Stage A plus $65 for Stage B, $80 in total. A stopped stage is
not resumed past its cap.

**Pre-model aborts.** As in
`agents/evidence/preregistration/adapted-layer-confirmation-protocol-20261110.md`
§ 3: rerun up to 2 times. A run that never reaches the model is an environment
failure and is not scored. Since #2965 a stream-mode timeout keeps its stream,
so the harness applies this itself.

## 4. Decision rule

**Primary contrast: `package` minus `vanilla`.** Paired by task and seed, mean
d of J with a two-sided 90 % t interval.

| Reading | Rule |
|---|---|
| BETTER | lower bound > 0 |
| WORSE | upper bound < 0 |
| INCONCLUSIVE | otherwise |

**Downgrade.** Fewer than 80 % of the planned primary pairs complete after § 3
turns BETTER or WORSE into INCONCLUSIVE.

**Secondary contrasts, same statistic, read only after the primary:**

- `package − minimal-prompt`
- `package − profile-minimal`
- `package − package-full`
- `profile-minimal − vanilla`

**Cost per solved task.** For each arm, the summed price of its counted trials
divided by its count of `capability_pass`. Price comes from `tokens_breakdown`
at the rates `internal/bench/pricing.yaml` gives for `claude-sonnet-5-5` on the
run date. It is reported with a bootstrap 90 % interval (2,000 resamples over
task × seed pairs, seed 20261110). This is descriptive and decides nothing.

**Also reported:** input tokens per run, turns per run and wall time per run,
each per arm.

## 5. What a reading leads to

- **BETTER:** `docs/CLAIMS.md` may carry one claim, scoped to this corpus, this
  model and this tree: the package beats no rules by the measured margin.
- **WORSE or INCONCLUSIVE:** the result is published as it stands. No claim is
  written, and `later/road-to-a-start-as-light-as-the-field` 1.7 records the
  reading.

## 6. What this cannot show

- One model and one corpus built to test discipline, not delivery.
- Tasks are selected on pooled difficulty from a two-arm pilot. The rule never
  reads the difference between the two arms, but the pilot ran only two of the
  five, so a task where only the kernel or the minimal prompt would struggle
  can be missed.
- `profile-minimal` and `minimal-prompt` put their text in the system prompt,
  not in rule files.
