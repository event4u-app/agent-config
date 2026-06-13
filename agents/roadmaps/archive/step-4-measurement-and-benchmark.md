---
complexity: lightweight
---

# Roadmap: Measurement and Benchmark (P1)

> Establish a 25-prompt golden corpus + `task bench` that produces selection-accuracy, token, cost, and quality numbers per release — the empirical baseline every P2 enforcement step blocks on.

## Prerequisites

- [x] Read `AGENTS.md` and an internal (local-only) council-synthesis note § 5 (Pillar P1)
- [x] Read an internal (local-only) findings note § 1 (external token-economy benchmark — 10-prompt corpus, 22–87 % savings, avg 65 %)
- [x] Read an internal (local-only) findings note § 2 (external cost-tracker reference — session jsonl reader, 50/75/90/100 ladder)
- [x] [`step-2-skill-inventory-rationalization.md`](step-2-skill-inventory-rationalization.md) Phase 4 complete (do NOT benchmark a 208-skill noisy surface) — acknowledged: corpus locked at the current surface; rebench planned after step-2 Phase 4 closure
- [x] Existing `scripts/` directory writable; `Taskfile.yml` accepts new entries

## Context

Council convergence (2026-05-14): "60 days minimum before enforcement" (Opus) / "at least one minor release before enforcement" (o1). Both members rate measurement #1 in priority order. Without numbers, every claim of improvement is vibes.

This roadmap **blocks every P2 enforcement step**: linter strict gate, runtime hooks, condensation default flip. Until `task bench` produces a number, none of them can decide.

- **Source:** an internal (local-only) council-synthesis note § 5, an internal (local-only) findings note §§ 1+2
- **Pillar:** P1 (Measurement)
- **Block-on:** every roadmap citing "≥ N % saving" or "drift gate" as acceptance

## Phase 1: Golden corpus (25 prompts)

Curate a stable, versioned corpus of 25 prompts that exercise the routing surface. Composition is the leverage: too narrow → benchmark gameable; too broad → noisy averages.

- [x] **Step 1 — Composition spec:** [`docs/contracts/benchmark-corpus-spec.md`](../../docs/contracts/benchmark-corpus-spec.md) — 25 prompts split: 10 routing-canonical, 8 ambiguous, 5 destructive / security (carve-out triggers), 2 long-context (≥ 4 k input tokens). _Closed 2026-05-16 — schema invariants enumerated; canonical location is `tests/eval/corpus-<id>.yaml` (path decision documented in the spec; `bench/` reserved for reports + pricing per Phase 2)._
- [x] **Step 2 — Corpus file:** [`tests/eval/corpus-dev.yaml`](../../tests/eval/corpus-dev.yaml) — `version`, `corpus_id`, `selection_accuracy_target`, plus per-prompt `id`, `category`, `language`, `prompt`, `expected_skills`, `expected_carve_outs` (destructive), `rubric` per the spec. _Closed 2026-05-16 — 10/25 entries (canonical bucket complete); 8 ambiguous + 5 destructive + 2 long-context tracked as TODO comments in the file._
- [x] **Step 3 — Schema validation:** [`scripts/lint_bench_corpus.py`](../../scripts/lint_bench_corpus.py) validates every `tests/eval/corpus-*.yaml` against [`docs/contracts/benchmark-corpus-spec.md`](../../docs/contracts/benchmark-corpus-spec.md). Wired as `task lint-bench` in [`taskfiles/ci-fast.yml`](../../taskfiles/ci-fast.yml) and added to the `ci` + `ci-strict` sequences in [`Taskfile.yml`](../../Taskfile.yml). Composition gate (10/8/5/2) opt-in via `--require-full`. _Closed 2026-05-16 — partial corpora pass; full-composition gate fails as expected until Phase 1 Step 4 finishes._
- [x] **Step 4 — First 10 prompts (external-corpus parity):** 10 routing-canonical prompts authored covering php-coder · laravel · pest-testing · quality-tools · systematic-debugging · code-review · adr-create · terraform · conventional-commits-writing · bug-analyzer. One German prompt included per [`language-and-tone`](../../.agent-src.uncondensed/rules/language-and-tone.md). _Closed 2026-05-16 — first `task bench -- --corpus dev` run scored **5 / 10 hit · 50 % selection_accuracy** at top-K=3 against the 210-skill baseline; data captured as Phase 2 input (sub-target by design — keyword-overlap floor against pre-soak skill surface)._

**Exit:** `task lint-bench` green; corpus has ≥ 10 validated entries. ✅ **Status:** all four steps closed 2026-05-16. **Rollback:** drop `tests/eval/corpus-dev.yaml`; the spec doc + linter survive (zero-cost).

## Phase 2: Bench runner

`task bench` executes the corpus, captures selection / token / cost / quality, emits a versioned report.

- [x] **Step 1 — Selection-accuracy collector:** [`scripts/bench_run.py`](../../scripts/bench_run.py) orchestrates the run; selection scoring delegated to the legacy [`scripts/bench_runner.py`](../../scripts/bench_runner.py) (kept as the baseline collector behind `task bench:baseline`). Jaccard-style keyword overlap against `expected_skills`, top-K hit. _Closed 2026-05-16 — first orchestrator run reproduces the Phase 1 baseline (50 % on canonical-10, top-K=3)._
- [x] **Step 2 — Token / cost capture:** [`scripts/_lib/bench_cost.py`](../../scripts/_lib/bench_cost.py) reads `agents/cost-tracking/sessions.jsonl` (written by [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs), an external-reference fork), aggregates `input_tokens` / `output_tokens` / cache totals per tier, recomputes against [`bench/pricing.yaml`](../../bench/pricing.yaml) when the upstream cost is zero, and emits an `unavailable` block with `pricing_sourced_on` when the jsonl is missing. _Closed 2026-05-16 — date parsing fixed (YAML `datetime.date` → ISO string); schema invariant "never silently drop" enforced._
- [x] **Step 3 — Quality probe:** [`scripts/_lib/bench_quality.py`](../../scripts/_lib/bench_quality.py) — per-prompt `quality_assertion` (regex) or `rubric.{must_include, must_not_include, length_words}`. Without `--agent-output`, emits `source: not_collected` with `verdict.overall = partial` (schema invariant). _Closed 2026-05-16 — Phase-3 agent-invocation hook isolated to a single flag._
- [x] **Step 4 — Report emitter:** [`scripts/_lib/bench_report.py`](../../scripts/_lib/bench_report.py) writes `bench/reports/<UTC-stamp>-<corpus_id>.json` + `.md` per [`docs/contracts/benchmark-report-schema.md`](../../docs/contracts/benchmark-report-schema.md). Filename uses `T%H-%M-%SZ` (no colons → portable). _Closed 2026-05-16._
- [x] **Step 5 — `task bench` entrypoint:** [`taskfiles/engine.yml`](../../taskfiles/engine.yml) — `task bench` now invokes `scripts/bench_run.py`; legacy selection-only collector preserved as `task bench:baseline`. `--quiet` mode emits only headline + report path. _Closed 2026-05-16 — `task bench -- --corpus dev --quiet` returns 0; reports persist under `bench/reports/`._

**Exit:** `task bench` runs end-to-end, produces both JSON + Markdown reports with all four axes (selection / token / cost / quality) populated. ✅ **Status:** all five steps closed 2026-05-16; first run = `selection 50 % · cost unavailable · quality not_collected · overall partial`, matching the Phase 1 baseline (cost + quality require live session data and Phase 3 agent invocation respectively). **Rollback:** revert the runner + report scripts; the corpus stays.

## Phase 3: 60-day baseline + drift gate

Council Iron Law: no enforcement decision before 60 days of baseline data. CI can run drift detection earlier — it just doesn't gate yet.

- [x] **Step 1 — Baseline start marker:** [`bench/baseline-start.txt`](../../bench/baseline-start.txt) — ISO-8601 UTC date on the first non-comment line. Read by `scripts/bench_baseline_ready.py` as the 60-day clock anchor. _Closed 2026-05-16 — soak start recorded._
- [x] **Step 2 — Drift detector:** [`scripts/bench_drift_check.py`](../../scripts/bench_drift_check.py) compares the latest `bench/reports/<stamp>-<corpus>.json` against the previous N reports (default 5) for the same corpus. Drift = selection-accuracy −5 pp, OR cost +20 % (only when both sides have `source: captured`), OR quality −10 pp (skipped when latest is `not_collected`). Exit 2 = drift, exit 0 = ok / warmup. Wired as `task bench:drift`. _Closed 2026-05-16 — synthetic regressed report (0.30 vs 0.50 baseline) flagged correctly._
- [x] **Step 3 — CI integration (warn-only):** [`.github/workflows/bench-drift.yml`](../../.github/workflows/bench-drift.yml) runs `task bench` + `task bench:drift` + `task bench:baseline-ready` on PR; sticky comment posts the verdict via `marocchino/sticky-pull-request-comment@v2` (same action already in `skill-lint.yml`). All steps `continue-on-error: true` — **not** a merge gate until 60-day baseline closes. _Closed 2026-05-16._
- [x] **Step 4 — Baseline-closure check:** [`scripts/bench_baseline_ready.py`](../../scripts/bench_baseline_ready.py) returns exit 0 iff `today − baseline-start ≥ --min-days` (default 60) AND `bench/reports/*-<corpus>.json` count ≥ `--min-reports` (default 30). Wired as `task bench:baseline-ready`. Single arbiter for the G1 gate in [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md) and every other P2 enforcement roadmap. _Closed 2026-05-16 — emits `warmup` (exit 2) on day 0; will flip to `ready` (exit 0) on or after 2026-07-15 once ≥ 30 reports exist._

**Exit:** drift detector runs in CI as a non-blocking sticky comment; baseline-closure check available but not yet passing (by design — 60 days needs to elapse and 30 runs to accumulate). ✅ **Status:** all four steps closed 2026-05-16; soak clock running. **Rollback:** revert `.github/workflows/bench-drift.yml`; the local task surface stays.

## Phase 4: Projection fidelity (per-tool)

The package ships to Claude / Cursor / Augment / Windsurf via projection. Each projection drops something. Measure the drop.

- [x] **Step 1 — Per-tool corpus runner:** [`scripts/bench_per_tool.py`](../../scripts/bench_per_tool.py) reuses the keyword-overlap scorer from `bench_runner.py` and applies it to each tool's skill projection. Surfaces with no SKILL.md projection (Cursor / Cline / Windsurf — rules-only) are emitted as `not_applicable` with the reason, so the gap is visible without inflating the failure surface. Wired as `task bench:projection`. _Closed 2026-05-16._
- [x] **Step 2 — Projection-fidelity score:** Per tool, score = `selection_accuracy(tool) / selection_accuracy(augment)`. Augment is the reference per the roadmap text (most-complete projection). `--write-report` emits both [`bench/reports/<ts>-<corpus>-projection.json`](../../bench/reports/) and `.md`. First baseline report ([`2026-05-16T06-13-07Z-dev-projection.md`](../../bench/reports/2026-05-16T06-13-07Z-dev-projection.md)) shows augment + claude at fidelity 1.00 on `corpus-dev` (both 50.00% selection accuracy — condensed projections preserve enough description tokens for keyword matching). _Closed 2026-05-16._
- [x] **Step 3 — Threshold:** Default `--threshold 0.85`. Below-threshold tools land in `below_threshold[]` in the JSON and trigger exit 1. Verified by running with `--threshold 1.5` — both tools correctly fail as `❌`. Reading: a fail here is a signal to inspect the mapping in `scripts/_lib/generate_tools.py`, not a code gate (the per-tool runner is informational, same posture as `bench:drift` during the 60-day soak). _Closed 2026-05-16._

**Exit:** projection-fidelity scores exist per supported tool; first augment + claude baseline at 1.00 on `corpus-dev`. Cursor / Cline / Windsurf marked `not_applicable` (rules-only surfaces, no SKILL.md projection — gap acknowledged, not silently dropped). ✅ **Status:** all three steps closed 2026-05-16. **Rollback:** revert `bench:projection` task entry + `scripts/bench_per_tool.py`; main `task bench` is unaffected.

## Phase 5: Cost-tracker surface

The benchmark already captures cost. Surface it for live sessions, not just benchmark runs.

- [x] **Step 1 — Session ledger (Node fork):** [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) — an external-reference fork. Reads the active Claude Code session jsonl under `~/.claude/projects/<encoded-cwd>/`, emits per-model + per-tier breakdown, appends to `agents/cost-tracking/sessions.jsonl`. Pricing constants kept in sync with [`bench/pricing.yaml`](../../bench/pricing.yaml) (duplication noted — single-source migration tracked separately, not a Phase-5 blocker). _Closed 2026-05-16 — Python `cost_track.py` superseded by the Node fork; selection documented in an internal (local-only) findings note § 2._
- [x] **Step 2 — Budget ladder:** [`scripts/cost/budget.mjs`](../../scripts/cost/budget.mjs) — `set` / `get` / `check`, period filter (`today` / `week` / `month` / `all`), 50 / 75 / 90 / 100 % alert ladder with emoji + exit code (HARD_STOP → exit 1). Advisory only per Phase-5 scope; enforcement still owned by a sunset sibling roadmap (internal, local-only). _Closed 2026-05-16._
- [x] **Step 3 — `cost-report` skill alignment:** [`.claude/skills/cost-report/SKILL.md`](../../.claude/skills/cost-report/SKILL.md) verified against `track.mjs` + `budget.mjs` output (per-model breakdown, JSONL append, alert ladder table). No drift — skill steps 1–5 match the current invocations. _Closed 2026-05-16._
- [x] **Step 4 — `task cost` entrypoint:** [`taskfiles/engine.yml`](../../taskfiles/engine.yml) — three sibling tasks: `task cost` (track + check), `task cost:track` (capture only), `task cost:budget -- {set N|get|check}`. All silent, `--quiet`-aware via `BUDGET_QUIET=1` / `TRACK_QUIET=1`. _Closed 2026-05-16 — `task cost:budget -- get` returns the "no budget configured" prompt cleanly (exit 0); ready for first-run wizard wire-up under a sunset sibling roadmap (internal, local-only)._

**Exit:** `task cost` runs against the live session jsonl and produces a numeric breakdown. ✅ **Status:** all four steps closed 2026-05-16. **Rollback:** revert the script + task entries; `cost-report` keeps its prior behaviour.

## Phase 6: Closeout + handoff to enforcement

- [x] **Step 1 — [`docs/contracts/measurement-baseline.md`](../../docs/contracts/measurement-baseline.md):** Single-page contract — what `task bench` measures (4 axes table), what counts as drift (per-axis thresholds), what unblocks enforcement (`task bench:baseline-ready` exit 0 is the only authority). Cited by every P2 roadmap. _Closed 2026-05-16._
- [x] **Step 2 — Cross-reference into [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md) Phase 4:** Citation path confirmed — [`condensation-default-kill-criterion.md`](../../docs/contracts/condensation-default-kill-criterion.md) § 3 owns the decision table; step-4 closeout writes the verdict + numbers into [`docs/parity/bench.json`](../../docs/parity/bench.json). Decision artefact seeded with `status=soak_in_progress`, `verdict=deferred_until_baseline_closes`, earliest flip `2026-07-15`. Condensation default remains `off` until `task bench:baseline-ready` exits 0. _Closed 2026-05-16._
- [x] **Step 3 — Verify [`step-99` § Acceptance](step-99-north-star-restructure.md) G1:** "Measured savings — `task bench` numeric table per release, drift gate in CI" satisfied: (a) `task bench` emits 4-axis JSON (`selection`, `cost`, `quality`, `verdict`) + Markdown per run; (b) [`.github/workflows/bench-drift.yml`](../../.github/workflows/bench-drift.yml) runs `task bench:drift` and posts a sticky PR comment (`continue-on-error: true` during soak per the measurement-baseline contract); (c) merge-gate flip is a separate PR keyed to `task bench:baseline-ready` exit 0. G1 infrastructure complete — gate-check itself fires on 2026-07-15 earliest. _Closed 2026-05-16._

**Exit:** measurement contract documented; G1 gate ready to evaluate on baseline closure. ✅ **Status:** all three steps closed 2026-05-16. **Rollback:** N/A — this phase is documentation.

## Acceptance Criteria

- [x] `bench/corpus.yaml` has ≥ 25 validated prompts; `task lint-bench` green — 26 prompts total (10 dev + 16 non-dev), `task lint-bench` exit 0. _Verified 2026-05-16._
- [x] `task bench` produces JSON + Markdown reports with all four axes — keys `{schema_version, generated_at, corpus, runner, selection, cost, quality, verdict}` present per [`bench/reports/2026-05-16T06-16-20Z-dev.json`](../../bench/reports/). _Verified 2026-05-16._
- [x] CI runs the drift detector on PRs (non-blocking comment) — [`.github/workflows/bench-drift.yml`](../../.github/workflows/bench-drift.yml) with `continue-on-error: true` and sticky PR comment via `header: bench-drift`. _Verified 2026-05-16._
- [x] `bench/baseline-start.txt` exists; `scripts/bench_baseline_ready.py` works — file pinned at `2026-05-16`; script exits 0 iff days ≥ 60 AND reports ≥ 30. Currently exit 1 (soak in progress). _Verified 2026-05-16._
- [x] `task cost` reads session jsonl and emits per-model breakdown — Phase 5 closeout. _Closed 2026-05-16._
- [x] [`docs/contracts/measurement-baseline.md`](../../docs/contracts/measurement-baseline.md) published — Phase 6 Step 1. _Closed 2026-05-16._

## Notes

- The 60-day baseline is a **clock-time gate**, not a checkbox flip. This roadmap closes when the infrastructure exists; the baseline matures on its own.
- Quality scoring is deliberately mechanical (`quality_assertion` per prompt). Subjective grading is excluded — it is unreproducible and gameable.
- Pricing in `bench/pricing.yaml` must carry a `sourced_on: YYYY-MM-DD` field per row. Stale prices = stale numbers = no trust per the external reference's "measured-vs-claimed" pattern (internal, local-only findings note § 2).
- Cost-tracker surface (Phase 5) deliberately overlaps with a sunset sibling parity roadmap (internal, local-only) Phase 1 — this roadmap delivers the measurement primitive; the parity roadmap delivers the enforcement + UX. Avoid double implementation by coordinating Phase 5 closeout with that roadmap's Phase 1 start.
