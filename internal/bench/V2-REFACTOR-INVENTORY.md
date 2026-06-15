# bench:ab v2 (discipline-axis) — refactor inventory

Phase 0 of `agents/roadmaps/road-to-discipline-axis-benchmark.md`. Council L2:
**refactor-in-place** — keep the harness skeleton, replace corpus + oracle +
metrics. This file pins exactly what moves so the scope is explicit before any
code changes.

## KEEP (architecture-correct — the isolation seam + plumbing)

| Piece | Why it stays |
|---|---|
| `src/scripts/bench_ab_clone.py` | Per-arm activation seam + pinned fixture clone (the clean "fixed host, ±package" A/B). v2 reuses verbatim. |
| `src/scripts/bench_ab_task_runner.py` (run harness) | Per-arm invocation (`--setting-sources` off / plugin / `+--append-system-prompt`), `--model` pin, `--max-budget-usd` cap, `modelUsage` token capture, error-aware (`errored`) handling, `--tasks`/`--limit` selectors, progress display. v2 extends it (4th placebo arm, seeds), does not rewrite it. |
| `src/scripts/_lib/bench_ab_cache.py` | Cache-key plumbing (corpus/cli/shape hash). Unchanged. |
| `src/scripts/bench_ab_cache_dispatch.py`, `bench_ab_run.py`, `bench_ab_tracka_run.py`, `bench_ab_diff.py`, `bench_ab_integrity.py` | Track-A surface check + dispatch wiring. Unchanged (Track A still validates package activation). |
| `taskfiles/bench-ab.yml` | Task surfaces. v2 adds entries; existing ones stay. |
| Reporting/render scaffolding (`render_benchmark_md.py` structure) | Two-table render extended in Phase 5; the report-loading + history plumbing stays. |

## REPLACE (built for the binary-capability frame)

| Piece | v2 change |
|---|---|
| `internal/bench/corpora/ab-trackb.yaml` | Replaced by the discipline-headroom corpus: 5 trap archetypes × 3 tasks (N=15 pilot), each with a capability oracle + discipline oracle(s) + the rule it targets (Phase 1). |
| `src/scripts/_lib/bench_ab_scoring.py` | Single binary pass/fail → **dual-axis** (`capability_pass` + `discipline_score`) + trajectory metrics (Phase 2). |
| `render_benchmark_md.py` tables | Single completion-rate table → **two tables** (capability axis + discipline-lift) with paired Δ, p-values, effect sizes, placebo column (Phase 5). |

## NEW (v2 additions)

| Piece | Phase |
|---|---|
| Discipline-headroom fixtures + oracles (5 archetypes) | 1 |
| Trajectory/`SampleStatus`-style metric extraction | 2 |
| Paired per-instance report schema (vanilla/package/package+RDP/placebo) | 2 |
| Multi-seed runner + equal-length placebo-prose arm | 3 |
| Paired statistics (McNemar / Wilcoxon, effect sizes) | 3 |
| Pilot-gate evaluation (falsification per L3/L4) | 4 |
| Honesty labels + `docs/contracts/benchmark-*.md` schema update | 6 |

## Out of scope (explicitly not touched)

- The RDP layer itself (rules/skills) — measured by, not part of, the benchmark.
- Track-A behavioural eval — orthogonal activation canary, unchanged.
