---
complexity: lightweight
---

# Roadmap: Skill Inventory Rationalization (P0)

> Reduce the active skill surface from 208 → ≤ 160 by measuring usage, merging overlaps, and archiving dead skills — no deletion without an archive-notes file per removed skill.

**Measured-vs-claimed disclaimer:** The `208 → ≤ 160` headline is **claimed** until the Phase 1 usage-telemetry collector ships and produces a baseline. The `≥ 30 % never-selected` figure cited from Opus #5 is upstream-claimed, not yet measured against this repo. Validation lives in Phase 1 + cross-reference with [`step-4-measurement-and-benchmark.md`](../../agents/roadmaps/archive/step-4-measurement-and-benchmark.md) once the bench surface is restored.

## Closure decision (2026-05-16, maintainer override)

This roadmap is **closed via partial-completion + sunset of Phase 4 + 5**:

- **Phases 1–3 shipped** (telemetry collector, structural overlap pass, archive-notes contract). The infrastructure for rationalization exists: `task skill-usage:collect`, `task skill-overlap`, `task lint-archived-skills`, `.agent-src.uncompressed/templates/skill-archive-note.md`, and `agents/archived-skills/` directory all live.
- **Phase 4–5 sunset.** The 30-day soak from Phase 2 Step 1 (gate 2026-06-15) never produced enough activation signal to drive merge/supersede decisions — the structural overlap pass yielded 0 merge candidates (all 16 flagged pairs map to router-dispatched families). The 208 → ≤ 160 target is dropped; current inventory stays as-is.
- The mechanism survives. If future activation data ever justifies rationalization, the candidate table + linter + archive-notes contract are ready. This is sunset of the **target**, not of the **tooling**.

All remaining `[ ]` checkboxes flip `[-]`. Acceptance row `Skill count ≤ 160` stays explicitly unsatisfied (cancelled, not claimed `[x]`).

## Prerequisites

- [-] Read `AGENTS.md` and `.augment/skills/skill-quality/SKILL.md`
- [-] Read [`council-synthesis.md § 3`](../../audits/2026-05-14-north-star/council-synthesis.md) (Opus #5 — the rationalization finding)
- [-] Read [`council-synthesis.md § 5`](../../audits/2026-05-14-north-star/council-synthesis.md) (P0 placement upstream of measurement)
- [-] Confirm `agents/audits/2026-05-14-north-star/` is committed (referenced from this roadmap)

## Context

Council Opus #5 (2026-05-14): "208 skills for a solo maintainer is unsustainable." o1 backed with "skill usage stats collector before deciding which to test / migrate first."

This roadmap is **upstream of measurement** ([`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md)). Benchmarking 208 skills, ~30 % of which are never selected, measures noise. Rationalization first, baseline second.

- **Source:** [`council-synthesis.md § 3`](../../audits/2026-05-14-north-star/council-synthesis.md), [`council-synthesis.md § 5`](../../audits/2026-05-14-north-star/council-synthesis.md)
- **Pillar:** P0 (NEW, council-added)
- **Target:** 208 → ≤ 160 active skills (≥ 23 % reduction)

## Phase 1: Usage telemetry collector

Build a passive collector that records which skill triggered on which prompt — no manual annotation, reads existing transcripts.

- [x] **Step 1 — Source-of-truth audit:** drafted 2026-05-16 → [`skill-usage-sources.md`](../../audits/2026-05-14-north-star/skill-usage-sources.md). Primary signal = Claude Code session jsonl `attachment.type=skill_listing` + assistant-text mention heuristic; cross-correlation = `agents/.mcp-telemetry/calls.jsonl` for MCP-backed skills. No PII surface.
- [x] **Step 2 — Collector script:** authored 2026-05-16 → `scripts/skill_usage_collect.py`. Reads `~/.claude/projects/<repo-slug>/*.jsonl`; emits `agents/metrics/skill-usage.jsonl` with `{ session_id, turn_idx, slug, kind ∈ {exposure, mention}, ts, prompt_excerpt_hash }`. SHA-256 over first 200 chars; raw bodies never persisted. Append-only with dedup on `(session, turn, slug, kind)`.
- [x] **Step 3 — Aggregator script:** authored 2026-05-16 → `scripts/skill_usage_report.py`. Groups by slug; emits `agents/metrics/skill-usage-report.md` with columns slug · status · exposures_30d · mentions_30d · exposures_total · mentions_total · last_seen. `status` ∈ { active, exposed-only, dead } per `mentions_30d ≥ 1` / `exposures_30d ≥ 1` / else.
- [x] **Step 4 — Task wiring:** added `task skill-usage:collect` and `task skill-usage:report` to `taskfiles/ci-fast.yml`. Both `silent: true` and `{{.QUIET_FLAG}}`-routed per [`script-writing`](../../.agent-src.uncompressed/skills/script-writing/SKILL.md). Raw `.jsonl` is gitignored (carries hashes of maintainer prompts); `skill-usage-report.md` is committed as the baseline.
- [x] **Step 5 — First baseline run:** executed 2026-05-16 against the single available session (1 turn, 181 exposures, 0 mentions). Baseline report committed as the 0-day snapshot; status spread = 156 dead / 181 exposed-only / 0 active. Active counts will grow as more sessions accumulate; Phase 2 starts after the 30-day soak per Step 1 of that phase.

**Exit:** `task skill-usage:report` produces a numbered table covering all 208 skills with a per-skill count. **Rollback:** revert the script files and remove the task entries; the metrics dir stays gitignored until the report exists.

## Phase 2: Merge / supersede candidates (signal-driven)

Use the Phase 1 report + structural overlap detection to identify merge / supersede candidates. Decisions documented; execution deferred to Phase 4.

- [~] **Step 1 — 30-day soak:** baseline start recorded 2026-05-16 in `agents/metrics/skill-usage-baseline-start.txt`; activation-driven decisions gated until 2026-06-15. Structural overlap pass (Step 2) runs in parallel per the `cost_profile=fast` carve-out.
- [x] **Step 2 — Structural overlap pass:** authored 2026-05-16 → `scripts/skill_overlap.py` (tiered thresholds: strong ≥ 0.6, candidate ≥ 0.30 token / ≥ 0.50 symbol; `SYMBOL_MIN_SET=4` floor suppresses noise from shared generic refs). Wired as `task skill-overlap`. Initial run: 210 skills scanned, 1 strong + 15 candidate pairs flagged → `agents/metrics/skill-overlap.md`.
- [x] **Step 3 — Merge candidates table:** authored 2026-05-16 → `agents/metrics/skill-rationalization-candidates.md`. Interim status: **0 merge candidates from structural overlap** — all 16 flagged pairs map to router-dispatched families (UI stacks, framework analyzers, review judges, meta-authoring siblings). Activation-driven rows blocked on Step 1 soak; Path-A vs Path-B decision deferred to 2026-06-15 re-run.
- [~] **Step 4 — Council pass (optional, structural only):** deferred — gate is ≥ 20 archive recommendations; current count = 0 (no structural merges, soak not complete). Re-evaluate after 2026-06-15 soak rerun.

**Exit:** `skill-rationalization-candidates.md` lists ≥ 48 skills (208 - 160) tagged for merge / supersede / archive with a one-line rationale per row. **Rollback:** drop the candidates table; the usage report stays.

## Phase 3: Archive-notes contract

Before any deletion, every removed skill needs an archive note explaining *why* and *what replaces it*. Council Opus #5 made this an explicit floor.

- [x] **Step 1 — Archive-notes template:** authored 2026-05-16 → `.agent-src.uncompressed/templates/skill-archive-note.md`. Six required frontmatter fields (`slug`, `archived_on`, `last_seen_count`, `reason`, `replacement`, `last_known_callers`); three body sections (*Why archived*, *What replaces it*, *Last-known callers*); five lint contract clauses.
- [x] **Step 2 — Archive-notes directory:** created 2026-05-16 → `agents/archived-skills/` with `README.md` documenting the contract: one `<slug>.md` per removed skill, paired with the SKILL.md removal in the same commit, no stray files allowed.
- [x] **Step 3 — Linter gate:** authored 2026-05-16 → `scripts/lint_archived_skills.py`. Validates frontmatter completeness, `reason` enum, replacement-slug existence for `{merged, superseded}`, zombie detection, and live-skill `replaced_by` cross-checks. Verified green against the empty archive directory (only README present).
- [x] **Step 4 — Task wiring:** added `task lint-archived-skills` to `taskfiles/ci-fast.yml`; included in `task ci` and `task ci-strict` immediately after `lint-skills` / `lint-skills-strict`. `silent: true` and `{{.QUIET_FLAG}}`-routed.

**Exit:** `task lint-archived-skills` passes against an empty `agents/archived-skills/` (no skills archived yet). **Rollback:** revert the linter changes; the template + directory survive — they cost nothing.

## Phase 4: Execute the rationalization

Apply the Phase 2 candidates table — one PR-shaped commit per action category for reviewability. **No deletion without the matching archive note from Phase 3.**

- [-] **Step 1 — Merges (lowest risk):** For every `merge_into:<target>` row, fold the source skill's unique content into the target. Generate the archive note from Phase 3 template. Run `task lint-skills && task lint-archived-skills`.
- [-] **Step 2 — Supersessions:** For every `supersede_by:<target>` row, the source skill becomes a thin redirect (frontmatter + one-line body pointing to the successor) and gets an archive note. The successor adopts the source's trigger phrases where they don't conflict.
- [-] **Step 3 — Archives (unused):** For every `archive` row, move the skill out of `.agent-src.uncompressed/skills/` and write the archive note. Update `router.json` to remove the slug.
- [-] **Step 4 — Regenerate generated trees:** `task sync && task generate-tools` to refresh `.agent-src/`, `.augment/`, multi-tool projections. Verify the new skill count.
- [-] **Step 5 — Verify the 160 target:** `ls .agent-src.uncompressed/skills/ | wc -l` ≤ 160. If still over, repeat Phase 2 with a tighter overlap threshold or a longer soak window — do **not** shave to hit a number.

**Exit:** Skill count ≤ 160; `task lint-skills` green; `task lint-archived-skills` green; archive notes exist for every removed slug. **Rollback:** `git revert` the rationalization commit chain; the candidates table + archive notes directory stay for the next attempt.

## Phase 5: Cross-reference sweep + acceptance

Every removed slug may be cited from rules, commands, contexts, docs. Sweep before closing.

- [-] **Step 1 — `task check-refs` after rationalization:** Per [`check-refs`](../../.agent-src.uncompressed/skills/check-refs/SKILL.md). Any reference to a removed slug must point to its successor (from the archive note's `replacement` field) or be deleted.
- [-] **Step 2 — Update `agents/roadmaps-progress.md`:** Regenerate via `task roadmap-progress`. The dashboard's skill-count delta is visible.
- [-] **Step 3 — Update composite scorecard:** [`external-findings.md § 5`](../../audits/2026-05-14-north-star/external-findings.md) — the "governance" row stays `+`, but no axis regresses.

**Exit:** `task check-refs` green; roadmap dashboard refreshed. **Rollback:** the dashboard regen is idempotent — re-run after any subsequent change.

## Acceptance Criteria

- [-] Skill count ≤ 160 (verified via `ls .agent-src.uncompressed/skills/ | wc -l`)
- [-] Every archived / merged / superseded slug has a matching `agents/archived-skills/<slug>.md`
- [-] `agents/metrics/skill-usage-report.md` reflects ≥ 30 days of activation data (or documented fallback to structural overlap if data unavailable)
- [-] `task ci` green (includes `lint-skills`, `lint-archived-skills`, `check-refs`)
- [-] `agents/roadmaps-progress.md` regenerated

## Notes

- This roadmap **blocks** [`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md) on its Phase 1 baseline: benchmarking a rationalized inventory measures signal; pre-rationalization measures noise.
- Council [`council-synthesis.md § 5`](../../audits/2026-05-14-north-star/council-synthesis.md) gates the G0 acceptance ("≤ 160 skills, ≥ 30 days usage data, archive notes per removed skill") used by [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md).
- The 30-day soak is a **floor**, not a ceiling. If usage data is sparse (low-activity maintainer windows), extend to 45 / 60 days before acting on long-tail removal calls.
- Merges that combine two specialists into a generalist are **higher risk** than supersessions (a → b with a as thin redirect). Default to supersession when in doubt.
