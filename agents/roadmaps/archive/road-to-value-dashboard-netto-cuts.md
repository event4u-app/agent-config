---
complexity: lightweight
---

# Roadmap: Value Dashboard NETTO — cut the base-load, keep Panel B value

> Cut the package's measured base-load (+4 120 → ideally ≤ 0 tokens/request NETTO) by fixing the load-rung measurement, minifying the router, instrumenting trigger-match rates, deduplicating triggers, and pruning dead tier-1 rules — without regressing Panel B's 76.9pp completion lift or 50pp selection lift.

## Prerequisites

- [ ] Read `docs/contracts/value-dashboard-spec.md` (panels, rungs, honesty constraints).
- [ ] Read `docs/contracts/rule-router.md` (kernel / tier-1 / tier-2 / profile semantics — tier-2 is already trigger-loaded; the measurement question is about always-on metadata, not rule bodies).
- [ ] Read `docs/contracts/kernel-membership.md` and `kernel-rule-edits.md` — every kernel rule edit is its own PR, ≥ 24 h soak. This roadmap does **not** touch kernel-rule bodies.
- [ ] Confirm `internal/bench/reports/value/latest.json` carries the NETTO baseline (currently `+4 120 tokens / request`, sourced from the load-rung bug).
- [ ] Confirm `internal/bench/reports/ab/2026-05-28T14-*-ab-trackb-{with,without}.json` are the live Panel B baseline (with 84.6%, without 7.7%, Δ +76.9pp). Every phase regression-checks against this pair.
- [ ] Confirm rules that gate this work:
  - `commit-policy` — no commit steps written into this roadmap unsolicited.
  - `roadmap-progress-sync` — every checkbox flip regenerates `agents/roadmaps-progress.md` in the same response.
  - `minimal-safe-diff` — reframe / extend; do not rewrite working scripts.
  - `direct-answers` (no invented facts) — every saved-token claim cites the report it came from.
  - `frugality-charter` — every change defends a measurable token saving and surfaces honest negatives.

## Context

The first live `value-v1` report shipped (PR #279) measured **NETTO +4 120 tokens / request, +€11.37 per 1 000 requests, +51.5 % vs. baseline**. The AI Council (`agents/runtime/council/responses/value-dashboard-netto-optimization.json`, 2026-05-28, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, $0.12 actual) ranked optimisation paths; host critical-evaluation surfaced a measurement bug that under-counts the real base-load by **+3 230 tokens/request**.

A second council round on this roadmap's structure (`agents/runtime/council/responses/value-dashboard-netto-cuts-roadmap-review.json`, 2026-05-28, anthropic + openai, 2 rounds, $0.07 actual) surfaced four structural fixes that the host accepts (folded into the phases below): integrate a Panel B rule-attribution map into Phase 3 telemetry; cut the "synonym-section" option from Phase 4 (delete-only dedup is safer); add a sentinel regression sample (3-task subset) to every cut-phase, not just the close-out; cap the telemetry replay sample size so it never blows wall-time.

- **Source:** Chat-thread 2026-05-28 (post-PR-#279); two council sessions above.
- **Extends:** `agents/roadmaps/archive/road-to-readable-value-dashboard.md` (the dashboard itself — this roadmap consumes its output and feeds back into it).
- **Block-on:** none — additive measurement + lossless transforms first, then telemetry-gated cuts.

## Non-goals / honesty constraints

- **No kernel-rule body cuts.** The kernel is the 84.6% completion lift; the council and host both reject cutting it (`docs/contracts/kernel-membership.md`).
- **No marketing numbers.** Saving claims cite the report file that proved them; hypotheses say "HYPOTHESIS" until measured.
- **No silent fallbacks.** If a cut regresses Panel B beyond the regression budget (below), roll it back — `frugality-charter` § Frugality-Forbidden.
- **Regression budget (locked):** completion-rate must stay ≥ 80% (vs 84.6% baseline = 4.6pp tolerance); selection accuracy must stay ≥ 45% (vs 50% = 5pp tolerance). Any cut that breaches either rolls back.

## Phase 1: Fix the load-rung measurement (honest baseline)

The `load` rung currently reads `agents/runtime/frugality/baseline.jsonl` which measures a hardcoded 6-rule "frugality canon" (`scripts/measure_frugality_savings.py:27-34`), **not** the actual always-loaded set. The real kernel has 10 rules: 32 293 chars = **~8 073 tokens** (verified via `jq -r '.kernel[]' dist/router.json` + per-file `wc -c`). The dashboard under-reports the base-load by ≈ +3 230 tokens/request.

- [ ] **Step 1:** Add a new measurement path in `scripts/_lib/value_ladder.py` — `load_rung_from_router()` that reads `dist/router.json::kernel`, sums per-file `len(.agent-src/rules/<id>.md)` chars, divides by 4. Keep `load_rung_from_frugality()` as a back-compat alias that delegates and warns once.
- [ ] **Step 2:** Update `scripts/_lib/value_report.py::assemble_value_v1()` to prefer the new path; fall back to the frugality baseline only if `dist/router.json` is missing.
- [ ] **Step 3:** Extend `tests/test_value_ladder.py` — fixture with a mock `dist/router.json::kernel = [a, b, c]` + corresponding rule files → assert the rung's `token_delta` equals the sum-of-chars / 4. Add a test that the rung is now > 4 843 tokens against the real on-disk data (regression guard for the bug staying fixed).
- [ ] **Step 4:** Re-run `task value` and capture the new NETTO. Document the corrected baseline in `docs/contracts/value-dashboard-spec.md` § Honest baseline appendix (a new row: "load rung corrected 2026-MM-DD: was 4 843, now ≈ 8 073 tokens").

**Exit criteria:** `pytest tests/test_value_ladder.py -k load` green; `task value` re-renders `docs/value.md` with a NETTO that reflects the real kernel size; spec appendix names the corrected value.

**Rollback:** revert `value_ladder.py` + `value_report.py` to the frugality-baseline path; re-run `task value`.

## Phase 2: Minify `dist/router.json` (lossless, zero-risk)

The router JSON is 31 643 bytes pretty-printed, 16 450 bytes after `jq -c` — a 48 % reduction. Lossless transform; the model parses the same structure. **Hypothesis-gated by whether the router actually lands in the agent's prompt context per request** (varies by host: Claude Code, Augment, Cursor each load it differently). Verify before celebrating. Council R2 (anthropic, HIGH) endorsed minify-before-telemetry: a lossless format change cannot skew downstream measurement.

- [ ] **Step 1:** Audit which surfaces actually load `dist/router.json` into model context per request. Check `.claude/`, `.augment/`, `.cursor/` projections for inclusion patterns; grep for `router.json` in skill / rule bodies. Document findings in `internal/bench/reports/value/router-context-loading-audit-<UTC>.md`.
- [ ] **Step 2:** If at least one surface loads it: update `scripts/compile_router.py` (the canonical compiler) to emit minified output by default. Add `--pretty` flag for human-readable variant under `dist/router.pretty.json` (gitignored or committed as documentation — decide in the diff).
- [ ] **Step 3:** Verify Panel A regen — `task value` should now reflect the smaller router footprint *if and only if* the router was in the load rung. If audit (Step 1) showed it was not in any host's per-request prompt, surface that finding inline in `docs/value.md` and note the minification as a future-proofing optimisation rather than a measured saving.
- [ ] **Step 4 — sentinel:** Run the 3-task Track B regression sample (`scripts/bench_ab_task_runner.py --variant both --mode live --task-ids trackb-bugfix-01,trackb-feature-01,trackb-uiaudit-01` — extend the runner with `--task-ids` if missing). Confirm completion ≥ 80 % and selection-relevant rules still fire. Sentinel sample cost ≈ 6 claude invocations × ~50 s = ~5 min wall, ~$1-2 spend.

**Exit criteria:** `dist/router.json` is minified by default; the audit document names exactly which surfaces include it per-request; if any surface does, the load rung reflects the reduction; sentinel regression sample stays within budget.

**Rollback:** revert `compile_router.py` to pretty-printed default; re-run `task sync` to regenerate.

## Phase 3: Router-trigger telemetry hook + Panel B attribution (force-multiplier)

The single highest-leverage measurement: log which tier-1 / tier-2 triggers actually match real prompts. Derisks Phase 4 (dedup) and Phase 5 (dead-rule audit) — without it both are speculation. Council R2 (anthropic, HIGH) flagged that the original Phase 5 audit would fly blind without a Panel B rule-attribution map; this phase folds that map in by adding the Track B corpus to the replay set and emitting a "rules-untouchable" list the Phase 5 audit reads as input.

**Telemetry shape — local replay only.** This phase ships a corpus-replay script, NOT a runtime per-request hook. Token cost per request stays at zero; the telemetry effort is one-time analysis, not always-on instrumentation.

- [ ] **Step 1:** Add `scripts/router_telemetry.py` — a pure-local replay script. Input: a prompt (+ optional open-files context). Output: `{matched_triggers: [...], matched_rules: [...], duration_ms: N}`. Implements the same router-match logic as `dist/router.json` consumers (kernel always-on, tier-1 on trigger match, tier-2 on trigger match + full profile). No SDK call, no API spend.
- [ ] **Step 2:** Add `taskfiles/value.yml::value:telemetry:replay` — replay a fixed corpus through `router_telemetry.py` and dump per-trigger / per-rule hit counts. Pure-local.
- [ ] **Step 3:** Run the replay against three corpora: `internal/bench/corpora/ab-trackb.yaml` (the Panel B corpus — attribution map source), `tests/eval/corpus-dev.yaml` (dev), and `tests/eval/corpus-non-dev.yaml` (broader coverage). **Hard sample cap: 200 prompts per corpus** — if a corpus is larger, replay the first 200 deterministically (sorted by id). Write the aggregate to `internal/bench/reports/router-telemetry/<UTC>.json` with three top-level blocks: `per_trigger_hits`, `per_rule_activations`, `panel_b_untouchable_rules`. The third block is the new attribution output: any tier-1 rule that activates on ≥ 1 Track B task.
- [ ] **Step 4:** Extend `docs/contracts/value-dashboard-spec.md` § Behaviour-metric set to reference the telemetry report as the evidence basis for Phase 4 + Phase 5, and cite the `panel_b_untouchable_rules` list as the hard-floor input to Phase 5's audit. Add a one-paragraph note in `docs/benchmarks.md` cadence table.

**Exit criteria:** `internal/bench/reports/router-telemetry/<UTC>.json` exists with non-empty hit counts across all three corpora; `panel_b_untouchable_rules` is a concrete list of rule ids (may be empty if no tier-1 rule fires on Track B — which itself is a finding); cadence note in `docs/benchmarks.md` published.

**Rollback:** delete `scripts/router_telemetry.py`, the taskfile target, and the report dir; spec note removed.

## Phase 4: Targeted trigger deduplication (delete-only)

Initial audit (Phase 3) found ≈ 15-20 duplicate trigger clusters in `dist/router.json` (392 total triggers; ≈ 3 % redundancy). The council's "30 % redundancy" hypothesis is unsupported — real saving is small but real. **Council R2 (anthropic, HIGH) cut the "synonym-section" option as a Chesterton's Fence violation** — adding router-level structure to "factor out" synonyms introduces precedence and ordering risk disguised as lossless dedup. This phase is delete-only: for each duplicate cluster, keep exactly one canonical trigger, drop the rest. No new router structure.

- [ ] **Step 1:** Generate the duplicate-cluster report — `python3 -c "import json; …"` one-liner that prints `(trigger_value, [rule_ids])` for every trigger appearing under more than one rule, sorted by occurrence count. Save as `internal/bench/reports/router-telemetry/duplicate-triggers-<UTC>.md`.
- [ ] **Step 2:** For each cluster, decide in the same report: (a) **keep one canonical trigger, drop the variants** (the only structural change allowed); or (b) **leave as-is** when the duplicates are semantically distinct despite identical surface form (e.g. `"/audio:"` appearing under both an audio-cmd rule AND a media-policy rule is two separate routes, not one cluster). No synonym-section option, no new router shape. The report includes the per-cluster decision rationale.
- [ ] **Step 3:** Edit the relevant `.agent-src.uncondensed/rules/*.md` frontmatter `triggers:` sections per the decision report. Re-run `task sync && task generate-tools` so `dist/router.json` regenerates.
- [ ] **Step 4:** Replay the Phase 3 telemetry against the new router — confirm zero regressions in `matched_rules` for the Track B + dev + non-dev corpora. Re-run `task value` to measure the token delta.
- [ ] **Step 5 — sentinel:** Run the 3-task Track B regression sample (same shape as Phase 2 Step 4). Confirm completion ≥ 80 %. If any rule from `panel_b_untouchable_rules` (Phase 3 output) had its trigger touched, the sentinel run is mandatory; otherwise it is advisory but still run.
- [ ] **Step 6:** Update `dist/router.json` size note in the dashboard's Panel A "router" footnote (if any) and in the spec § Honest baseline appendix.

**Exit criteria:** the duplicate-clusters report has a decision row per cluster; `dist/router.json` regenerated; telemetry replay shows zero rule-activation regressions; sentinel sample within budget; `task value` reflects the measured token delta.

**Rollback:** revert the rule-frontmatter edits; re-run `task sync && task generate-tools`; telemetry regression check confirms restoration.

## Phase 5: Tier-1 dead-rule audit (telemetry + Panel B gated)

Iterate the never-matched-rules list from Phase 3. For every tier-1 rule that did not fire in any corpus prompt: defend its existence with evidence, or move it to tier-2 (trigger-loaded only). Kernel rules and tier-2 rules are out of scope. **Council R2 (anthropic, MEDIUM) flagged "demote silently" as a trap — demotion changes router activation semantics. Both demote AND delete decisions surface as numbered-options per rule; the user decides.** The `panel_b_untouchable_rules` list from Phase 3 is a hard floor: no rule on that list is demoted or deleted in this phase, regardless of its dev-corpus match rate.

- [ ] **Step 1:** Extract the tier-1 never-matched set from `internal/bench/reports/router-telemetry/<UTC>.json`. Subtract `panel_b_untouchable_rules` — any rule on that list is automatically `keep`, no further analysis needed. For the remainder: read the rule file, check whether its triggers are too narrow (rule is correct, corpus is incomplete) or whether the rule itself is dead weight.
- [ ] **Step 2:** Write a one-paragraph defence per rule (or "no defence found") to `internal/bench/reports/router-telemetry/tier1-audit-<UTC>.md`. Each row carries: rule id, current tier, last-touched git commit, panel-B-untouchable flag, proposed verdict (`keep` / `demote-to-tier-2` / `delete`).
- [ ] **Step 3:** Surface BOTH `demote-to-tier-2` AND `delete` candidates in a numbered-options block (per `user-interaction`). The user decides per rule. No silent demotions. No silent deletions.
- [ ] **Step 4:** Apply the user-approved edits to rule frontmatter `tier:` (demotes) or remove the file (deletes). Re-run `task sync && task generate-tools && task value`.
- [ ] **Step 5 — sentinel:** Run the 3-task Track B regression sample (same shape as Phase 2 Step 4). Confirm completion ≥ 80 %. If any sentinel task fails, automatically roll back the most recent demote/delete and re-run; if it still fails, escalate to user (full-corpus re-run or revert all Phase 5 edits).
- [ ] **Step 6:** Record the surviving tier-1 set in `internal/bench/reports/router-telemetry/tier1-survivors-<UTC>.md` so the next audit cycle has a base.

**Exit criteria:** every never-matched tier-1 rule has a defence verdict; demoted and deleted rules went through the numbered-options gate; `task value` reflects the cumulative saving; sentinel sample within budget.

**Rollback:** revert tier-frontmatter edits and restore deleted files; re-run `task sync && task generate-tools`; telemetry confirms restoration.

## Phase 6: Final regression check + dashboard close-out

Lock in the cumulative wins, confirm Panel B held, archive the roadmap with honest numbers in the dashboard.

- [ ] **Step 1:** Full live Track B run — `task bench:ab:live` (13 tasks × 2 variants, same shape as the baseline). Capture under `internal/bench/reports/ab/<UTC>-ab-trackb-{with,without}.{json,md}`. This is the final Panel B regression evidence.
- [ ] **Step 2:** Re-render the dashboard — `task value`. The new `docs/value.md` carries: corrected `load` rung, post-minify router cost (or "router not in per-request context" note), post-dedup + post-audit token delta, the full live Panel B with the new numbers.
- [ ] **Step 3:** Add a one-paragraph summary to `docs/contracts/value-dashboard-spec.md` § Honest baseline appendix: "Optimisation pass 1, 2026-MM-DD: NETTO moved from +4 120 → +X tokens / request; Panel B held within budget (completion N% / selection M%). Sources: Phase 1-5 reports linked above." This is the visible audit trail.
- [ ] **Step 4:** Run `python3 scripts/lint_value_dashboard.py` to confirm structural invariants pass against the post-optimisation `latest.json`.

**Exit criteria:** new live A/B pair on disk; `docs/value.md` re-rendered with new NETTO + held Panel B; spec appendix updated with the optimisation-pass summary; lint clean.

**Rollback:** none — Phase 6 is observation-only; if it surfaces a regression, the rollback path is the phase whose change broke the metric (revert at that phase's level).

## Acceptance criteria

- NETTO token-delta in `docs/value.md` reflects the **real** kernel size (Phase 1 fix) — no longer under-reports by ~3 230 tokens.
- Cumulative measured saving from Phases 2 + 4 + 5 surfaces on the dashboard as positive (saving) rungs with `confidence: measured` and real source-report citations.
- Final live Panel B (Phase 6): completion ≥ 80%, selection ≥ 45%, no metric regresses beyond the locked budget.
- Router-telemetry corpus + report (Phase 3) exists on disk, replayable, and cited as the evidence basis for the Phase 4-5 cuts.
- Every cut that regressed Panel B beyond budget has been rolled back **inside its own phase** — the dashboard's NETTO never reflects a Panel-B-breaking change.
- `scripts/lint_value_dashboard.py` exits 0 against the new `latest.json`.
