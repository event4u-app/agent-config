---
complexity: lightweight
---

# Roadmap: Corpus expansion → evidence-based tier-1 cuts

> Widen the bench corpora to exercise the rule trigger surfaces the current bench misses (git ops, roadmap touches, autonomy intents, slash-commands, framework-specific paths), replay router telemetry against the widened set, and use the new evidence to make per-rule cut decisions that survive a real Panel B regression check.

## Prerequisites

- [ ] PR #280 (`feat/road-to-value-dashboard-netto-cuts`) is **merged**. This roadmap builds on its tooling (`router_telemetry.py`, `panel_b_untouchable_rules`, the `load_rung_from_router()` measurement floor) and its honest baseline (NETTO +8 254 tok / +€22.78 per 1k req at Sonnet pricing).
- [ ] Read the closed audit `internal/bench/reports/router-telemetry/tier1-audit-2026-05-28.md` — the 20 never-matched tier-1 rules + their classification (`bench-blind` / `framework-routing` / `tool-routing` / `cluster-head` / `measurement-window`) is the input for which corpus surface each one needs.
- [ ] Read `docs/contracts/benchmark-corpus-spec.md` — the existing per-prompt schema; corpus extensions inherit it.
- [ ] Read `docs/contracts/rule-router.md` — the kernel / tier-1 / tier-2 / profile semantics. **Kernel rules are out of scope for cuts** (locked decision from PR #280).
- [ ] Confirm rules that gate this work:
  - `commit-policy` — no commit steps written into this roadmap unsolicited.
  - `roadmap-progress-sync` — every checkbox flip regenerates `agents/roadmaps-progress.md` in the same response.
  - `minimal-safe-diff` — corpus extensions are additive; do not rewrite the existing `ab-trackb.yaml` / `corpus-dev.yaml` / `corpus-non-dev.yaml`.
  - `direct-answers` (no invented facts) — every saved-token claim cites the telemetry report that proved the rule is dead.
  - `frugality-charter` — cuts must defend a measured per-request saving, not "hygiene".

## Context

The 2026-05-28 tier-1 audit (Phase 5 of `road-to-value-dashboard-netto-cuts`) closed with zero cuts because **the three bench corpora (Track B, dev, non-dev) failed to exercise the trigger surfaces of 20 tier-1 rules**. The finding was not "20 dead rules"; it was "the bench is blind to 20 rule families". The roadmap accepted that verdict and deferred cuts until the bench widens. This roadmap is that widening.

Two passes are scoped:

1. **Pass A (this roadmap):** author the corpus extension, replay telemetry, run the second tier-1 audit against real activations, apply the cuts that survive the regression check.
2. **Pass B (deferred — own roadmap if Pass A surfaces opportunity):** if the audit shows kernel rule bodies are bloated *and* condensation gains are exhausted, draft a "kernel body refactor → router-pointer + skill body" pass. **Not committed to in this roadmap.** Pass B opening criteria are tightened to two independent gates (per Round 3 Council, anthropic HIGH): the rule's `activation_rate < 30 % of addressable tasks` (denominator = the subset of corpus tasks whose `intended_triggers` could plausibly hit this rule) AND `absolute_activations < 3` AND `body > 3 000 chars`. Edge case the loose threshold permitted (2/5 addressable = 40 % survives) is now closed by the absolute floor.

A third Council round (`agents/runtime/council/responses/corpus-expansion-evidence-based-cuts-roadmap-review.json`, 2026-05-29, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, $0.08 actual) cross-checked this roadmap pre-execution. Three findings folded into the phases below: tightened Phase 4 pareto thresholds; Phase 3 telemetry adds `unintended_activations` per task (inter-rule conflict detection — the corpus-author's `intended_triggers` is a prediction, not a closure); Phase 1 adds a state-fixture-feasibility scan for the 5 state-bound rules (don't commit to building fixtures — just record if any are architecturally feasible).

- **Source:** Chat-thread 2026-05-29 (post-PR-#280); three council sessions referenced inline.
- **Extends:** `agents/roadmaps/archive/road-to-value-dashboard-netto-cuts.md` (consumes its tooling + measurement floor; extends the corpus axis it explicitly deferred).
- **Block-on:** PR #280 merge.

## Non-goals / honesty constraints

- **No kernel-rule body cuts in this pass.** Kernel cuts are deferred to Pass B if and only if the audit + body-size analysis below open the door — and only as a separate roadmap with its own council pass.
- **No marketing-shape corpus.** Each new corpus task is a real-shape scenario the agent must handle; we do not "teach to the test". A task that exists only to activate one rule is a cheat and is excluded.
- **No re-running Track B live for the corpus-authoring phases.** The cost-bearing Track B re-run waits for the final regression check in Phase 6; intermediate verification uses pure-local telemetry replay (zero API spend).
- **Regression budget (locked, inherited from PR #280):** completion ≥ 80 % (vs 84.6 % baseline = 4.6pp tolerance); selection ≥ 45 % (vs 50 % = 5pp tolerance). Any cut that breaches either rolls back at its phase.
- **Corpus-author honesty floor:** every task in the extension carries a clear `intended_triggers: [...]` field — the rules the author expected to activate. The telemetry replay verifies match; mismatch surfaces as a finding (task is too narrow / too broad), never silently passes.

## Phase 1: Corpus-surface inventory + decision matrix

Lock which uncovered rule surfaces actually need new corpus tasks vs. which are state-dependent and impossible to corpus-test. The audit's `measurement-window` classification (5 rules — `context-hygiene`, `onboarding-gate`, `fast-path-marker-visibility`, `low-impact-corpus-privacy-floor`, `autonomous-execution`) flags the latter; they stay corpus-unreachable by design.

- [ ] **Step 1:** From the audit, build a per-rule table: `(rule_id, classification, intended_surface, corpus_addressable?)`. Save as `agents/roadmaps/_planning/corpus-surface-inventory.md` (gitignored draft) — keep it under the active roadmap dir so the linter sees it but does not count it as a roadmap.
- [ ] **Step 2:** For each `corpus_addressable: yes` row (expected ~15 rules), name the minimum task shape that would activate it: prompt text, optional `seed_files`, optional `command`, optional `open_files`. One row per rule.
- [ ] **Step 3:** Group into corpus extensions by surface family: `git-surface` (commit, PR, branch, attribution-footer, decorative-emoji), `roadmap-ops` (roadmap touches, dashboard sync, transient-references), `framework-routing` (Symfony, copilot, devcontainer, docker), `slash-commands` (command-suggestion-policy, slash-command-routing-policy, artifact-engagement-recording), `agent-docs-edits` (augment-source-of-truth, skill-quality, telegraph-speak path triggers). Aim for ≤ 5 extension files, ≤ 8 tasks each (40 tasks total ceiling).
- [ ] **Step 4:** For each `corpus_addressable: no` row, write a one-sentence defence (why it's structurally impossible to corpus-test). These rules carry a permanent `keep-pending-state-trigger` verdict; future audits skip them entirely.
- [ ] **Step 5 — state-fixture feasibility scan (Council R3, openai):** For each state-bound rule, record whether a deterministic fixture could plausibly drive the trigger condition (e.g. `onboarding-gate` — a first-turn flag fixture; `context-hygiene` — a turn-count fixture). One-line verdict per rule: `feasible-fixture-exists` / `requires-runtime-state` / `not-worth-building`. **No commitment to build fixtures in this roadmap** — output is an informational input for a future targeted roadmap. Save in the same `corpus-surface-inventory.md`.

**Exit criteria:** `corpus-surface-inventory.md` exists with every audit row classified `addressable` or `state-bound`; each addressable row names one task shape; each state-bound row carries the feasibility scan verdict; extension groupings ≤ 5 files / ≤ 8 tasks each.

**Rollback:** delete `corpus-surface-inventory.md`.

## Phase 2: Author the corpus extensions

Write the new corpus files. Pure-local work; no API spend. Each file inherits `benchmark-corpus-spec.md`'s schema + adds the new `intended_triggers` field.

- [ ] **Step 1:** Extend `docs/contracts/benchmark-corpus-spec.md` schema with the optional `intended_triggers: [rule_id, ...]` field. Document its meaning: "the rules the corpus author expects to activate; the telemetry replay verifies match and surfaces drift". Add a lint check to `scripts/lint_bench_corpus.py` for unknown rule ids.
- [ ] **Step 2:** Author `internal/bench/corpora/router-coverage/git-surface.yaml` — tasks that exercise commit / PR / branch / emoji-in-git-surfaces. ≤ 8 tasks, each carries `intended_triggers`.
- [ ] **Step 3:** Author `internal/bench/corpora/router-coverage/roadmap-ops.yaml` — tasks that exercise roadmap touches, dashboard regen, no-roadmap-references. ≤ 8 tasks.
- [ ] **Step 4:** Author `internal/bench/corpora/router-coverage/framework-routing.yaml` — tasks for Symfony / copilot / devcontainer / docker disambiguation. ≤ 8 tasks.
- [ ] **Step 5:** Author `internal/bench/corpora/router-coverage/slash-commands.yaml` + `internal/bench/corpora/router-coverage/agent-docs-edits.yaml` — covering the remaining addressable surfaces. ≤ 8 tasks each.
- [ ] **Step 6:** Run `python3 scripts/lint_bench_corpus.py internal/bench/corpora/router-coverage/*.yaml` — confirm schema + `intended_triggers` invariants pass.

**Exit criteria:** ≤ 5 new corpus files under `internal/bench/corpora/router-coverage/`, all lint-green; each task carries `intended_triggers`; cumulative new task count ≤ 40.

**Rollback:** delete the new corpus dir.

## Phase 3: Telemetry replay against the widened corpus

Re-run `router_telemetry.py` with the new corpora added to the replay set. Compare per-rule activation counts before / after; surface the drift.

- [ ] **Step 1:** Extend `scripts/router_telemetry.py` to load corpora from a manifest list (so adding files doesn't require editing the script). Default manifest = the original three + the five new files.
- [ ] **Step 2:** Add an `intended_vs_observed_match` field to the per-corpus summary: for each task, the diff between `intended_triggers` (from the corpus YAML) and actually activated rules. This is the corpus-author honesty floor — drift surfaces here, not silently.
- [ ] **Step 3 — inter-rule conflict detection (Council R3, anthropic HIGH):** Add `unintended_activations` per task: `rules_fired - intended_triggers`. Aggregate into a top-level `unintended_activation_histogram` block — rule ids sorted by frequency of unintended activation. High-frequency unintended rules reveal trigger-condition overlap (e.g. a git-surface task that also fires markdown-lint because it touches `.md`). This catches the blind spot the corpus-author's prediction cannot close.
- [ ] **Step 4:** Run `task value:telemetry:replay` against the widened manifest. The new `internal/bench/reports/router-telemetry/<UTC>.json` carries: updated `per_rule_activations` (now hopefully covering most of the 20 previously-never-matched tier-1 rules), updated `never_matched_tier1`, updated `panel_b_untouchable_rules` (still based on Track B only — the new corpora are not Panel B sources), the new `unintended_activation_histogram`.
- [ ] **Step 5:** Write a one-page diff report `internal/bench/reports/router-telemetry/widened-corpus-diff-<UTC>.md`: "before pass 1: 20 never-matched; after corpus expansion: N never-matched; the N − 20 rules now have measured activations. Top-5 unintended activators: [...]". The unintended-activator list is a finding, not a blocker — it informs Phase 4's audit.

**Exit criteria:** new telemetry report exists; `intended_vs_observed_match` block populated for every new task; `unintended_activation_histogram` populated; the never-matched-tier-1 set has shrunk meaningfully (target: ≥ 10 newly-activated rules, exact number reported in the diff doc).

**Rollback:** revert `router_telemetry.py` manifest change; remove the new report.

## Phase 4: Second tier-1 audit with the new evidence

Re-run the per-rule defence analysis from `tier1-audit-2026-05-28.md`, now informed by the new activation data. Rules that activate on ≥ 1 task in the widened corpus are `keep` regardless of count — frequency-of-activation is a different lens. Rules that still never match across the widened corpus are the real cut candidates.

- [ ] **Step 1:** Extract the new never-matched-tier-1 set from the Phase 3 report. Subtract the `state-bound` rules from Phase 1 Step 4 (they're auto-kept). The remainder is the actual cut-candidate set.
- [ ] **Step 2:** For each candidate: write a one-paragraph defence (read the rule body, find the cited use-case in the codebase, identify whether the trigger surface is too narrow vs. the rule is genuinely dead). Verdicts: `keep` (defence found), `demote-to-tier-2` (defence weak), `delete` (no defence; routes_to redundant with another rule).
- [ ] **Step 3:** Write the full updated audit report `internal/bench/reports/router-telemetry/tier1-audit-pass2-<UTC>.md`. Mirror the pass-1 audit's table layout. Surface BOTH `demote-to-tier-2` AND `delete` candidates as numbered options (per `user-interaction`) — no silent edits.
- [ ] **Step 4 — pareto with tightened thresholds (Council R3, anthropic HIGH):** Build a body-size analysis: for each surviving tier-1 rule, record `(rule_id, chars, addressable_tasks, absolute_activations, activation_rate)`. **`addressable_tasks`** = the subset of corpus tasks whose `intended_triggers` could plausibly hit this rule (read from Phase 2's authoring). **`activation_rate`** = `absolute_activations / addressable_tasks`. A rule qualifies as a **Pass B kernel-body refactor candidate** only when ALL THREE hold: `activation_rate < 30 %` AND `absolute_activations < 3` AND `body > 3 000 chars`. The absolute floor closes the 2/5-addressable = 40 % edge case the loose threshold permitted. Save as `internal/bench/reports/router-telemetry/tier1-size-activation-pareto.md` — informational input to Pass B.

**Exit criteria:** updated audit doc with verdict per candidate rule; cut-candidates surfaced as user-decision options (autonomous decision allowed only when the rule's defence is `no defence found` AND its `absolute_activations` across all 8 corpora is 0); Pass B input doc exists with all four pareto fields per surviving rule.

**Rollback:** the audit is text-only — no edits to revert. Discard the report.

## Phase 5: Apply the surviving cuts

Implement the user-approved (or autonomously-approved per Phase 4 Step 3) cuts. Each cut is its own commit; rollback granularity is per-rule, not per-phase.

- [ ] **Step 1:** For each `demote-to-tier-2` row the user approved: edit the rule's frontmatter `tier:` from `tier-1` to `tier-2`. Re-run `task sync && task generate-tools` so `dist/router.json` regenerates.
- [ ] **Step 2:** For each `delete` row the user approved: remove the rule file from `.agent-src.uncondensed/rules/`. Re-run `task sync && task generate-tools`. **Verify no skill or other rule references the deleted rule** before commit — use `grep -r "<rule_id>" .agent-src.uncondensed/ docs/` and abort on any hit.
- [ ] **Step 3:** Replay the Phase 3 telemetry against the new router. The output `internal/bench/reports/router-telemetry/post-cuts-<UTC>.json` records: zero rule-activation regressions for the surviving rules across the full widened corpus.
- [ ] **Step 4 — sentinel:** Run the 3-task Track B regression sample (`scripts/bench_ab_task_runner.py --variant both --mode live` with a `--task-ids` filter — extend the runner with that flag if missing). Confirm completion ≥ 80 % and selection-relevant rules still fire. ~$1-2 spend.

**Exit criteria:** every approved cut is on disk; `dist/router.json` regenerated; telemetry post-cuts shows zero regressions for surviving rules; sentinel sample within regression budget.

**Rollback:** revert the per-rule edits; re-run `task sync && task generate-tools`; telemetry replay confirms restoration.

## Phase 6: Final regression + close-out

Lock in the measured wins, confirm Panel B held against the full live corpus, archive the roadmap with honest numbers.

- [ ] **Step 1:** Full live Track B run — `task bench:ab:live` (13 tasks × 2 variants). Capture under `internal/bench/reports/ab/<UTC>-ab-trackb-{with,without}.{json,md}`. This is the final Panel B regression evidence; cost-bearing (~$10).
- [ ] **Step 2:** Re-render the dashboard — `task value`. The new `docs/value.md` reflects: post-cut `load` rung, post-cut router metadata, the full live Panel B with the new numbers.
- [ ] **Step 3:** Add a paragraph to `docs/contracts/value-dashboard-spec.md` § Honest baseline appendix: "Optimisation pass 2, 2026-MM-DD: NETTO moved from +8 254 → +X tokens / request; Panel B: completion N% / selection M% (within budget). Sources: Phase 1-5 reports linked above. Pass B (kernel body refactor) status: [opened / deferred] based on the pareto analysis."
- [ ] **Step 4:** Run `python3 scripts/lint_value_dashboard.py` against the new `latest.json` — confirm structural invariants pass.

**Exit criteria:** new live A/B pair on disk; `docs/value.md` reflects the cuts; spec appendix updated; lint clean; the Pass B decision (open / defer) is recorded.

**Rollback:** Phase 6 is observation-only. Regressions detected here → roll back the responsible cut(s) at Phase 5's per-rule level.

## Acceptance criteria

- The widened corpus (≤ 5 new files, ≤ 40 new tasks total) activates at least 10 of the 20 previously-never-matched tier-1 rules — the corpus-blindness finding is structurally resolved.
- Every cut applied in Phase 5 cites the telemetry report that proved the rule never activates in the widened corpus *and* the user-decision (or autonomous-decision criteria) that approved it.
- Final live Panel B (Phase 6) holds within the locked regression budget (completion ≥ 80 %, selection ≥ 45 %).
- The dashboard's NETTO reflects the measured saving (each surviving cut's per-request token contribution is real, not estimated).
- The Pass B input doc (`tier1-size-activation-pareto.md`) exists and the close-out names whether Pass B is opened, deferred with reason, or closed (no candidates).
- `scripts/lint_value_dashboard.py` exits 0 against the new `latest.json`.
