# Telegraph Bench Report — `telegraph` · 2026-05-16T22:57:27Z

## Headline

- prompts: **10** · arms: **condensed, terse_control, uncondensed** · model: **claude-sonnet-4-5** · transport: **api**
- median savings vs raw: **23.51%** (p10 -18.29% · p90 52.53%)
- median savings vs terse-control: **-9.27%** (p10 -109.85% · p90 51.32%)
- median realised carve-out share (condensed arm): **30.67%** (expected median 42.50%)
- total cost: **$0.080535** (calls 30 · errors 0)
- verdict: **measured**

## Per-arm token totals

| arm | calls | input_tokens | output_tokens | median out/prompt |
|---|---:|---:|---:|---:|
| `condensed` | 10 | 3415 | 1378 | 150 |
| `terse_control` | 10 | 945 | 1225 | 98 |
| `uncondensed` | 10 | 685 | 1757 | 124 |

## Per-prompt results

| id | category | exp.carve | real.carve | out.condensed | out.terse | out.uncondensed | vs raw | vs terse |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `telegraph-01` | iron-law-fence | 45.00% | 44.59% | 58 | 71 | 105 | 44.76% | 18.31% |
| `telegraph-02` | numbered-options | 55.00% | 22.71% | 247 | 207 | 270 | 8.52% | -19.32% |
| `telegraph-03` | code-heavy | 78.00% | 79.43% | 157 | 141 | 322 | 51.24% | -11.35% |
| `telegraph-04` | path-list | 50.00% | 73.86% | 175 | 84 | 252 | 30.56% | -108.33% |
| `telegraph-05` | status-marker | 40.00% | 0.00% | 71 | 72 | 85 | 16.47% | 1.39% |
| `telegraph-06` | mode-marker | 25.00% | 38.62% | 152 | 68 | 91 | -67.03% | -123.53% |
| `telegraph-07` | deliverable | 62.00% | 69.48% | 149 | 139 | 132 | -12.88% | -7.19% |
| `telegraph-08` | pure-prose | 0.00% | 0.00% | 280 | 247 | 290 | 3.45% | -13.36% |
| `telegraph-09` | pure-prose | 0.00% | 0.00% | 47 | 95 | 93 | 49.46% | 50.53% |
| `telegraph-10` | pure-prose | 5.00% | 0.00% | 42 | 101 | 117 | 64.10% | 58.42% |

## Notes

- corpus: `bench/corpora/telegraph/prompts.yaml`
- pricing: `bench/pricing.yaml` (sourced 2026-05-14)
- schema: `telegraph-v1` (see `docs/contracts/benchmark-report-schema.md`)
- bench_run version: `0.2.0`
