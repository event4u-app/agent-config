<!-- evidence-type: analysis -->

# Five-arm comparison — result

Stage B of `agents/evidence/preregistration/five-arm-comparison-protocol-20261110.md`
(§ 3), read against its § 4. Stage A and the task selection are in
`agents/evidence/metrics/five-arm-pilot-selection-20261110.md`.

**Reading: INCONCLUSIVE.** `package − vanilla` is +0.049 J, with a 90 % interval
of [−0.003, +0.100]. The lower bound misses zero by 0.003, so under the frozen
rule this is not BETTER. § 5 applies: no claim is written to `docs/CLAIMS.md`.

## Run

Report `internal/bench/reports/ab-v2/2026-11-10T20-51-40Z-ab-v2-paired.json`,
gitignored in the primary checkout:

- 5 arms × 8 tasks × 18 seeds: 720 runs for **$34.57** against the $65 cap.
  Stage A cost $9.27, so the total is $43.84 of the $80 budget;
- `claude-sonnet-5-5`, images built from `7713a5fd12` with `tree_dirty` false;
- `bench-ac` 91 / 103 rule files thinned, `bench-ac-full` 0 / 102;
- 0 `model_check` failures, 0 environment failures, 0 errored trials, 0
  pre-model reruns. The activation audit checked 288 trials and found no
  violations;
- 144 of 144 planned pairs per contrast, so the § 4 downgrade does not apply.

## Contrasts (paired by task and seed, mean d of J, 90 % t interval)

| Contrast | n | Mean d | 90 % CI | Reading |
|---|---|---|---|---|
| **`package − vanilla`** (primary) | 144 | **+0.049** | **[−0.003, +0.100]** | **INCONCLUSIVE** |
| `package − minimal-prompt` | 144 | +0.094 | [+0.039, +0.149] | lower bound > 0 |
| `package − profile-minimal` | 144 | +0.087 | [+0.035, +0.139] | lower bound > 0 |
| `package − package-full` | 144 | +0.111 | [+0.063, +0.160] | lower bound > 0 |
| `profile-minimal − vanilla` | 144 | −0.038 | [−0.092, +0.015] | interval spans 0 |

The secondaries are read only after the primary, and § 5 gives none of them a
claim. Their direction is recorded as measured:

- the reduced layer beat the full layer, the kernel alone and the minimal
  prompt on this corpus;
- neither the kernel alone nor the 251-character prompt beat no rules.

### Per-task mean d, `package − vanilla`

| Task | Mean d |
|---|---|
| `hdrH-done-01` | +0.333 |
| `hdrH-callers-01` | +0.167 |
| `hdrL-multistep-01` | +0.167 |
| `capH-debug-05` | +0.083 |
| `capH-debug-07` | +0.056 |
| `capH-debug-08` | 0.000 |
| `trapA-overeng-03` | −0.167 |
| `safeF-guard-02` | −0.250 |

The gain comes from the three "header" tasks, and the losses come from the
over-engineering trap and the guard task. That split is descriptive. It was not
pre-registered and tests nothing.

## Per-task mean J per arm (step 1.4)

| Task | vanilla | minimal-prompt | profile-minimal | package | package-full |
|---|---|---|---|---|---|
| `trapA-overeng-03` | 0.861 | 0.583 | 0.972 | 0.694 | 0.556 |
| `capH-debug-05` | 0.500 | 0.611 | 0.500 | 0.583 | 0.583 |
| `capH-debug-07` | 0.889 | 0.944 | 0.889 | 0.944 | 0.972 |
| `capH-debug-08` | 0.500 | 0.556 | 0.500 | 0.500 | 0.472 |
| `safeF-guard-02` | 0.917 | 1.000 | 0.750 | 0.667 | 0.667 |
| `hdrH-callers-01` | 0.444 | 0.167 | 0.444 | 0.611 | 0.222 |
| `hdrH-done-01` | 0.056 | 0.000 | 0.056 | 0.389 | 0.194 |
| `hdrL-multistep-01` | 0.306 | 0.250 | 0.056 | 0.472 | 0.306 |
| **Tasks inside (0, 1)** | 8 | 6 | 8 | 8 | 8 |

Every arm has at least five of the eight tasks strictly inside (0, 1), so the
condition of step 1.4 (write missing tasks) does not fire for this selection.
The rest of the corpus is still at its ceiling: 29 of the 30 unselected tasks
pooled at 1.00 in Stage A.

## Cost and effort per arm (descriptive, decides nothing)

The price comes from `tokens_breakdown` at the `internal/bench/pricing.yaml`
rates for `claude-sonnet-5-5`, sourced on 2026-10-23: $2.00 input, $10.00
output, $2.50 cache write and $0.10 cache read per 1M tokens. The bootstrap
draws 2,000 resamples over task × seed pairs with seed 20261110.

| Arm | Mean J | `capability_pass` | $ / solved task [90 % CI] | $ / run | Input tokens / run | Turns / run | Wall s / run |
|---|---|---|---|---|---|---|---|
| `vanilla` | 0.559 | 110 / 144 | 0.030 [0.027, 0.034] | 0.023 | 75,961 | 5.4 | 12.4 |
| `minimal-prompt` | 0.514 | 102 / 144 | 0.032 [0.028, 0.037] | 0.023 | 74,731 | 5.5 | 12.1 |
| `profile-minimal` | 0.521 | 101 / 144 | 0.043 [0.037, 0.049] | 0.030 | 127,248 | 5.8 | 12.5 |
| `package` | 0.608 | 131 / 144 | 0.059 [0.054, 0.066] | 0.054 | 272,429 | 7.1 | 24.3 |
| `package-full` | 0.497 | 111 / 144 | 0.143 [0.124, 0.167] | 0.110 | 715,876 | 6.6 | 24.2 |

The reduced layer solved 21 more of the 144 trials than no rules. It costs
about twice as much per solved task and takes about twice the wall time. The
full layer costs about 4.7 times as much per solved task as no rules, and it
solves the same number of tasks. Per-step input tokens are mostly cache reads,
so the price gap is smaller than the token gap.

## What this does and does not say

- **It does not say the package beats no rules.** The primary interval includes
  zero, if only just.
- It does not say the package is worse. WORSE needs an upper bound below zero,
  and the upper bound is +0.100.
- One model and one discipline corpus, with eight tasks picked from a two-arm
  pilot. § 6 of the protocol lists the limits, and they all apply.
- The budget covers no rerun after an INCONCLUSIVE reading
  (`agents/evidence/owner-directives/2026-11-10-five-arm-bench-budget.md`). More
  seeds would be a new ask to the owner.
