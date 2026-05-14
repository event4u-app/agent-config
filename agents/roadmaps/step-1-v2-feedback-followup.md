---
complexity: lightweight
---

# Roadmap: v2.10.0 Audit + Council Feedback Follow-Up

> Act on the 13 findings from the 2026-05-14 v2-analysis council session by closing measurement gaps, hardening the linter, archiving dead scripts, and renaming misleading artefacts.

## Prerequisites

- [ ] Read `AGENTS.md` and the v2 audit prompt at [`agents/council-sessions/2026-05-14-v2-analysis/prompt.md`](../council-sessions/2026-05-14-v2-analysis/prompt.md)
- [ ] Read the index at [`agents/council-sessions/2026-05-14-v2-analysis/feedback/00-index.md`](../council-sessions/2026-05-14-v2-analysis/feedback/00-index.md) — every step in this roadmap traces to a numbered feedback file
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

Three council rounds (2 + 1 follow-up) on tag `2.10.0` produced 13 findings across 11 feedback files. Verdict tally: **12 × accept, 1 × accept-with-modification**. Round 3 closed the three open points (D3 CONTRIBUTING-mismatch, F5 selection-accuracy protocol, U3 time-ratio metric).

This roadmap is **work-only** — no version pins, no tag plans, no release dates. It mirrors the existing [`road-to-productization.md`](road-to-productization.md) ordering principle (cheap structural fixes first, measurement before optimisation, investigations last).

- **Feedback source:** [`agents/council-sessions/2026-05-14-v2-analysis/feedback/`](../council-sessions/2026-05-14-v2-analysis/feedback/)
- **Synthesis + verdicts:** [`agents/council-sessions/2026-05-14-v2-analysis/synthesis.md`](../council-sessions/2026-05-14-v2-analysis/synthesis.md)
- **Sibling roadmap:** [`road-to-productization.md`](road-to-productization.md) (already names some of these gaps; this roadmap operationalises them)

## Phase 1: Quick wins — cheap structural clarity

Trivial-to-medium edits that close credibility / hygiene gaps. None require new code or measurement.

- [ ] **Step 1 — CONTRIBUTING preface (D3, file [01](../council-sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md)):** Add the one-sentence preface to `CONTRIBUTING.md` that names the single-maintainer reality. Wording in the feedback file under "Round 3 resolution".
- [ ] **Step 2 — Rename "Compression" pipeline (C2, file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md)):** Pick a name that reflects the actual function (path-rewriting + source/dist split). Update `docs/architecture/compression.md` filename + content + every reference. Surfaces affected: `AGENTS.md` pointer table, scripts comments, taskfile target names if any.
- [ ] **Step 3 — Archive 9 dead migration scripts (C3, file [03](../council-sessions/2026-05-14-v2-analysis/feedback/03-migration-scripts-archival.md)):** Move the unreferenced scripts to `scripts/_archive/migration-<phase>/` with a sibling `README.md` that records *why* the script existed and *which migration it served*. Mirror the convention already used by `agents/roadmaps/archive/`.
- [ ] **Step 4 — `task ci:strict` lint gate (U2, file [06](../council-sessions/2026-05-14-v2-analysis/feedback/06-linter-as-gate.md)):** Add a Taskfile target that runs `scripts/lint.py` with WARN promoted to ERROR. Keep `task ci` unchanged so the existing flow does not break. Document the new tier in `Taskfile.yml` comments only — wider docs sync happens in Phase 3.

## Phase 2: Close the locked R3 measurement protocols

Three measurement protocols were locked by Round 3. Each has a runnable shape; each yields a numeric pass/fail this month.

- [ ] **Step 1 — Per-tool projection re-measurement (U1, file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md)):** Run the byte-reduction analysis separately on `.augment/`, `.claude/`, `.cursor/`, `.windsurfrules`. Replace the 0.45 % headline metric with per-tool figures + an explicit statement of what the pipeline does and does not optimise.
- [ ] **Step 2 — Selection-accuracy fixture set (F5 / C5, file [05](../council-sessions/2026-05-14-v2-analysis/feedback/05-router-coverage-and-selection.md)):** Build a ~50-prompt fixture covering the top-10 collision clusters surfaced by `auto-rules-overlap.json`. Each cluster gets 3 prompts (clear-A, clear-B, ambiguous). Score (a) intended-skill hit and (b) correct-cluster hit. Threshold rule: < 80 % on either → that cluster gets explicit `routes_to`.
- [ ] **Step 3 — CI-time / local-edit-time ratio (U3, file [07](../council-sessions/2026-05-14-v2-analysis/feedback/07-ci-tiering-and-overhead.md)):** Sample last 30 commits. Compute `ratio = ci_time / local_time` per change class (doc / skill / test / meta). Threshold: median > 5× → optimise that class first; < 3× across all classes → overhead acceptable. Yields a single number per change type, drives Phase 3 ordering.

## Phase 3: Structural — driven by Phase 2 numbers

Wait for Phase 2 results before sequencing. Each step references a Phase 2 output that decides whether it fires this round or stays parked.

- [ ] **Step 1 — CI tiering (F6, file [07](../council-sessions/2026-05-14-v2-analysis/feedback/07-ci-tiering-and-overhead.md)):** Implement `task ci:fast`, keep `task ci` as default, slot the `task ci:strict` from Phase 1.4 into the chain. Order tier promotion by Phase 2.3 ratio output — the change class with the highest ratio gets the cheapest tier first. Update `CONTRIBUTING.md` to document the tiers (ties back to Phase 1.1).
- [ ] **Step 2 — Project-analysis triad UX (C4, file [04](../council-sessions/2026-05-14-v2-analysis/feedback/04-project-analysis-triad-ux.md)):** Disambiguate `project-analyzer` / `project-analysis-core` / `universal-project-analysis` description fields so the host tool routes deterministically. Use Phase 2.2 fixture set to verify post-edit. No code merger — the issue is trigger surface, not body duplication.
- [ ] **Step 3 — Promote `routes_to` for failing clusters (file [05](../council-sessions/2026-05-14-v2-analysis/feedback/05-router-coverage-and-selection.md)):** For every cluster that fell below the Phase 2.2 threshold, add explicit `routes_to` and re-run the fixture set. Iterate until all clusters pass. Update router-coverage talking points to reference the fixture, not the 6.3 % figure.

## Phase 4: Cross-tool projection fidelity (U5)

Largest investigation surface, lowest-known cost, highest strategic value. Dedicated phase because it owns its own fixture work.

- [ ] **Step 1 — Per-tool behaviour fixture (file [09](../council-sessions/2026-05-14-v2-analysis/feedback/09-cross-tool-projection-fidelity.md)):** Pick 5 representative skills (kernel + tier-1 + tier-2 + persona + command). For each, define a runnable scenario whose pass/fail is observable in each consumer tool (Claude.ai, Cursor, Windsurf, Augment).
- [ ] **Step 2 — Run the fixture across all four tools.** Record per-tool pass / fail / partial. Catalogue divergences — these become the next round of bugs to file in `agents/council-sessions/` or directly into per-tool projection fixes.
- [ ] **Step 3 — Document the projection contract (file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md) sibling):** Write `docs/contracts/multi-tool-projection-fidelity.md` that names per-tool guarantees explicitly. The Phase 1.2 rename and the Phase 2.1 per-tool numbers are inputs.

## Phase 5: Governance and trajectory (long-horizon)

Items that need either time-series data or a values call. Park if Phase 1–4 burns the available bandwidth.

- [ ] **Step 1 — Roadmap commitment-history measurement (U4, file [08](../council-sessions/2026-05-14-v2-analysis/feedback/08-roadmap-trajectory.md)):** Walk `agents/roadmaps/archive/`. For each archived roadmap, compute checkbox-completion ratio at archival. Output: a one-line trajectory metric per roadmap, surfaced in the dashboard or in `road-to-productization.md`.
- [ ] **Step 2 — Architectural-consensus mechanism (C1, file [01](../council-sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md)):** Pick one of: (a) ADRs that name trade-offs explicitly for every new skill cluster, (b) automated ontology lint that flags new skills colliding with existing ones, (c) external review per N skills. The choice is a values call — record it in an ADR.
- [ ] **Step 3 — Paired qualitative audit (D1, file [10](../council-sessions/2026-05-14-v2-analysis/feedback/10-audit-methodology.md)):** Decide whether to commission a second-pass UX-style review of the v2 audit. If yes, define scope explicitly so the qualitative pass complements rather than replays the quantitative one.

## Acceptance Criteria

- [ ] All four Phase 1 steps merged; `task ci:strict` exists and gates release tags
- [ ] Phase 2 yields three numeric outputs (per-tool projection bytes, selection-accuracy %, CI-time ratio per change class) — recorded in this file or in a sibling artefact
- [ ] Phase 3 steps fire only after the Phase 2 numbers exist; ordering matches the data
- [ ] Phase 4 produces a cross-tool fidelity contract document and a logged divergence list
- [ ] Phase 5 either burns down or is explicitly parked with a rationale recorded in this file
- [ ] All quality gates pass (`task ci`, plus `task ci:strict` once Phase 1.4 lands)

## Notes

- **Cost ordering rationale:** Phase 1 unblocks credibility today; Phase 2 produces the numbers Phase 3 needs; Phase 3 spends the structural-overhead budget where it actually hurts; Phase 4 is the highest-leverage investigation; Phase 5 is governance that can wait.
- **Out of scope:** No persona / judge / release-tempo work — the council explicitly retracted those concerns. Do not re-open without new evidence.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmap:** Some Phase 1–3 work overlaps `road-to-productization.md`. When in doubt, pin the deeper detail here and reference from the parent.
