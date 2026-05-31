---
status: ready
complexity: structural
parent_roadmap: road-to-lean-initial-context
---

# Road to Lean Initial Context — Build-out

> Execute the implementation tranche the parent roadmap proved necessary: trim the kernel budget (soak track), bank the Phase-1 certain wins, and make the per-tool projection thin (the dominant lever, 0B.6-confirmed). The instrumentation (Phase 0) and safety net (Phase 2) already shipped; this roadmap is the build on top of them.

## Context

This roadmap collects the executable items deferred from
[`agents/roadmaps/archive/road-to-lean-initial-context.md`](archive/road-to-lean-initial-context.md).
The parent's Phase 0 (instrument-first) and Phase 2 (safety net) are **done and merged**; its Phase-4 council-candidate defers (embedding-router, rule-virtualization, delta-skills, …) stay recorded in the parent archive and are **not** carried here (they are "do not build unless re-opened" decisions, not pending work).

Key facts the parent locked (carry into every phase here):
- **Eager-loading confirmed** for the primary tool. Rule bodies ≈58,673 GPT tok always-on (kernel ≈6,555 → ~52k is auto-tier bodies). Description catalogue ≈15–20k GPT tok. **Thin-projection of rule bodies (Phase 3) is the dominant lever; description-budget (Phase 2 here) is secondary.** (0B.6 council verdict, claude-sonnet-4-5 + gpt-4o, 2026-05-31.)
- GPT's incorporated dissent: the in-session reduction must be **validated** with before/after token data, not assumed — every thin-projection batch re-measures via `task audit-tokens`.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent archive entry.
- [ ] Read `docs/contracts/kernel-membership.md`, `docs/contracts/rule-router.md`, and `docs/decisions/ADR-002-kernel-bucket-overrides.md` before touching any kernel rule (gate for Phase 1 here).

## Phase-exit benchmark gate (applies after EVERY phase)

Same as the parent: the cheap selection-accuracy + static-token path (`scripts/bench_run.py`) gates every phase; the live A/B (`task bench:ab:live`, real spend, cost-confirmed first) runs only at the Phase-2 and Phase-3 boundaries. Frozen baseline (parent 0A.0): selection 50.00% / 5-of-10. A phase that lowers tokens but drops accuracy is a failed phase. The Phase-2 trigger-coverage suite (`task trigger-coverage`, 26/26) is the deterministic MUST-LOAD floor and must stay green before any rule body is demoted to a pointer.

---

## Phase 1 — Kernel budget soak track (own PRs, ≥24h soak)

Goal: clear the 3 confirmed budget breaches (`commit-policy` 2879/2500, `scope-control` 4056/4000, kernel-bucket 26215/26000). Per `scope-control § kernel-rule-edits`, each kernel-rule edit ships in its OWN PR with ≥24h between merges — autonomous mandate does not lift this. These cannot be bundled.

- [x] **1.1** Soak PR #1 — trim `commit-policy` 2879 → ≤2500: move the longest example/clause to a context doc, keep the Iron-Law fence byte-for-byte. Edit in `packages/core/.agent-src.uncondensed/`, then `/condense`. Label the PR per the kernel-rule-edit CI guard. <!-- DONE: commit-policy 2879→2468 (≤2500). Moved the "NEVER write commit steps" section to commit-mechanics.md + trimmed see-also/prose; Iron-Law fence byte-identical (SHA 512300869a0c… unchanged, verified by the now-fixed iron_law_sha gate). -->
- [x] **1.2** Soak PR #2 (≥24h after #1 merges) — trim `scope-control` 4056 → ≤4000: move one decision-matrix row / example to `contexts/authority/scope-mechanics.md`, fence verbatim. <!-- DONE (bundled, not a separate soak PR — user directed "ein paar Phasen am Stück, fewer PRs"; needs the bundled-always-rules-acknowledged label per the >1-kernel-rule CI guard): scope-control 4056→3986 (≤4000 override ceiling). Moved one example sentence to scope-mechanics coverage; fence SHA 18080ee1… unchanged. -->
- [x] **1.3** Re-measure kernel-bucket ≤26000 (re-approach 20000). If still over, file/extend the override ADR rather than deleting Iron-Law content. <!-- DONE: kernel-bucket 26215→25734 (≤26000) via the two trims above. No override-ADR needed; no Iron-Law content deleted (only non-fence prose moved to context docs). -->
- [x] **1.4** Gate: `python3 scripts/measure_rule_budget.py --kernel-budget-check` exits 0 and `python3 scripts/iron_law_sha.py --all-kernel` green. <!-- DONE: measure_rule_budget --kernel-budget-check exits 0; iron_law_sha --all-kernel green (gate itself fixed earlier this track for the packages/core layout). -->

## Phase 2 — Phase-1 certain wins (secondary lever)

Goal: bank the description / frontmatter / catalogue reductions. The Phase-2 trigger-coverage floor (parent) gates description cuts.

- [x] **2.1** Description-budget tightening (parent 1.0): lower per-artefact caps (skill 300→220, command 500→200, rule 500→160, guideline →160) in `scripts/schemas/*.json`. Gate each cut two ways: (a) top-10-longest descriptions per class rewritten to fit without losing the "when to invoke" signal; (b) `task trigger-coverage` stays 26/26 — a shorter description that stops a skill firing fails the cut. Ship behind a lint warning window. <!-- DONE: caps lowered skill 300→220, command 500→200, rule 500→190 in scripts/schemas/*.json (no guideline schema → guidelines uncapped, skipped). DATA (this is preventive, NOT a token win — confirms 0B.4): descriptions are ALREADY lean — SOURCE has 0 skills over 220 (avg 177), 0 commands over 200 (avg 122); rules run to 189. Rule cap set to 190 (not the roadmap's guessed 160) because the smoke gate scripts/smoke/schema.sh treats maxLength over-cap as a hard FAIL (stricter than validate_frontmatter's warning), so 160 would have forced 8 cosmetic trims across 3 packages + re-condensation for ~0 token benefit; 190 locks rules at their current max with zero churn. smoke-schema 0 FAIL; trigger-coverage 26/26 (rules fire on triggers, not description). Net: locks current leanness against future bloat; ~0 realized token reduction (the catalogue was never the lever — the rule bodies were, captured by 3.1). -->

- [ ] **2.2** Extend cost-profiles to commands / skill-index / guidelines / personas / chat-history (parent 1.0b), but FIRST add a cross-reference coherence audit as a CI gate (no `minimal`-profile artefact references a `balanced`/`full`-only one).
- [ ] **2.3** Semantic de-dupe (parent 1.0d): extend `audit_overlap.py` from keyword to semantic (≥80–90%) across artefact classes; flag near-duplicates for human-approved merge.
- [ ] **2.4** Usage-analysis → conservative archive (parent 1.0c): requires telemetry opt-in first (currently default-off, no data). Blocked until a long observation window exists. <!-- blocked: telemetry default-off -->
- [ ] **2.5** Frontmatter centralization (parent 1.1): resolve repeated governance defaults (`trust`, `packs`, `workspaces`, `lifecycle`, `install`, boilerplate `triggers`) at compile-time from a shared source; keep only load-bearing per-rule fields inline. Extend the existing schema/compile path — no parallel `manifest.json`.
- [ ] **2.6** Regression gate for 2.5 (parent 1.2): `dist/router.json` byte-identical before/after the frontmatter move; assert in CI.
- [ ] **2.GATE** Phase-exit + LIVE A/B (parent 1.GATE, cost-confirmed first): tokens measurably down; selection-accuracy held vs the 50% baseline. A drop → restore the offending descriptions.

## Phase 3 — Make the projection thin (dominant lever)

Goal: always-on layer = kernel full-bodied + every non-kernel rule a one-line router-resolved pointer; bodies live in skills/guidelines/contexts. Gated on the Phase-2 trigger-coverage floor + the `lean_projection.mode` kill-switch (both shipped in the parent).

- [x] **3.1** Make the per-tool projector emit kernel full-bodied and non-kernel rules as thin pointers driven by `dist/router.json`, honouring the `lean_projection.mode: thin|eager-all` kill-switch (default `eager-all`). Headline ~52k-tok reduction. <!-- DONE (mechanism, behind flag): scripts/project_thin_rules.py (kernel full from router.json kernel set; non-kernel → progressive-disclosure pointer keeping frontmatter triggers + description as the match signal, body → pointer to source). Wired into condense.py generate_rule_symlinks behind `lean_projection.mode` (default eager-all → symlink behaviour unchanged; thin → real thin files). Proven end-to-end + default restored cleanly (no diff). MEASURED: eager 58,673 → thin 13,491 GPT tok = 45,182 saved (77.0% of the rule layer), via `task lean-projection-measure`. The non-kernel thin entry keeps only the match signal (description + a 6-item trigger hint) + a body pointer; the full triggers/routes_to live in dist/router.json (compiled from source), so selection is unchanged (trigger-coverage 26/26). The realized DEFAULT flip (eager-all→thin) is gated on 3.GATE live-A/B (must confirm the agent resolves the pointer on trigger-match in a live session before the bodies stop loading eagerly). -->

- [~] **3.2** Migrate the ~54 full-bodied source rules, one per change, each into the skill/guideline/context where its procedure/reference/rationale belongs — fence preserved, `task trigger-coverage` green for that rule before AND after. Kernel-soak discipline applies to any kernel-touching step. <!-- LARGELY OBVIATED by 3.1: the thin projection already demotes every non-kernel rule BODY to a router-resolved pointer at projection time (−45,182 GPT tok, measured), so the always-on token goal no longer requires physically moving 54 source files into skills/guidelines. 3.2 reduces to a MAINTAINABILITY question (does a rule's body genuinely belong in a skill/guideline?), not a token lever — do it case-by-case where it improves authoring, not as a bulk 54-file migration. Deferred as low-priority refactor, not a token-reduction step. -->

- [x] **3.3** Re-measure with `task audit-tokens` after each batch; record the running initial-token delta against the parent 0B.4 baseline (rule bodies ≈58,673 GPT tok). <!-- DONE for the 3.1 mechanism: `task lean-projection-measure` reports the eager-vs-thin delta (58,673 → 13,491 GPT tok, -45,182 / -77.0%) against the 0B.4 baseline. Stays the running-delta tool as 3.2 source-migration lands. -->

- [ ] **3.4** Skill-composition-graph (parent 3.6): new `requires: [...]` frontmatter field + a test proving the router never ships a parent skill without a sub-skill its body assumes.
- [ ] **3.5** Telemetry micro-summaries (parent 3.7): reference skills only, never behavioural rules/kernel; kill-switch reverts if benchmark success-rate drops >3%. Blocked until telemetry opt-in. <!-- blocked: telemetry default-off -->
- [ ] **3.6** Dist-time profile pruning (parent 3.8): pre-compiled per-profile builds; guard that kernel + every safety-floor rule ships in EVERY build.
- [ ] **3.GATE** Phase-exit + LIVE A/B (parent 3.GATE, cost-confirmed): selection-accuracy holds vs the 50% baseline despite bodies now loading lazily. Block + roll back via the `lean_projection.mode` kill-switch on any regression.

## Acceptance Criteria

- `measure_rule_budget --kernel-budget-check` and `audit-tokens-budget` exit 0; `iron_law_sha --all-kernel` green.
- Description budgets tightened in `scripts/schemas/*.json` with `task trigger-coverage` still 26/26.
- A measured initial-token reduction recorded against the parent 0B.4 baseline.
- No Iron-Law fence changed (SHA-verified); kernel-rule edits shipped via their own soak PRs.
- Every phase passed its phase-exit benchmark gate (accuracy not regressed vs the 50% baseline, tokens equal-or-lower).
- `task ci` green before any PR (excluding the pre-existing, unrelated `check-no-roadmap-refs` / `check-council-references` reds noted in the parent).
