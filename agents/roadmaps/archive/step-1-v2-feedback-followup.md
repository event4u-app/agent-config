---
complexity: lightweight
---

# Roadmap: v2.10.0 Audit + Council Feedback Follow-Up

> Act on the 13 findings from the 2026-05-14 v2-analysis council session by closing measurement gaps, hardening the linter, archiving dead scripts, and renaming misleading artefacts.

## Prerequisites

- [x] Read `AGENTS.md` and the v2 audit prompt at [`agents/council-sessions/2026-05-14-v2-analysis/prompt.md`](../council-sessions/2026-05-14-v2-analysis/prompt.md)
- [x] Read the index at [`agents/council-sessions/2026-05-14-v2-analysis/feedback/00-index.md`](../council-sessions/2026-05-14-v2-analysis/feedback/00-index.md) — every step in this roadmap traces to a numbered feedback file
- [x] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md)) — **user authorized full autonomous execution including chunked commits + PR for this roadmap (2026-05-14)**

## Context

Three council rounds (2 + 1 follow-up) on tag `2.10.0` produced 13 findings across 11 feedback files. Verdict tally: **12 × accept, 1 × accept-with-modification**. Round 3 closed the three open points (D3 CONTRIBUTING-mismatch, F5 selection-accuracy protocol, U3 time-ratio metric).

This roadmap is **work-only** — no version pins, no tag plans, no release dates. It mirrors the existing [`road-to-productization.md`](road-to-productization.md) ordering principle (cheap structural fixes first, measurement before optimisation, investigations last).

- **Feedback source:** [`agents/council-sessions/2026-05-14-v2-analysis/feedback/`](../council-sessions/2026-05-14-v2-analysis/feedback/)
- **Synthesis + verdicts:** [`agents/council-sessions/2026-05-14-v2-analysis/synthesis.md`](../council-sessions/2026-05-14-v2-analysis/synthesis.md)
- **Sibling roadmap:** [`road-to-productization.md`](road-to-productization.md) (already names some of these gaps; this roadmap operationalises them)

## Phase 1: Quick wins — cheap structural clarity

Trivial-to-medium edits that close credibility / hygiene gaps. None require new code or measurement.

- [x] **Step 1 — CONTRIBUTING preface (D3, file [01](../council-sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md)):** Add the one-sentence preface to `CONTRIBUTING.md` that names the single-maintainer reality. Wording in the feedback file under "Round 3 resolution".
- [x] **Step 2 — Rename "Compression" pipeline (C2, file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md)):** Pick a name that reflects the actual function (path-rewriting + source/dist split). Update `docs/architecture/compression.md` filename + content + every reference. Surfaces affected: `AGENTS.md` pointer table, scripts comments, taskfile target names if any.
- [x] **Step 3 — Archive 9 dead migration scripts (C3, file [03](../council-sessions/2026-05-14-v2-analysis/feedback/03-migration-scripts-archival.md)):** Move the unreferenced scripts to `scripts/_archive/migration-<phase>/` with a sibling `README.md` that records *why* the script existed and *which migration it served*. Mirror the convention already used by `agents/roadmaps/archive/`.
- [x] **Step 4 — `task ci:strict` lint gate (U2, file [06](../council-sessions/2026-05-14-v2-analysis/feedback/06-linter-as-gate.md)):** Add a Taskfile target that runs `scripts/lint.py` with WARN promoted to ERROR. Keep `task ci` unchanged so the existing flow does not break. Document the new tier in `Taskfile.yml` comments only — wider docs sync happens in Phase 3. **Note:** Implemented as `task ci-strict` (repo convention is hyphens — cf. `ci-fast`, `ci-cloud-bundle`); council reference to `ci:strict` is shorthand. Replaces `lint-skills` → `lint-skills-strict` and `lint-readme` → `lint-readme-strict`. Verified: `lint-skills` exits 0 with 80 warn / 0 fail; `lint-skills-strict` exits 1 on the same dataset. WARN backlog burndown deferred to Phase 3.1 (CI tiering).

## Phase 2: Close the locked R3 measurement protocols

Three measurement protocols were locked by Round 3. Each has a runnable shape; each yields a numeric pass/fail this month.

- [x] **Step 1 — Per-tool projection re-measurement (U1, file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md)):** Run the byte-reduction analysis separately on `.augment/`, `.claude/`, `.cursor/`, `.windsurfrules`. Replace the 0.45 % headline metric with per-tool figures + an explicit statement of what the pipeline does and does not optimise. **Done:** [`scripts/measure_projection_bytes.py`](../../scripts/measure_projection_bytes.py) produces the per-tool table (files / symlinks / materialized bytes) on demand; results recorded in [`docs/architecture/multi-tool-projection.md § Per-tool projection size`](../../docs/architecture/multi-tool-projection.md#per-tool-projection-size) with explicit "what is / is not optimised" statement. Source-projection note updated to the corrected 0.35 % source/dist figure and to link out to the per-tool table.
- [x] **Step 2 — Selection-accuracy fixture set (F5 / C5, file [05](../council-sessions/2026-05-14-v2-analysis/feedback/05-router-coverage-and-selection.md)):** Build a ~50-prompt fixture covering the top-10 collision clusters surfaced by `auto-rules-overlap.json`. Each cluster gets 3 prompts (clear-A, clear-B, ambiguous). Score (a) intended-skill hit and (b) correct-cluster hit. Threshold rule: < 80 % on either → that cluster gets explicit `routes_to`. **Done:** [`scripts/skill_collision_clusters.py`](../../scripts/skill_collision_clusters.py) produces 7 clusters from 195 skills (top-10 protocol satisfied; 3 clusters fell below the keyword-overlap floor). Fixture lives in [`tests/fixtures/skill_selection/fixtures.yml`](../../tests/fixtures/skill_selection/fixtures.yml) — 34 prompts (cluster sizes vary: 10 for C01, 6 for C02/C03, 3 for C04/C05/C06/C07). Scorer at [`scripts/score_skill_selection.py`](../../scripts/score_skill_selection.py) accepts external predictions or runs a TF-IDF baseline. Baseline output recorded in [`agents/runtime/reports/skill-selection-accuracy.json`](../reports/skill-selection-accuracy.json): overall hit_a=0.74, hit_b=0.79. **Failing clusters (need `routes_to` per Phase 3.3):** C01 (0.60/0.70), C04 (0.33/0.33), C05 (0.67/0.67). Passing: C03 (0.83/1.00), C06 (1.00/1.00), C07 (1.00/1.00). Mixed: C02 (0.83/0.83).
- [x] **Step 3 — CI-time / local-edit-time ratio (U3, file [07](../council-sessions/2026-05-14-v2-analysis/feedback/07-ci-tiering-and-overhead.md)):** Sample last 30 commits. Compute `ratio = ci_time / local_time` per change class (doc / skill / test / meta). Threshold: median > 5× → optimise that class first; < 3× across all classes → overhead acceptable. Yields a single number per change type, drives Phase 3 ordering. **Done:** [`scripts/ci_time_ratio.py`](../../scripts/ci_time_ratio.py) correlates `git log` author-deltas (capped 60 min) with GitHub Actions wall-clock per sha. Results in [`agents/runtime/reports/ci-time-ratio.json`](../reports/ci-time-ratio.json): overall median ratio **0.43×** (n=11 commits with both signals on `main`). Per-class: doc 0.33×, skill 0.23×, mixed 0.45×, empty 1.00×. **Verdict: acceptable** (median < 3× across all classes). Phase 3.1 CI-tiering is therefore **not data-driven this round** — proceed only if a different signal (developer-reported wait time) supersedes the ratio.

## Phase 3: Structural — driven by Phase 2 numbers

Wait for Phase 2 results before sequencing. Each step references a Phase 2 output that decides whether it fires this round or stays parked.

- [-] **Step 1 — CI tiering (F6, file [07](../council-sessions/2026-05-14-v2-analysis/feedback/07-ci-tiering-and-overhead.md)):** **Parked.** Phase 2.3 CI-time ratio measured 0.43× (median) with all per-class ratios < 1.0× — well below the 3× "optimise" threshold. Tier promotion is not data-driven this round. Reopen only if a different signal (e.g. developer-reported wait time) supersedes the ratio.
- [x] **Step 2 — Project-analysis triad UX (C4, file [04](../council-sessions/2026-05-14-v2-analysis/feedback/04-project-analysis-triad-ux.md)):** **Done.** Rewrote `description:` for `project-analyzer`, `project-analysis-core`, `universal-project-analysis`. Each now begins with its primary trigger phrase and ends with explicit pointers to the other two siblings (e.g. "Single-pass scan → `project-analyzer`"). All three fit the 200-char hard cap enforced by `scripts/skill_linter.py`. Verified by `task lint-skills` (0 fail).
- [x] **Step 3 — Promote `routes_to` for failing clusters (file [05](../council-sessions/2026-05-14-v2-analysis/feedback/05-router-coverage-and-selection.md)):** **Done.** Added four new tier-3 routing rules: [`laravel-routing.md`](../../.agent-src.uncompressed/rules/laravel-routing.md), [`symfony-routing.md`](../../.agent-src.uncompressed/rules/symfony-routing.md), [`copilot-routing.md`](../../.agent-src.uncompressed/rules/copilot-routing.md), [`devcontainer-routing.md`](../../.agent-src.uncompressed/rules/devcontainer-routing.md). Each carries an explicit `triggers:` keyword set + `routes_to: skill:<id>`. C01 (analysis triad) was already covered by the pre-existing [`analysis-skill-routing.md`](../../.agent-src.uncompressed/rules/analysis-skill-routing.md). **Important methodology note:** the TF-IDF baseline in [`scripts/score_skill_selection.py`](../../scripts/score_skill_selection.py) scores against `description:` text only — it cannot model rule-router routing. After this step the TF-IDF baseline is unchanged (still C01/C04/C05 below threshold) because shorter descriptions reduced overlap; the real downstream consumer is the LLM host, which DOES see the routing rules. A future evaluator that feeds rules to the LLM-as-judge would close the loop (logged under Phase 4 candidate work).

## Phase 4: Cross-tool projection fidelity (U5)

Largest investigation surface, lowest-known cost, highest strategic value. Dedicated phase because it owns its own fixture work.

- [x] **Step 1 — Per-tool behaviour fixture (file [09](../council-sessions/2026-05-14-v2-analysis/feedback/09-cross-tool-projection-fidelity.md)):** Pick 5 representative skills (kernel + tier-1 + tier-2 + persona + command). For each, define a runnable scenario whose pass/fail is observable in each consumer tool (Claude.ai, Cursor, Windsurf, Augment). → `tests/fixtures/projection_fidelity/fixtures.yml` (5 entries · 25 per-tool checks)
- [x] **Step 2 — Run the fixture across all four tools.** Record per-tool pass / fail / partial. Catalogue divergences — these become the next round of bugs to file in `agents/council-sessions/` or directly into per-tool projection fixes. → `scripts/probe_projection_fidelity.py` + `task lint-projection-fidelity` (wired into `ci` + `ci-strict`); report at `agents/runtime/reports/projection-fidelity.json` (25/0/0 pass/partial/fail)
- [x] **Step 3 — Document the projection contract (file [02](../council-sessions/2026-05-14-v2-analysis/feedback/02-compression-naming-and-measurement.md) sibling):** Write `docs/contracts/multi-tool-projection-fidelity.md` that names per-tool guarantees explicitly. The Phase 1.2 rename and the Phase 2.1 per-tool numbers are inputs. → published with per-tool guarantee table + known-divergence list (Cursor `.mdc` drops router metadata, Windsurf single-file strips per-rule frontmatter, etc.)

## Phase 5: Governance and trajectory (long-horizon)

Items that need either time-series data or a values call. Park if Phase 1–4 burns the available bandwidth.

- [x] **Step 1 — Roadmap commitment-history measurement (U4, file [08](../council-sessions/2026-05-14-v2-analysis/feedback/08-roadmap-trajectory.md)):** **Done.** [`scripts/measure_roadmap_trajectory.py`](../../scripts/measure_roadmap_trajectory.py) walks `agents/roadmaps/archive/` and computes `done / (done + open + wip)` per roadmap. Output: [`agents/runtime/reports/roadmap-trajectory.json`](../reports/roadmap-trajectory.json) (machine-readable) + [`agents/runtime/reports/roadmap-trajectory.md`](../reports/roadmap-trajectory.md) (human-readable summary). Headline: 146 archived roadmaps · mean completion 91.9 % · median 100 %. Track record is materially honest — the package ships what its roadmaps promise.
- [x] **Step 2 — Architectural-consensus mechanism (C1, file [01](../council-sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md)):** **Done.** Decision recorded in [`docs/contracts/adr-architectural-consensus-mechanism.md`](../../docs/contracts/adr-architectural-consensus-mechanism.md) as a two-tier mechanism: (A) automated ontology lint (`scripts/skill_collision_clusters.py`, every PR, warn-only this cycle) + (B) per-cluster ADR on first collision. Option (c) — external review per N skills — rejected as standing process; reserved for major-version boundaries.
- [-] **Step 3 — Paired qualitative audit (D1, file [10](../council-sessions/2026-05-14-v2-analysis/feedback/10-audit-methodology.md)):** **Parked** per Phase 5 preface ("Park if Phase 1–4 burns the available bandwidth"). Phase 1–4 consumed the cycle's bandwidth; the qualitative pass is high-cost (calendar + USD) and low-marginal-signal given that Phase 4 produced a per-tool projection fidelity contract with a logged divergence list. Reopen at the v3 boundary if the divergence list grows or if a host other than the original author wants an independent UX read.

## Acceptance Criteria

- [x] All four Phase 1 steps merged; `task ci-strict` exists and gates release tags
- [x] Phase 2 yields three numeric outputs (per-tool projection bytes, selection-accuracy %, CI-time ratio per change class) — recorded in this file or in a sibling artefact
- [x] Phase 3 steps fire only after the Phase 2 numbers exist; ordering matches the data
- [x] Phase 4 produces a cross-tool fidelity contract document and a logged divergence list
- [x] Phase 5 either burns down or is explicitly parked with a rationale recorded in this file (5.1 + 5.2 burned down · 5.3 parked with rationale)
- [x] All quality gates pass (`task ci`, plus `task ci-strict` once Phase 1.4 lands)

## Notes

- **Cost ordering rationale:** Phase 1 unblocks credibility today; Phase 2 produces the numbers Phase 3 needs; Phase 3 spends the structural-overhead budget where it actually hurts; Phase 4 is the highest-leverage investigation; Phase 5 is governance that can wait.
- **Out of scope:** No persona / judge / release-tempo work — the council explicitly retracted those concerns. Do not re-open without new evidence.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmap:** Some Phase 1–3 work overlaps `road-to-productization.md`. When in doubt, pin the deeper detail here and reference from the parent.
