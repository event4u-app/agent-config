# Egress placeholders — engine latency on the CI runner class (PREREG endpoint f)

Pre-registration: `internal/bench/egress-placeholders-PREREG.md` § (f), committed
before any Phase 2–3 data. The bar, verbatim: *"p95 under 20 ms per
request-sized input (64 KiB) on the CI runner class. Null: above the bar, no hook
carrier may call the engine synchronously."*

The 2026-10-20 report (`egress-placeholders-engine-2026-10-20.md`) read (f) on
darwin-arm64 only. This one reads it where the bar names it.

- **Instrument:** the warn-only step `Egress engine latency (PREREG f, warn-only)`
  of `.github/workflows/bench-drift.yml`, added in `7f23bb3813`. It runs
  `internal/bench/egress-engine/run.ts`, whose latency figure is 200 iterations
  of `replaceValues` over a 64 KiB body with a fresh `TokenScope` each, and
  writes one line to the job summary.
- **Source of the rows:** every Bench Drift run from the step's first run to
  2026-10-24, read with `gh run view <id> --log` and the line
  `egress-engine latency:` extracted. One run (`39847299687`) predates the step
  and carries no reading; it is excluded, not counted as a pass.
- **Runner:** GitHub-hosted `ubuntu-latest`, linux-x64, 4 vCPU, Node v22.23.3.
  The CPU model varies between runs; it is recorded per row because it is the
  only variable the runner class leaves open.

## Readings

| Run | p50 ms | p95 ms | CPU |
|---|---|---|---|
| 39865518891 | 5.247 | 5.756 | Intel Xeon Platinum 8573C |
| 39866163340 | 6.747 | 7.408 | AMD EPYC 7763 |
| 39869140936 | 7.138 | 8.082 | Intel Xeon Platinum 8370C |
| 39873742317 | 3.610 | 4.152 | AMD EPYC 9V45 |
| 39878769273 | 6.896 | 9.241 | AMD EPYC 7763 |
| 39882230128 | 7.014 | 7.607 | Intel Xeon Platinum 8370C |
| 39885394539 | 6.747 | 7.659 | AMD EPYC 9V74 |
| 39906199124 | 4.185 | 5.233 | AMD EPYC 9V45 |
| 39912672463 | 6.999 | 8.591 | AMD EPYC 7763 |
| 39913166999 | 5.019 | 5.337 | AMD EPYC 9V74 |
| 39914720141 | 6.590 | 7.817 | Intel Xeon Platinum 8573C |
| 39916478895 | 5.379 | 5.798 | AMD EPYC 9V74 |
| 39917676668 | 6.837 | 8.782 | AMD EPYC 7763 |
| 39918986982 | 5.816 | 6.617 | Intel Xeon Platinum 8573C |
| 39922567462 | 4.260 | 6.087 | AMD EPYC 9V45 |
| 40065959738 | 3.966 | 4.407 | AMD EPYC 9V45 |
| 40066886464 | 6.133 | 7.044 | AMD EPYC 7763 |
| 40067677185 | 6.233 | 7.098 | AMD EPYC 7763 |

## Result

**(f) passes on the CI runner class.** 18 readings, p95 between 4.152 and
9.241 ms; the worst is under half the 20 ms bar. The slowest CPU model in the
pool (AMD EPYC 7763) sets the top of the range.

## What this does not show

- Every reading predates one-detector 2.5's wiring, which puts
  `detectNormalized` in front of `replaceValues`. Measured on darwin-arm64 with
  the same script, two runs each, the wiring did not slow the engine: p95
  10.05–10.35 ms on `origin/main`, 8.76–8.99 ms with the wiring. The Bench Drift
  run of the pull request that adds this report reads the wired engine on the CI
  runner class; its line lands in that run's job summary.
- The figure is the engine alone, apart from any gateway, as the bar states. It
  says nothing about the dispatch path that loads the engine chunk.
- 18 runs over two days are a sample of the runner pool, not its distribution.
  A slower CPU model entering the pool would show in the same step.
