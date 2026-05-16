---
complexity: lightweight
---

# Roadmap: Caveman Parity — Token Economy with Measurement (P5)

> Match every measurable pattern in caveman's token-economy playbook — 6-level intensity ladder, in-place memory-file compression with backup, auto-clarity carve-outs, statusline integration, per-prompt token delta, output-only disclaimer — and surface zero `[!]` rows in `docs/parity/caveman.md`.

**Measured-vs-claimed disclaimer:** Every saving percentage in this roadmap is **claimed by caveman's published table** (avg 65 %, range 22–87 % per [`external-findings.md § 1`](../audit-2026-05-14-north-star/external-findings.md)). Validation against our 25-prompt corpus happens in Phase 5 — until then, our numbers are absent, not equivalent.

## Closure decision (2026-05-16, maintainer override)

This roadmap is **sunset** under the closure mandate. The existing `compress`/`caveman-speak` mechanism (intensity off-by-default, runtime rule shipped, output-only by construction) is preserved as-is; the parity-table chase against caveman's published 65 % average is dropped. Rationale:

- The default-flip decision is owned by [`step-99`](step-99-north-star-restructure.md) Phase 4, which is itself sunset on the same mandate (G5 gate cancelled). With no default-flip on the horizon, the 6-level intensity ladder, statusline tally, lifetime-token JSONL, drift comparison, and bench-caveman corpus are mechanism without a consumer.
- The shipped surface (`caveman-speak` rule with `caveman.speak_scope` default `off`, plus the `compress` script for source-of-truth → `.agent-src/` regeneration) already satisfies the carve-out and output-only honesty contract. Nothing in this roadmap is required to keep that surface honest.
- The IMPORTANT row ("don't call it caveman in our package") was satisfied informally during the North Star Restructure — consumer-facing copy uses `compress`/`intensity`; `caveman-*` lives only in `caveman-speak` rule slug + runtime-flag namespace (and is documented as a historical attribution, not a marketing surface).

All Phase 1–6 checkboxes flip `[-]` cancelled. If a future maintainer revives the default-flip ambition, this roadmap reopens; the candidates table and overlap pass from [`step-2`](step-2-skill-inventory-rationalization.md) Phase 2 would feed the corpus selection.

## IMPORTANT

- [x] Don't call it caveman, in our package. Maybe compress or something like that - something better.
  _Resolved informally during North Star Restructure — consumer surface uses `compress`/`intensity`; `caveman-*` slug retained only as historical attribution in the rule namespace._

## Prerequisites

- [-] Read `AGENTS.md` and [`external-findings.md § 1`](../audit-2026-05-14-north-star/external-findings.md) — every row is a checkbox in this roadmap
- [-] [`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md) Phase 2 complete (`task bench` exists; per-prompt token delta is captured)
- [-] [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md) Phase 4 kill-criterion doc parked in `docs/contracts/`
- [-] Confirm [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md) rule exists and ships `caveman.speak_scope` default `off`

## Context

Caveman is one trick done exceptionally well: measured token reduction with a reproducible benchmark. The package sells trust through numbers. We sell governance — and have zero measured output numbers.

This roadmap closes the parity table row by row, and lands the **mechanism** (intensity ladder, carve-outs, statusline) regardless of whether the kill-criterion in [`step-99`](step-99-north-star-restructure.md) Phase 4 flips the default on. Mechanism without proof is fine; mechanism *gated* on proof is the point.

- **Source:** [`external-findings.md § 1`](../audit-2026-05-14-north-star/external-findings.md) (6 rows, all in scope)
- **Pillar:** P5 (Domination Mandate)
- **Block-on:** step-4 Phase 2; default-flip is **separately** blocked on step-4 Phase 3 (60-day baseline)

## Phase 1: Intensity ladder

Six levels matching caveman's published scope. The flag `caveman.speak_scope` becomes one knob the user actually turns.

- [-] **Step 1 — Ladder spec:** `docs/contracts/caveman-intensity-ladder.md` — defines `lite` / `full` / `ultra` / `wenyan-lite` / `wenyan-full` / `wenyan-ultra` with per-level compression rules + side-by-side example per level.
- [-] **Step 2 — Config wiring:** `.agent-settings.yml` accepts `caveman.intensity ∈ { lite, full, ultra, wenyan-lite, wenyan-full, wenyan-ultra, off }`. Default `off`. `caveman.speak_scope` retained for backward compatibility as a thin alias mapping to `intensity: full`.
- [-] **Step 3 — Compression engine:** `scripts/caveman_compress.py` accepts `--intensity <level>` and applies the level-specific rules. Reads input via stdin or `--file`, emits to stdout or `--in-place`.
- [-] **Step 4 — Example fixtures:** `tests/fixtures/caveman/<level>/{input,expected}.md` — six fixture pairs validating each level deterministically.

**Exit:** `caveman_compress.py --intensity <level>` produces the expected output for every fixture; `.agent-settings.yml` schema accepts every level. **Rollback:** drop `--intensity`; `caveman_compress` reverts to the existing single-level behaviour.

## Phase 2: `caveman-compress` memory-file rewrite

In-place compression of long-form memory / instruction files with `.original.md` backup. One-shot work, lifetime payoff.

- [-] **Step 1 — In-place rewrite mode:** `scripts/caveman_compress.py --in-place <file>` writes `<file>.original.md` (atomic copy) before rewriting `<file>`. Refuses if `.original.md` already exists (no double-compression).
- [-] **Step 2 — `task caveman-compress` entrypoint:** Wraps the script. Accepts `--intensity` (default `full`). `--quiet` mode emits only the byte / token delta. Standard `rtk` wrapping per [`cli-output-handling`](../../.agent-src.uncompressed/rules/cli-output-handling.md).
- [-] **Step 3 — Restore command:** `task caveman-compress:restore <file>` swaps `<file>` ↔ `<file>.original.md`. Symmetric.
- [-] **Step 4 — Token-delta capture:** Each `--in-place` run appends a row to `agents/metrics/caveman-compress-log.jsonl`: `{ file, before_tokens, after_tokens, intensity, ts }`.

**Exit:** in-place compression of a sample file (`AGENTS.md` of a test consumer) produces `.original.md` backup, restorable; delta logged. **Rollback:** `task caveman-compress:restore` exists; script removal leaves backups intact.

## Phase 3: Auto-clarity carve-outs

Compression that knows when to stop. Disabled on security / destructive / multi-step where omitted conjunctions risk misread.

- [-] **Step 1 — Carve-out catalog:** `docs/contracts/caveman-carve-outs.md` — three carve-outs: **security context** (matches `security-sensitive-stop` triggers), **destructive ops** (matches `non-destructive-by-default` triggers), **multi-step sequences** (numbered lists ≥ 3 items with conjunctions).
- [-] **Step 2 — Engine integration:** `caveman_compress.py` parses input for carve-out markers; carved regions pass through verbatim. Carve-out detection has unit fixtures in `tests/fixtures/caveman/carve-outs/`.
- [-] **Step 3 — Runtime rule update:** Update [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md) to declare carve-outs are mandatory even at `intensity: ultra`. ALL-CAPS Iron Law block forbidden per [`roadmap-writing`](../../.agent-src.uncompressed/skills/roadmap-writing/SKILL.md) — rule update gets a fenced contract block.
- [-] **Step 4 — Lint coverage:** `scripts/lint_caveman_output.py` scans generated output for carve-out violation patterns (compressed `if … then …` near `rm -rf`, etc.). Wired to `task ci` post-Phase 2.

**Exit:** carve-out fixtures pass; runtime rule cites the contract; linter catches violations. **Rollback:** demote the linter to warn; carve-outs survive in the engine.

## Phase 4: Statusline + per-prompt token delta

Observable feedback. Lifetime savings visible; per-prompt delta in `task bench`.

- [-] **Step 1 — Lifetime tally:** `scripts/caveman_tally.py` aggregates `agents/metrics/caveman-compress-log.jsonl` into `agents/metrics/caveman-lifetime.json` (`{ total_tokens_saved, files_compressed, first_run, last_run }`).
- [-] **Step 2 — Statusline hook:** `scripts/caveman_statusline.py` emits a single-line summary suitable for IDE statusline integration (`caveman: −123,456 tokens / 18 files`). Docs in `docs/contracts/statusline-integration.md` describe per-IDE wiring (Augment / Claude Code / Cursor).
- [-] **Step 3 — `task bench` per-prompt delta:** Extend `bench/reports/<ts>.md` from [`step-4`](step-4-measurement-and-benchmark.md) to include `caveman_delta` per prompt: tokens saved when compression is on vs off (run the corpus twice, diff).
- [-] **Step 4 — Drift comparison:** `task bench` report cross-references the lifetime tally — flags when bench-measured savings drop below claimed lifetime average by > 15 pp.

**Exit:** statusline emits a number; `task bench` per-prompt delta present; drift comparison reports both numbers. **Rollback:** statusline + tally are read-only over `caveman-compress-log.jsonl`; deleting them is reversible.

## Phase 5: Honest output-only disclaimer + parity sign-off

Caveman is honest: it only affects output tokens. We will be at least as honest.

- [-] **Step 1 — Disclaimer text:** Update [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md) rule body to declare explicitly: "caveman compression affects **output tokens only** — thinking / reasoning tokens are upstream of the rule and untouched." Same line in `docs/contracts/caveman-intensity-ladder.md`.
- [-] **Step 2 — README integration:** README surface that mentions caveman links to the disclaimer. Per [`token-efficiency`](../../.agent-src.uncompressed/rules/token-efficiency.md), the disclaimer is **once**, cited from elsewhere — not restated.
- [-] **Step 3 — Parity doc:** `docs/parity/caveman.md` — one row per [`external-findings.md § 1`](../audit-2026-05-14-north-star/external-findings.md) line, each marked `[x] covered by <file:line>` / `[~] superseded by <approach>` / `[!] gap`. **Acceptance: zero `[!]` rows.**
- [-] **Step 4 — Bench redundancy check:** Run `task bench` over the 25-prompt corpus with `caveman.intensity: full` and compare aggregate savings to caveman's published 65 % average. Numbers committed to `docs/parity/bench-caveman.json`.

**Exit:** parity doc zero `[!]` rows; bench-caveman.json present with numbers. **Rollback:** parity doc + JSON are reports; deletion is a doc revert.

## Phase 6: Closeout

- [-] **Step 1 — Cross-reference [`step-99`](step-99-north-star-restructure.md) § Phase 5 Step 1:** `docs/parity/caveman.md` cited as evidence; G5 gate references it.
- [-] **Step 2 — Update [`step-99`](step-99-north-star-restructure.md) § Phase 4 Step 2:** Compression default-flip decision reads `bench-caveman.json` + `caveman-lifetime.json`. Decision criteria (≥ 30 % saving, < 5 % quality regression) are owned there, not here.
- [-] **Step 3 — Update composite scorecard:** [`external-findings.md § 5`](../audit-2026-05-14-north-star/external-findings.md) "Compression / token economy — measurement" row flips from `–` to `=` (or `+` if bench beats caveman's avg).

**Exit:** scorecard updated; step-99 cross-references intact. **Rollback:** N/A — documentation closeout.

## Acceptance Criteria

- [-] `docs/parity/caveman.md` has zero `[!]` rows
- [-] `caveman.intensity ∈ { lite, full, ultra, wenyan-{lite,full,ultra}, off }` configurable in `.agent-settings.yml`
- [-] `task caveman-compress --in-place <file>` produces `.original.md` backup and restorable swap
- [-] Auto-clarity carve-outs catalogued; linter green
- [-] Statusline + lifetime tally script exist; bench captures per-prompt delta
- [-] Output-only disclaimer cited from rule + README + ladder doc
- [-] `docs/parity/bench-caveman.json` exists with numbers from the 25-prompt corpus

## Done

- [x] Sunset closure 2026-05-16 — mechanism (`compress` + `caveman-speak`) preserved; parity-table chase against caveman's published 65 % average cancelled. See closure decision block at top.

## Notes

- The default-flip decision is **not** owned by this roadmap. This roadmap delivers the mechanism, the measurement, and the parity table. The flip lives in [`step-99`](step-99-north-star-restructure.md) Phase 4, gated on [`step-4`](step-4-measurement-and-benchmark.md) Phase 3 baseline closure.
- `.original.md` backup is a **floor**, not a ceiling — projects free to add their own commit-before-rewrite hooks. Caveman parity is about mechanism availability; project-specific safety is project-specific.
- The `wenyan-*` levels target Classical Chinese-style compression — `lite/full/ultra` are the English-side spectrum. Ship both ladders; user picks per language profile.
- Carve-outs are conservative by design. False-positive (uncompressed when compression would have been fine) is cheaper than false-negative (compressed a security warning into ambiguity).
