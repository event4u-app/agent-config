---
stability: beta
keep-beta-until: 2026-09-04
---

# Package-Impact A/B Benchmark — Contract

> Lifecycle, cache invalidation, and reader-side semantics for `docs/benchmark.md` and the underlying A/B bench reports. Companion to `docs/contracts/benchmark-report-schema.md` (which owns the per-report JSON shape this contract layers an axis onto).

## Scope

This contract covers the **variant axis** (`with` vs. `without` agent-config) that the package-impact A/B bench adds on top of the existing version-over-time bench. It does NOT redefine the underlying report schema — see `benchmark-report-schema.md` for the per-report JSON shape.

## Producer / consumer surface

| Concern | Owner |
|---|---|
| Materialising the variant clones | `scripts/bench_ab_clone.py` |
| Verifying the clones differ only at the agent-config surface | `scripts/bench_ab_integrity.py` |
| Track A (behavioural) runner | `scripts/bench_ab_tracka_run.py` |
| Track B (task) runner | `scripts/bench_ab_task_runner.py` |
| Track B scoring | `scripts/_lib/bench_ab_scoring.py` |
| Cache key + lookup | `scripts/_lib/bench_ab_cache.py` |
| Variant diff | `scripts/bench_ab_diff.py` |
| Rendered report | `scripts/render_benchmark_md.py` → `docs/benchmark.md` |
| Corpus / doc linter | `scripts/lint_bench_ab.py` |
| Task orchestration | `taskfiles/bench-ab.yml` (`task bench:ab*`) |

## When `docs/benchmark.md` regenerates

`docs/benchmark.md` is **derived**. It regenerates from the latest paired reports under `internal/bench/reports/ab/` whenever:

1. `task bench:ab` runs (the full pipeline ends with `bench:ab:diff` which calls the renderer).
2. `task bench:ab:diff` runs alone (no fresh bench, just re-render).
3. The renderer is invoked directly: `./scripts-run src/scripts/render_benchmark_md`.

The renderer is deterministic: same reports → same output. It never runs a bench. If no reports exist, it writes a placeholder document — never errors out.

## Cache key + invalidation

The Phase 2 cache exists so a daily `task bench:ab` does not re-run the expensive `without` arm when nothing the model would see has changed. The cache key is a tuple:

```
(corpus_hash, claude_cli_version, target_shape_hash)
```

A cached `without` report is **fresh** when its recorded `cache_key` matches the current key for every component. Otherwise it is **stale** and the `--reuse-cache` path either refreshes (default in interactive mode) or reuses with a stale flag (`--non-interactive`).

Invalidation triggers:

| Trigger | Component that drifts |
|---|---|
| Edit `internal/bench/corpora/ab-tracka.yaml` or `ab-trackb.yaml` | `corpus_hash` |
| Upgrade the local `claude` CLI | `claude_cli_version` |
| Add / remove a `WITH_SURFACE` in `scripts/bench_ab_clone.py` | `target_shape_hash` |
| Edit any file under `internal/bench/ab/fixture/` | `target_shape_hash` |

## How a reader interprets the staleness flag

`docs/benchmark.md` carries a methodology section naming the cache key for the latest run. A reader who suspects the page is stale should:

1. Check the **Last rendered** timestamp at the bottom of the Methodology section.
2. Inspect `internal/bench/reports/ab/` for newer reports than what the doc reflects.
3. Re-run `task bench:ab:diff` to re-render from the latest reports (cheap; no bench).
4. Re-run `task bench:ab` for a full refresh (re-runs the `with` arm, reuses the `without` baseline if the cache is fresh).

## Modes — what the reader can trust

Track B carries an explicit `mode` in every report header:

- `dry-run` — no `claude` CLI invocation; transcripts are stubs. Both variants score 0/N by construction. This is the CI-cheap mode; **do NOT cite Track B numbers in a dry-run report as evidence of package impact**.
- `live` — real `claude --print` invocation per task. The numbers are real; the cost is real. This is the mode that produces evidence.

The renderer surfaces `mode` prominently in the Track B section. A `dry-run` Track B block is a plumbing-health check, not a measurement.

## Track A is always cheap, always meaningful

Track A measures **surface availability** — does the rule/skill body the prompt would activate exist in the agent's reachable context? This is the precondition for the rule-router to fire. It does not need the `claude` CLI; it is a file-grep over the materialised clone. By construction:

- `without` MUST score 0% — no agent-config surface present → no expected_target file exists.
- `with` should score close to 100% — every expected_target file should exist with the expected_keywords.

The integrity check `bench_ab_tracka_run.py::integrity_check` fails the run if `without` ever scores non-zero. That's the safety boundary: if `without` scores anything, the variant axis leaked and the bench is invalid.

## Acceptance criteria for a "real" run

A bench run counts as a real measurement (rather than a plumbing health check) when:

- `./scripts-run src/scripts/bench_ab_integrity` exits 0 (the variant axis is clean).
- Track A runs in BOTH variants and produces `integrity_ok: true` (with scoring close to 100%, without scoring 0%).
- Track B runs in BOTH variants in `--mode live` (not dry-run).
- `./scripts-run src/scripts/lint_bench_ab` passes.
- The rendered `docs/benchmark.md` carries the Headline + Track A + Track B + Methodology + History sections.

## Out of scope for this contract

- The per-report JSON schema details — see `docs/contracts/benchmark-report-schema.md`.
- Statistical significance / sample-size policy — `--samples N` is opt-in per run; the bench default is n=1 (daily-quick-read goal, not a research-grade study).
- LLM-judge scoring — explicitly deferred to a follow-up roadmap.
- Cross-model comparison — out of scope; the bench measures one model (whatever the local `claude` CLI points to).

## See also

- the `road-to-package-impact-benchmark` roadmap (archived) — built this surface.
- `internal/bench/ab/README.md` — the Shape A vs. Shape B decision and the layout.
- `docs/contracts/benchmark-report-schema.md` — per-report JSON shape (sibling contract).
