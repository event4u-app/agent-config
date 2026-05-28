---
complexity: structural
---

# Roadmap: Readable Value Dashboard — make "what the package brings" understandable

> The three current benchmark systems (A/B `docs/benchmark.md`, telegraph `internal/bench/reports/telegraph-v*`, frugality JSONL) each measure something real but none answers the owner's question: *what does this package cost me and what does it save me, in plain numbers a non-expert can read*. This roadmap consolidates them into ONE two-panel `docs/value.md` — **Panel A: a cumulative cost ladder** (Ohne Paket → +Paket-load → +condense → +rtk → +terse, in tokens / € / %, min→max) and **Panel B: a behaviour panel** (with vs. without — right-skill selection, destructive-op stops, ask-vs-act, task completion). It fills the two biggest measurement gaps (rtk is unmeasured today; A/B Track B has no live data), reframes the misleading headline (Track A 100%-vs-0% is a tautology), and ships a glossary + honesty callouts so the page is legible to a layperson.

## Prerequisites

- [x] Read the three existing benchmark surfaces and their real numbers:
  - A/B: `docs/benchmark.md` (Track A `100% vs 0%` = file presence; Track B `—` = no live data), renderer `scripts/render_benchmark_md.py`, contract `docs/contracts/benchmark-ab-contract.md`.
  - Telegraph: `internal/bench/reports/telegraph-v2.md` (input-side median **+3.52%**, p10 **−4.84%**, Thin-Root **negative**); `telegraph-v1` output-side `vs_terse` median **−9.27%**; libs `scripts/_lib/bench_telegraph*.py`, `scripts/bench_condense_memory.py`.
  - Frugality: `scripts/measure_frugality_savings.py` → `agents/runtime/frugality/baseline.jsonl` (Metric A = always-loaded footprint per rule — the raw material for the "Paket-load" rung).
- [x] Confirm rtk is NOT measured anywhere in `internal/bench/` or `scripts/_lib/bench*.py` (grep returns nothing) — `rtk gain` analytics exist but are not wired into any package benchmark. This is the single largest unmeasured lever (CLAUDE.md claims 60–90% on CLI output).
- [x] Confirm pricing source: `internal/bench/pricing.yaml` (per-1M token rates + `sourced_on`) — reuse, do not invent a second price table.
- [x] Confirm settings that gate execution: `quality.local_auto_run: true` (CI-shaped verification steps ARE allowed in this roadmap per `roadmap-ci-steps-policy`).
- [x] Confirm rules that gate this work:
  - `commit-policy` — no commit steps written into this roadmap unsolicited.
  - `roadmap-progress-sync` — every edit to this file regenerates `agents/roadmaps-progress.md` in the same response.
  - `minimal-safe-diff` — reframe/extend the existing bench surface; do not rewrite the A/B variant axis or delete working scripts.
  - `direct-answers` (no invented facts) — the dashboard surfaces real measured numbers including the negative ones; no rounded-up marketing figures.
  - `script-writing` — every new script under `scripts/` carries `--quiet` + `_lib/script_output` helpers.

## Context

The owner's verdict on the current benchmarks: *"Aktuell bringen diese Benchmarks nichts. Ich weiß worum es geht und verstehe sie nicht mal."* The diagnosis is not that the measurement is wrong — it is that (a) the output is split across three vocabularies (`vs raw`, `vs terse`, `carve-out share`, `trigger-accuracy`), (b) the headline measures a tautology (files exist when installed), (c) the one panel that measures real value (Track B behaviour) is empty, and (d) the biggest real lever (rtk) is not measured at all.

The chosen target (decided in chat 2026-05-27) is a single **Value Dashboard** with two panels:

- **Panel A — cost ladder.** A cumulative, min→max ladder a layperson reads top-to-bottom: each rung names what it does, its token delta, its € delta at a fixed reference scale (e.g. 1,000 requests), and the running cumulative. It is **honest about the up-front cost**: installing the package first *adds* input tokens (rules load into context); condense + rtk + terse then claw that back. The net line is the real answer.
- **Panel B — behaviour.** with vs. without on a real corpus: right-skill selection, destructive-op stops, ask-vs-act ratio, task completion. This is the package's strongest value and is currently unmeasured live.

- **Source:** Chat-thread 2026-05-27 (this thread).
- **Extends:** the A/B surface from archived `road-to-package-impact-benchmark.md` and the telegraph/selection benches from archived `step-4-measurement-and-benchmark.md`. Do NOT duplicate their measurement logic — reframe and aggregate it.
- **Block-on:** none — additive and re-presentational.

## Non-goals / honesty constraints

- **No marketing numbers.** If condense nets −3.9% on Thin-Root files, the dashboard says so. The credibility of the page is the product.
- **No cross-model study.** One model (the local `claude` CLI / one pinned pricing row). Statistical-significance work stays opt-in (`--samples N`), same as the A/B contract.
- **No retiring of the raw reports.** `telegraph-v*`, `ab-*`, frugality JSONL stay as the machine-readable source of truth; the dashboard is a derived human view on top.
- **rtk numbers must be measured, not claimed.** The "60–90%" in CLAUDE.md is a vendor claim; Panel A shows what *this* corpus actually measured.

## Phase 0: Inventory, glossary, and the canonical output file

Lock the vocabulary and the single output target before touching any measurement.

- [x] **Step 1:** Author `docs/contracts/value-dashboard-spec.md` — the one contract that defines: the two panels, the ladder-rung data model (`{id, label, what_it_does, token_delta, eur_delta, cumulative_pct}`), the behaviour-metric set, the reference scale (default **1,000 requests** + the assumed avg request shape), and the "derived view, not a new measurement" relationship to the raw reports. This is the source of truth the renderer and tests bind to.
- [x] **Step 2:** Author the plain-language **glossary** block (lives in the spec, rendered into `docs/value.md`): one sentence each for Token, Input vs. Output, condense, rtk, terse/telegraph, "Ohne/Mit Paket", €-per-1k-requests. Written for a non-developer (the owner's "für Dumme" bar).
- [x] **Step 3:** Decide and document the canonical output path. Recommendation: **new `docs/value.md`** as the human dashboard; keep `docs/benchmark.md` as the A/B-technical appendix it already is (link the two). Record the decision + rationale in the spec.
- [x] **Step 4:** Write a one-page "current honest baseline" note in the spec appendix: the real numbers measured today (A/B tautology, condense +3.52%/−4.84%, telegraph `vs_terse` −9.27%, rtk = unmeasured, Track B = empty) so the gap each later phase closes is explicit.

**Exit criteria:** `value-dashboard-spec.md` exists with the rung data model, behaviour-metric set, glossary, canonical-path decision, and honest-baseline appendix. No code changed yet.

**Rollback:** delete `docs/contracts/value-dashboard-spec.md`.

## Phase 1: Unified report schema + ladder data model

One JSON schema that both panels serialise into, so the renderer has a single input.

- [x] **Step 1:** Add `docs/contracts/value-report-schema.md` (sibling to `benchmark-report-schema.md`) — defines `value-v1`: a `cost_ladder` array of rungs and a `behaviour` block, each rung carrying `token_delta`, `eur_delta`, `cumulative_pct`, `source_report` (which raw report it was derived from), and a `confidence` field (`measured` | `estimated` | `vendor-claim`).
- [x] **Step 2:** Add `scripts/_lib/value_ladder.py` — pure functions that take raw report dicts (telegraph, frugality, rtk, A/B) and emit normalised rung objects. No I/O, fully unit-testable. Token→€ conversion reuses `internal/bench/pricing.yaml`.
- [x] **Step 3:** Add `scripts/_lib/value_report.py` — assembles the `value-v1` JSON from the available raw reports; missing inputs degrade gracefully (rung marked `pending`, never crashes — mirror `render_benchmark_md.py`'s placeholder discipline).
- [x] **Step 4:** Unit tests `tests/test_value_ladder.py` — fixed raw-report fixtures in → expected rung objects out, including the negative-saving and missing-input cases.

**Exit criteria:** `python3 -m pytest tests/test_value_ladder.py` green; `value_report.py` emits a valid `value-v1` JSON from the current on-disk reports (with `pending` rungs where data is missing).

**Rollback:** delete the two `_lib` modules, the schema doc, and the test file.

## Phase 2: Fill the cost-axis gaps (Panel A rungs)

Each rung is a measurement, sourced from a raw report. Build them bottom-up.

- [x] **Step 1 — Paket-load rung (the honest up-front cost).** Reuse `measure_frugality_savings.py` Metric A (always-loaded kernel + router footprint in chars→tokens). Emit a positive `token_delta` rung labelled "Mit Paket (Regeln laden)". This is the rung that makes the dashboard honest — the package costs before it saves.
- [x] **Step 2 — condense rung.** Reuse the `telegraph-v2` input-side report. Aggregate to a single rung, **excluding Thin-Root files** (they net negative — the spec's rule-of-thumb). Mark `confidence: measured`. Surface the Thin-Root caveat as a footnote, not a hidden exclusion.
- [x] **Step 3 — rtk rung (NEW measurement, the big gap).** Add `scripts/bench_rtk_savings.py` + corpus `internal/bench/corpora/rtk/commands.yaml` — a fixed set of representative verbose CLI invocations (`git status`, `git diff`, test-runner output, `npm ls`, lint output). For each: capture raw output bytes, capture `rtk`-filtered output bytes, compute token delta via the same chars→tokens basis. If `rtk gain --history` exposes a machine-readable total, cross-check against it. Emit the rtk rung with `confidence: measured`; if `rtk` is not installed, rung = `pending` with the install hint (per `missing-tool-handling`, surface — do not silently substitute).
- [x] **Step 4 — terse/telegraph output rung.** Reuse `telegraph-v1` output-side (`vs_terse`). **Be honest:** the measured median is negative vs a plain "be concise" control. Either (a) render it as a rung with its real (possibly negative) value and a one-line "why" note, or (b) move it to Panel B as a quality lever, not a cost saver — decide in the spec, record the rationale. Do not present a negative number as a saving.
- [x] **Step 5 — assemble the cumulative ladder.** Wire all rungs through `value_ladder.py` into the running cumulative + net line. Verify the net matches a hand-computed example at the 1,000-request reference scale.

**Exit criteria:** `value-v1` JSON contains four measured/marked rungs + a cumulative net; the rtk bench runs and produces a real number (or a clean `pending` with install hint); the Thin-Root and negative-terse caveats are present, not hidden.

**Rollback:** delete `bench_rtk_savings.py` + the rtk corpus; the other rungs revert to reusing existing reports only.

## Phase 3: Make the behaviour axis real (Panel B)

Panel B is the package's strongest value and is currently empty. Populate it with real runs.

- [x] **Step 1 — Track B live.** Run `task bench:ab:live` (real `claude --print` per task) and capture a real completion-rate + ask-vs-act + mean wall-time for with vs. without. Record the report under `internal/bench/reports/ab/`. (Cost-bearing — needs `ANTHROPIC_API_KEY`; a `--samples 1` daily-read is the default per the A/B contract.)
- [x] **Step 2 — right-skill selection.** Surface the existing selection-accuracy bench (`dev` corpus, top-K hit rate) as a behaviour metric with vs. without. Reuse the existing runner; do not re-implement.
- [x] **Step 3 — destructive-op stops.** Use the 5 destructive/security prompts already defined in `benchmark-corpus-spec.md`. Measure, with vs. without, whether the agent refuses / stops / asks before the destructive action. Emit a `stops: N/5 vs M/5` metric. This is the safety value the Hard-Floor rules deliver — currently unquantified.
- [x] **Step 4 — normalise into the `behaviour` block** of `value-v1` via `value_report.py`. Each metric carries its `with`, `without`, and `delta`, plus the run `mode` (`live` | `dry-run`) so a dry-run number can never masquerade as evidence.

**Exit criteria:** the `behaviour` block carries four real with-vs-without metrics from at least one `live` run; dry-run runs are clearly badged and excluded from the headline.

**Rollback:** behaviour block falls back to `pending`; no raw reports deleted.

## Phase 4: The for-dummies renderer

One renderer, two panels, plain language, honest callouts.

- [x] **Step 1:** Add `scripts/render_value_md.py` — deterministic, no bench execution (mirror `render_benchmark_md.py`). Reads the latest `value-v1` JSON, writes `docs/value.md`. Placeholder document when data is missing — never errors.
- [x] **Step 2:** Render **Panel A** as the ladder a layperson reads: each rung = label · what-it-does (one phrase) · Δ% · €-at-1k-requests · cumulative. End with a bold **NETTO** line and the min→max framing. Include the "⚠️ erst teurer" honesty note on the Paket-load rung.
- [x] **Step 3:** Render **Panel B** as a plain with-vs-without table (right-skill selection, destructive stops, ask-vs-act, task completion), each with a one-line "what this means" caption.
- [x] **Step 4:** Render the **glossary** (from Phase 0) and a **"how to read this page"** intro paragraph at the top. Render the `mode` badge (live/dry-run) and `confidence` markers (measured/estimated/vendor-claim) inline.
- [x] **Step 5:** Reframe the misleading `docs/benchmark.md` headline — replace the Track A `100% vs 0%` tautology row with a one-line note ("Track A confirms surface availability — a precondition, not an impact metric; see `docs/value.md` for impact") and link to `docs/value.md`. Minimal edit to the existing renderer; do not delete Track A.
- [x] **Step 6:** Golden-output test `tests/test_render_value_md.py` — fixed `value-v1` JSON in → byte-stable `docs/value.md` out; asserts every panel + glossary + net line present (mirror the `REQUIRED_SECTIONS` pattern in `render_benchmark_md.py`).

**Exit criteria:** `docs/value.md` renders both panels + glossary + net line + honesty callouts from real data; `pytest tests/test_render_value_md.py` green; `docs/benchmark.md` Track A row no longer reads as an impact claim.

**Rollback:** delete `render_value_md.py`, `docs/value.md`, the golden test; revert the one-line `benchmark.md` edit.

## Phase 5: Wiring, cadence, and verification

Make it runnable, documented, and CI-checked.

- [x] **Step 1:** Add task targets in `taskfiles/` — `task value` (assemble JSON + render `docs/value.md` from existing reports, cheap, no API), `task value:refresh` (re-run the cost-axis benches: frugality + telegraph + rtk), `task value:behaviour` (the cost-bearing live Track-B + behaviour run). Mirror the `bench:ab*` naming.
- [x] **Step 2:** Update `docs/benchmarks.md` cadence table — add the `value` corpus/dashboard row, its refresh triggers (edit to any rung source → re-render), and the rtk-corpus cost envelope.
- [x] **Step 3:** Add `scripts/lint_value_dashboard.py` — assert `docs/value.md` carries all required sections, every rung cites a `source_report`, no rung claims `measured` without one, and no negative number is labelled "saving". Wire into the lint cadence.
- [x] **Step 4:** Run `task ci` and confirm green (allowed — `quality.local_auto_run: true`). Capture fresh output as the completion evidence per `verify-before-complete`.

**Exit criteria:** `task value` produces `docs/value.md` in one command; `task ci` green with the new lint + tests included; cadence documented.

**Rollback:** remove the task targets, the lint script, and the `benchmarks.md` cadence row.

## Acceptance criteria

- A non-developer can open `docs/value.md` and answer "what does this package cost me and what does it save me" without asking anyone — the owner's "für Dumme" bar.
- Panel A shows a cumulative min→max ladder with real (including up-front-cost and any negative) numbers in tokens, %, and € at a stated reference scale.
- Panel B shows real with-vs-without behaviour metrics from at least one live run, dry-run clearly badged.
- rtk savings are measured on a real corpus, not claimed.
- Every number cites its source report and a confidence marker; no negative value is presented as a saving.
- `task value` regenerates the page deterministically; `task ci` stays green.
