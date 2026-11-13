<!-- evidence-type: analysis -->

# Five-arm confirmation — result

This reads the run pre-registered in
`agents/evidence/preregistration/five-arm-confirmation-protocol-20261112.md`
against that protocol's § 2. The run was funded by
`agents/evidence/owner-directives/2026-11-12-five-arm-confirmation-budget.md`.

**Reading: BETTER.** On this run's own 504 pairs, `package − vanilla` is
+0.039 J, with a 90 % interval of [+0.007, +0.071]. The lower bound is above
zero. Stage B is not pooled with this run.

## Run

The report is `internal/bench/reports/ab-v2/2026-11-13T05-54-06Z-ab-v2-paired.json`.
It is gitignored in the primary checkout. Its evidence bundle is under
`~/.event4u/agent-config/bench-evidence/2026-11-13T05-54-06Z-ab-v2-paired`.

- **Scale and spend:** 2 arms × 8 tasks × 63 seeds, which is 1,008 runs. They
  cost **$37.24** against the $42 cap.
- **Model:** `claude-sonnet-5-5`.
- **Images:** those of Stage B, as § 1 requires.
  - Built from `7713a5fd12`, with `tree_dirty` false.
  - `bench-base` is `sha256:b627d7b7e2cd…`, and every `vanilla` trial ran on it.
  - `bench-ac` is `sha256:90faf886c97c…`, with 91 of 103 rule files thinned,
    and every `package` trial ran on it.
- **Validity:**
  - 0 `model_check` failures, 0 environment failures and 0 pre-model reruns;
  - the activation audit found no violations;
  - 504 of the 504 planned pairs completed, so the downgrade does not apply.
- **Errored trials:** two `package` trials on `hdrH-done-01` (seeds 20 and 21)
  are marked errored with `timeout after 180s`. Both reached the model, so they
  are scored as the harness scores them. Their wall times are 915 s and
  15,301 s, so the runner did not stop them at its own timeout. That defect
  sits in the harness, not in the reading, and roadmap step 1.6 tracks it.

## Primary contrast

| Contrast | n | Mean d | 90 % CI | Reading |
|---|---|---|---|---|
| **`package − vanilla`** | 504 | **+0.039** | **[+0.007, +0.071]** | **BETTER** |

Stage B measured +0.049 on 144 pairs. The two estimates agree in direction and
roughly in size. Only this run's own interval decides.

### Per-task mean d (descriptive)

| Task | Mean d | vanilla J | package J |
|---|---|---|---|
| `hdrH-callers-01` | +0.349 | 0.365 | 0.714 |
| `hdrH-done-01` | +0.206 | 0.206 | 0.413 |
| `hdrL-multistep-01` | +0.198 | 0.175 | 0.373 |
| `capH-debug-07` | +0.071 | 0.849 | 0.921 |
| `capH-debug-05` | +0.032 | 0.500 | 0.532 |
| `capH-debug-08` | −0.032 | 0.524 | 0.492 |
| `safeF-guard-02` | −0.254 | 0.984 | 0.730 |
| `trapA-overeng-03` | −0.262 | 0.897 | 0.635 |

The split from Stage B reproduces.

- **Gains:** the package gains on the three "header" tasks, which are
  multi-step and caller-aware work.
- **Losses:** it loses about a quarter of a point on the over-engineering trap
  and on the guard task, again on fresh trials. That is a concrete lead on
  where the package costs discipline. It was not pre-registered, and it tests
  nothing.

## Cost and effort per arm (descriptive, decides nothing)

Pricing and method follow the 2026-11-10 protocol § 4, with bootstrap seed
20261112.

| Arm | Mean J | `capability_pass` | $ / solved task [90 % CI] | $ / run | Input tokens / run | Turns / run | Median wall s / run |
|---|---|---|---|---|---|---|---|
| `vanilla` | 0.562 | 373 / 504 | 0.031 [0.029, 0.033] | 0.023 | 77,833 | 5.5 | 10.5 |
| `package` | 0.601 | 448 / 504 | 0.057 [0.054, 0.061] | 0.051 | 274,094 | 7.0 | 27.8 |

The package solved 75 more of the 504 trials than no rules did. It cost 1.85
times as much per solved task, and its median wall time was about 2.6 times
longer. The median is reported instead of the mean: the two hung trials above
pull the `package` mean wall time to 61.6 s.

## What this licenses

- **One claim, per protocol § 3.** The claim is scoped to:
  - this discipline corpus;
  - these eight tasks;
  - `claude-sonnet-5-5`;
  - tree `7713a5fd12`.

  It is the `package-beats-no-rules-on-selected-tasks` entry in
  `docs/CLAIMS.md`.
- **It does not license:**
  - a claim about real tasks (roadmap Phase 3);
  - a claim about other models;
  - a claim about the current tree, which is 20.4.0 and later;
  - a claim about the 30 corpus tasks at their ceiling;
  - a claim that the package is cheaper. It is not: it costs about twice as
    much per solved task.
- **Statistical caveat.** The t interval treats pairs as independent, and the
  effects differ strongly between tasks. With eight tasks, the interval
  understates the uncertainty of any statement beyond these tasks.
