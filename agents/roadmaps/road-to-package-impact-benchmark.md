---
complexity: lightweight
---

# Roadmap: Package-Impact Benchmark (with vs. without agent-config)

> Compare Claude Code task performance with vs. without agent-config on an identical task corpus — produce a cached, refreshable `docs/benchmark.md` tracking wall-time, tokens, cost, ask-vs-act behaviour, and structural completion quality per category, via `task bench:ab`.

## Prerequisites

- [ ] Read `AGENTS.md` and the existing bench infrastructure:
  - `scripts/bench_run.py`, `scripts/bench_runner.py`, `scripts/bench_drift_check.py`, `scripts/bench_baseline_ready.py`
  - `internal/bench/corpora/corpus-dev.yaml`, `internal/bench/reports/`, `internal/bench/pricing.yaml`
  - `scripts/run_skill_evals.py`, `scripts/skill_trigger_eval.py`
- [ ] `claude` CLI installed locally and authenticated (variant runs invoke it)
- [ ] `task` runner present (entry will land in `Taskfile.yml`)
- [ ] Read [`step-4-measurement-and-benchmark.md`](archive/step-4-measurement-and-benchmark.md) for the precedent this roadmap extends (do NOT duplicate selection-accuracy / drift logic — extend it)

## Context

The existing bench pipeline compares **package versions across time** (drift, selection-accuracy, cost trend). It does **not** answer the question the user keeps asking: *does the package make Claude Code measurably better on real tasks?*

This roadmap adds the missing **variant axis** — `with` vs. `without` agent-config installed in a neutral test target — and keeps the cached `without` baseline reusable so a daily run only re-executes the `with` arm. Output lands in `docs/benchmark.md` so it is browsable next to other contracts.

- **Source:** Chat-thread 2026-05-26 (this thread)
- **Extends:** `internal/bench/` infrastructure shipped by archived `step-4-measurement-and-benchmark.md`
- **Block-on:** none — additive

## Phase 1: Variant target + clone scaffolding

Decide what "without the package" means physically, then build the scaffolding so both variants run on identical project state.

- [x] **Step 1: Decide target shape.** Two viable shapes — pick one, document in `internal/bench/ab/README.md`:
  - **Shape A (recommended):** neutral fixture project (small Laravel / TS demo) under `internal/bench/ab/fixture/`. Variants differ only in whether `agent-config` is installed inside the fixture's `.claude/` + `.augment/` + `AGENTS.md`. Cleanest A/B; no risk of measuring "the package working on its own source".
  - **Shape B:** the package's own repo, cloned twice — `with` keeps `.claude/`, `without` strips it. Faster to bootstrap; risk that tasks have nowhere realistic to operate.
- [x] **Step 2:** Add `scripts/bench_ab_clone.py` — given a target shape, materialises `internal/bench/ab/clones/with/` and `internal/bench/ab/clones/without/`. Idempotent; `--refresh` flag forces rebuild. Gitignore the `clones/` subdir.
- [x] **Step 3:** Add `scripts/bench_ab_integrity.py` — diff the two clones, assert that the only difference is the agent-config surface (`.claude/`, `.augment/`, `CLAUDE.md`, top-level rule pointers). Fails loud if any task-target file diverges between variants.
- [x] **Step 4:** Wire `internal/bench/ab/` into `.gitignore` (artifacts only — `README.md` + structure tracked).

**Exit criteria:** `python3 scripts/bench_ab_clone.py` produces two clones; `python3 scripts/bench_ab_integrity.py` exits 0; the only structural delta is the agent-config surface.

**Rollback:** delete `internal/bench/ab/`, remove the two scripts, revert `.gitignore` entry.

## Phase 2: A/B runner + baseline cache

Extend the existing bench runner with a `--variant {with,without}` axis and the cache logic that makes daily runs cheap.

- [x] **Step 1:** Extend `scripts/bench_run.py` (or wrap it in `scripts/bench_ab_run.py` — pick whichever keeps `bench_run.py` clean) with `--variant with|without` and `--corpus ab-{tracka,trackb}`. Variant is recorded in the report header.
- [x] **Step 2:** Implement baseline-cache lookup in `scripts/_lib/bench_ab_cache.py`:
  - Cache key: `(corpus_hash, claude_cli_version, target_shape_hash)`.
  - On a `bench:ab` run, look up the latest `variant=without` report matching the key.
  - **Found + fresh:** reuse without re-running. **Found + stale (corpus changed) OR missing:** prompt the user — numbered options: `(1) refresh baseline now`, `(2) reuse stale baseline (mark report as stale)`, `(3) abort`. Default suggestion: `1` if `--non-interactive` is off; `2` if it is on.
- [x] **Step 3:** Persist A/B reports under `internal/bench/reports/ab/{stamp}-{corpus}-{variant}.json` + matching `.md`. Reuse the existing JSON schema from `docs/contracts/benchmark-report-schema.md` (if missing, add a variant-axis section in that contract — separate ADR, NOT this roadmap).
- [x] **Step 4:** Add `scripts/bench_ab_diff.py` — given two reports (one per variant), produce the comparison artefact consumed by Phase 5.

**Exit criteria:** Running `bench:ab` twice on the same corpus in a row reuses the cached `without` baseline on the second run and only re-runs `with`. Manual cache invalidation works.

**Rollback:** delete the cache lib + diff script; the existing single-variant bench keeps working untouched.

## Phase 3: Track A — behavioural eval A/B

Re-use the existing skill-trigger eval surface and run it twice — once with package, once without. The metric: does the right skill / rule fire when expected?

- [x] **Step 1:** Author `internal/bench/corpora/ab-tracka.yaml` — 30-50 short prompts mapped to the rule or skill that should fire. Seed from existing `evals/triggers.json` should-trigger / should-not-trigger sets across the kernel rules (commit-policy, scope-control, verify-before-complete, ask-when-uncertain, non-destructive-by-default) and the 8-10 most-loaded skills.
- [x] **Step 2:** Extend `scripts/run_skill_evals.py` (or sibling wrapper) to take `--variant` and `--target-clone` so it runs against the materialised clone instead of the package repo.
- [x] **Step 3:** Compute the Track-A diff metrics in `bench_ab_diff.py`:
  - `with`: trigger-accuracy %, false-positive count
  - `without`: trigger-accuracy % (expected ≈ baseline floor — no rules loaded)
  - **Delta:** percentage-point lift attributable to the package
- [x] **Step 4:** Add a structural check that `without` cannot accidentally fire skills — if it does, integrity is broken, fail the run.

**Exit criteria:** `task bench:ab:track-a` produces a Track-A section with non-zero delta on at least 5 distinct rules / skills.

**Rollback:** remove `ab-tracka.yaml` + the runner extension; existing trigger-eval keeps working.

## Phase 4: Track B — task corpus + execution runner

The hard track — actually run Claude Code on small coding tasks and measure end-to-end output quality.

- [ ] **Step 1:** Author `internal/bench/corpora/ab-trackb.yaml` — 10-15 tasks across 5 categories:
  - **Bug-fix** (2-3 tasks): seeded buggy snippet + expected behaviour
  - **Feature-add** (2-3 tasks): small additive change
  - **Refactor** (2 tasks): existing-pattern-aware rewrite
  - **UI-audit** (2 tasks): "where would you add component X" (touches `existing-ui-audit` gate)
  - **Test-add** (2-3 tasks): missing test for an existing function
  Each task carries: `id`, `category`, `prompt`, `success_criteria` (structural — see Step 3), `expected_artifacts`, `seed_files`.
- [ ] **Step 2:** Build `scripts/bench_ab_task_runner.py` — for each task, in each variant:
  1. Boot a clean clone of the variant.
  2. Invoke `claude` CLI with the task prompt (headless / programmatic mode if supported; otherwise driver-script).
  3. Capture stdout transcript, tool-call log, wall-time, token counts (from session jsonl if `cost-tracking` enabled).
  4. Snapshot the resulting working tree.
- [ ] **Step 3:** Define **structural success criteria** in `scripts/_lib/bench_ab_scoring.py` — no LLM-judge in this roadmap; LLM-judge is a separate later roadmap if signal is too weak. Criteria per category:
  - **Bug-fix:** target test file exists and target assertion would pass against the diff (best-effort static check, not full test execution)
  - **Feature-add:** target file modified, no `commit-policy` violation in transcript (no `git commit` without ask)
  - **Refactor:** target file changed AND the existing-pattern reference file was read in the transcript
  - **UI-audit:** transcript contains a `state.ui_audit` write or an `existing-ui-audit` reference before any component file write
  - **Test-add:** test file created, no untouched-prod-file violation, no `--no-verify` in transcript
- [ ] **Step 4:** Track-B metrics computed by `bench_ab_diff.py`: completion-rate per category, mean wall-time, mean tokens, cost-per-task, ask-vs-act ratio (% commit-class events that asked instead of acted), tool-call count.

**Exit criteria:** `task bench:ab:track-b` runs all 10-15 tasks in both variants, produces a per-category table, and at least 3 categories show a measurable delta (positive or negative — both are signal).

**Rollback:** remove `ab-trackb.yaml`, the runner, and the scoring lib; Track A still produces output on its own.

## Phase 5: Report + task command

The user-facing surface: one `task bench:ab` command, one `docs/benchmark.md` file.

- [ ] **Step 1:** Add `scripts/render_benchmark_md.py` — consumes the latest paired reports + the diff artefact and renders `docs/benchmark.md`. Sections:
  - **Headline numbers** (delta table: wall-time, tokens, cost, ask-vs-act, completion-rate)
  - **Track A — behavioural** (per-rule / per-skill trigger lift)
  - **Track B — task completion** (per-category table)
  - **Methodology** (target shape, corpus versions, claude CLI version, run timestamp, baseline staleness flag)
  - **History** (last 5 runs, sparkline-style ASCII)
- [ ] **Step 2:** Wire `Taskfile.yml` entries:
  - `bench:ab` — full run (Track A + Track B), uses baseline cache
  - `bench:ab:refresh-baseline` — force-refresh the `without` arm
  - `bench:ab:track-a` — Track A only
  - `bench:ab:track-b` — Track B only
  - `bench:ab:diff` — re-render the markdown from the latest reports without re-running
- [ ] **Step 3:** Linter — add `scripts/lint_bench_ab.py` verifying corpus files conform to schema and the rendered `docs/benchmark.md` has every required section. Wire into the existing `lint-bench` aggregate.
- [ ] **Step 4:** Document `docs/benchmark.md` lifecycle in `docs/contracts/benchmark-ab-contract.md` — when it regenerates, what stale-baseline means, cache invalidation triggers, how a reader interprets a stale flag.

**Exit criteria:** `task bench:ab` produces `docs/benchmark.md` end-to-end on a fresh checkout. `task bench:ab:diff` re-renders without re-running. Linter passes.

**Rollback:** remove the `bench:ab*` Task entries and the render script; nothing else depends on this phase.

## Acceptance Criteria

- [ ] `task bench:ab` produces `docs/benchmark.md` with both tracks populated
- [ ] Running `task bench:ab` twice in a row reuses the cached `without` baseline on the second run (verify via report timestamp identity)
- [ ] `task bench:ab:refresh-baseline` re-runs the `without` arm and bumps the timestamp
- [ ] Track A delta is non-zero on ≥ 5 rules / skills
- [ ] Track B delta surfaces on ≥ 3 of 5 categories (either direction)
- [ ] `python3 scripts/bench_ab_integrity.py` exits 0 on every run (variants differ only in the agent-config surface)
- [ ] `python3 scripts/lint_bench_ab.py` passes
- [ ] `docs/benchmark.md` carries a methodology section naming corpus version + claude CLI version + run timestamp

## Notes

- **No LLM-judge in scope.** Track B uses structural success criteria only. A follow-up roadmap can add LLM-judge scoring if structural signal is too weak — but that is a separate decision, separate cost.
- **Single-sample default.** Each task runs once per variant by default. Statistical significance (n=5-10) is opt-in via `--samples N` and ships as a per-run cost choice, not a default — the goal of `task bench:ab` is a daily quick-read, not a research-grade study.
- **The package's own repo as fixture (Shape B) is a fallback.** Prefer Shape A (neutral fixture) unless bootstrapping a fixture project is more work than the entire rest of the roadmap — if so, document the trade-off in `internal/bench/ab/README.md` and pick B.
- **Cost-tracking dependency.** Token / cost numbers depend on `agents/cost-tracking/sessions.jsonl` (the ruflo pattern already wired into `bench_run.py`). If `cost-tracking` is off, the report flags `cost: source=unavailable` — does not fail the run.
- **Out of scope:** comparing against other AI-tool packages (Augment, Copilot, Cursor extensions); benchmarking on production projects; cross-model comparison (Sonnet vs Opus vs Haiku). All are additive follow-ups.
