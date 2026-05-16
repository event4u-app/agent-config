---
complexity: structural
---

# Roadmap: Schema Rigor — Full Harmonist Suite (P3)

> Apply the full Harmonist-equivalent schema to the skill registry — `model_tier`, `## Deep Reference` cut-points, `schema_version` + migration registry, `distinguishes_from`, `disambiguation`, `domains:` filter, generated `index.json` / `router.json`, correlation IDs, memory CLI parity — so the registry behaves like a versioned database, not additive markdown.

**Measured-vs-claimed disclaimer:** All percentage claims in this roadmap (kernel char budget compliance, projection fidelity targets, token savings on `## Deep Reference` cut-points) are **claimed** until validated by [`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md). Acceptance gates here lock the **mechanisms**; the **numbers** lock against Phase 6 of step-4.

## Closure decision (2026-05-16, maintainer override)

This roadmap is **sunset** under the closure mandate. The full Harmonist parity suite — `model_tier`, `## Deep Reference` cut-points, `schema_version` + migration registry, `distinguishes_from`, `disambiguation`, `domains:` filter, generated `index.json` / `router.json`, correlation IDs, memory CLI parity — represents weeks of structural work against a contributor base that hasn't materialised. Rationale:

- **Prerequisites unmet by cascade.** [`step-2`](step-2-skill-inventory-rationalization.md) Phase 4 (rationalization to ≤ 160 skills) and [`step-4`](archive/step-4-measurement-and-benchmark.md) Phase 2 (bench harness) are both sunset / archived. Schema migration of 208 skills with no measurement floor is mechanism for its own sake.
- **Two-field minimum already partially shipped.** `## Deep Reference` cut-points exist in many skills via the `agents/contexts/` pattern; `kernel-membership` + `rule-router` contracts already lock the budget-enforcement layer. The contributor-friendly schema apparatus the council originally recommended (Opus + o1 two-field minimum) is the actual shipped surface.
- **G3 gate of [`step-99`](step-99-north-star-restructure.md) is itself sunset** on the same mandate — no downstream consumer of full Harmonist parity remains.

All Phase 1–6 checkboxes flip `[-]`. The Acceptance row stays explicitly unsatisfied (no `[x]` fabrication). If contributor demand for full schema rigor ever surfaces, the council verdict references and the parity table outline live in the file for revival.

## Prerequisites

- [-] Read `AGENTS.md`, [`skill-quality`](../../.agent-src.uncompressed/rules/skill-quality.md), [`docs/contracts/kernel-membership.md`](../../docs/contracts/kernel-membership.md)
- [-] Read [`external-findings.md § 3`](../audit-2026-05-14-north-star/external-findings.md) (Harmonist — all 10 patterns)
- [-] [`step-2-skill-inventory-rationalization.md`](step-2-skill-inventory-rationalization.md) Phase 4 complete (do **not** migrate 208 skills; migrate ≤ 160)
- [-] [`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md) Phase 2 complete (so each schema phase can re-measure)

## Context

Council split: Opus + o1 both recommended a **two-field minimum** (`model_tier` + `## Deep Reference`), deferring the rest until contributor demand emerges ([`council-synthesis.md § 5`](../audit-2026-05-14-north-star/council-synthesis.md) Pillar P3).

The Domination Mandate overrides that minimum: full parity with Harmonist's schema apparatus is the explicit G3 gate of [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md). The cost — breaking-change cadence — is offset by the migration registry: forks roll forward with `_upgrade_vN_to_vN+1` instead of re-syncing.

**Why structural:** this roadmap touches the contract layer (schema versioning), the kernel rules (correlation IDs in memory CLI), and the routing budget (`router.json` becomes generated, not hand-curated). Per `roadmap-complexity-standard` it earns the `structural` tier.

- **Source:** [`external-findings.md § 3`](../audit-2026-05-14-north-star/external-findings.md), [`step-99` § Phase 2 step 3](step-99-north-star-restructure.md)
- **Pillar:** P3 (Schema Rigor — FULL per Domination Mandate)
- **Block-on:** step-2 closure (stable inventory) + step-4 Phase 2 (re-measure each phase)

## Phase 1: `model_tier` everywhere

Mechanical, low-risk, foundational. Lets subagent orchestration pick the right cost class without hard-coding.

- [x] **Sunset closure 2026-05-16** — Phase 1 + all downstream phases cancelled per closure block at top. Prerequisites (step-2 Phase 4, step-4 Phase 2) are sunset / archived; mechanism without a consumer.
- [-] **Step 1 — Schema decision:** `model_tier ∈ { fast, inherit, reasoning }` per [`external-findings.md § 3`](../audit-2026-05-14-north-star/external-findings.md). Default `inherit`. Document the contract in `docs/contracts/skill-schema.md` (new).
- [-] **Step 2 — Linter rule:** `scripts/lint_skills.py` warns when `model_tier` is missing; errors after Phase 1 close. Wire to `task lint-skills`.
- [-] **Step 3 — Backfill pass:** Every skill in `.agent-src.uncompressed/skills/` declares `model_tier`. Default heuristic: ≤ 80 LOC body → `fast`; declares `Iron Law` or `reasoning frame` → `reasoning`; otherwise `inherit`.
- [-] **Step 4 — Subagent integration:** `subagent-orchestration` reads `model_tier` from invoked skill frontmatter — overrides `.agent-settings.yml` profile when present. Cited contract: `docs/contracts/skill-schema.md`.

**Exit:** every skill carries `model_tier`; linter errors on missing; subagent orchestration consults it. **Rollback:** demote the linter from error → warn; revert the orchestration consumption; metadata stays harmless.

## Phase 2: `## Deep Reference` cut-points

Every skill > 80 body lines splits into essentials (always loaded) + deep reference (on-demand). Cuts kernel + tier-1 context cost.

- [-] **Step 1 — Cut-point standard:** `docs/contracts/skill-schema.md § Deep Reference` — header is literally `## Deep Reference`; everything above is < 80 lines (essentials); everything below is on-demand. Linter measures essentials region.
- [-] **Step 2 — Inventory:** Generate `agents/metrics/skill-essentials-size.md` listing essentials-region LOC per skill. Sort desc; top 30 are migration candidates.
- [-] **Step 3 — Helper script:** `scripts/extract_essentials.py` proposes a cut point (heuristic: after `## Procedure`, before `## Examples` / `## Gotchas`). Human review per file — no batch rewrite.
- [-] **Step 4 — Migrate top 25:** Apply cut-points to the 25 largest skills (caveman's published corpus size for comparison). Each migration commit cites the LOC saving in the message body.
- [-] **Step 5 — Loader respects the cut:** Update generated trees (`.agent-src/`, `.augment/`) projection logic to ship essentials by default; deep reference loaded on explicit citation. Validate `task generate-tools` honors it.

**Exit:** ≥ 80 % of skills > 80 body lines carry `## Deep Reference`; loader projection respects the split. **Rollback:** cut-points harmless if loader doesn't split — restore the loader, leave the markers.

## Phase 3: `schema_version` + migration registry

Breaking changes possible without breaking forks. Migration functions never deleted.

- [-] **Step 1 — Version constant:** `docs/contracts/skill-schema.md § Version` declares `CURRENT_SCHEMA_VERSION = "2"`. v1 = today's frontmatter; v2 = full Harmonist suite.
- [-] **Step 2 — Frontmatter field:** Every skill declares `schema_version: "2"` after backfill. Missing → linter assumes v1 and queues migration.
- [-] **Step 3 — Migration registry:** `scripts/migrate_skill_schema.py` carries `MIGRATIONS[("1","2")] = _upgrade_v1_to_v2`. Forward-only. Old functions never deleted (forks rolling from v1 → v3 chain v1→v2→v3).
- [-] **Step 4 — `task migrate-skills` entrypoint:** Idempotent. Refuses if a skill is in an intermediate state. Emits `agents/metrics/migration-report.md`.
- [-] **Step 5 — Backfill the registry to v2:** Every skill ends Phase 3 at `schema_version: "2"`.

**Exit:** every skill `schema_version: "2"`; `task migrate-skills` runs idempotently. **Rollback:** revert the linter requirement; migration functions stay (cost = one file).

## Phase 4: `distinguishes_from` + `disambiguation` + `domains:`

Solves the "two skills match the same trigger" problem at the schema level. Filter by domain before routing.

- [-] **Step 1 — `distinguishes_from` field:** Optional list — slugs this skill is commonly confused with. Linter cross-checks: if `A.distinguishes_from = [B]`, then `B` should reciprocate (warn if not).
- [-] **Step 2 — `disambiguation` field:** One-line tie-breaker shown to the agent when multiple matching skills exist. Required iff `distinguishes_from` is populated.
- [-] **Step 3 — Overlap-driven backfill:** Use `agents/metrics/skill-overlap.md` (from [`step-2`](step-2-skill-inventory-rationalization.md) Phase 2) to seed `distinguishes_from`. Survivor of a merge cluster picks up the cluster's slugs in its `distinguishes_from`.
- [-] **Step 4 — `domains:` controlled list:** Domain vocabulary file `docs/contracts/domain-vocabulary.yaml`. Per-skill `domains:` ⊆ vocabulary. Routing filter: project `.agent-settings.yml` declares `project_domains: [...]`; runtime sees only `skill.domains ⊆ (project_domains ∪ {all})`.
- [-] **Step 5 — Generated triad audit:** The `project-analysis-*` / `universal-project-analysis` / `analysis-skill-router` triad cited as the anti-pattern in [`external-findings.md § 3`](../audit-2026-05-14-north-star/external-findings.md) — verify these now carry `distinguishes_from` + `disambiguation` after backfill.

**Exit:** every skill collision flagged in `skill-overlap.md` has resolved-or-explained disambiguation; `domains:` populated; routing filter active. **Rollback:** demote the linter; `distinguishes_from` is opt-in metadata.

## Phase 5: Generated registry + correlation IDs + memory CLI parity

Hand-curated `router.json` retires. Memory writes go through a CLI even off-MCP. Correlation IDs join records.

- [-] **Step 1 — Generated `router.json`:** `scripts/generate_router.py` reads skill frontmatter (`triggers`, `domains`, `model_tier`, `distinguishes_from`) and emits `.agent-src/router.json`. Hand-curation deprecated; CI fails if `router.json` drifts from the generated output.
- [-] **Step 2 — Generated `index.json`:** Sibling script `scripts/generate_index.py` emits `.agent-src/index.json` — flat list with slug, frontmatter summary, file path. Consumed by multi-tool projections.
- [-] **Step 3 — Correlation IDs:** Memory writes get `correlation_id: <session_id>-<task_seq>`. `session_id` provided by the host (Augment / Claude Code session); `task_seq` increments per session. Memory CLI rejects writes missing the field.
- [-] **Step 4 — Memory CLI parity:** `scripts/memory_cli.py append --kind <T> --status <S> --correlation <id>` validates against `agents/memory/SCHEMA.md`. Offline / pre-MCP users get the same surface. MCP tool is **additive**, not exclusive.
- [-] **Step 5 — Memory schema linter:** `scripts/lint_memory_schema.py` validates `agents/memory/*.md` against the schema. Wired to `task ci`.

**Exit:** `router.json` / `index.json` generated by CI; memory CLI writes work; correlation IDs propagate; schema linter green. **Rollback:** restore the hand-curated `router.json`; CLI keeps working (additive).

## Phase 6: Verification + acceptance

- [-] **Step 1 — Linter strict:** `task lint-skills` errors on every missing field (`model_tier`, `schema_version`, `domains`); `task lint-bench-corpus` re-runs against the rationalized inventory. (Pure mechanical enforcement; the **runtime hook** is out of scope here — owned by a future step.)
- [-] **Step 2 — Re-bench:** `task bench` runs against the post-schema-rigor inventory. Compare selection-accuracy + projection-fidelity to the pre-schema baseline. **Selection-accuracy must not regress > 5 pp**; if it does, Phase 4 disambiguation needs another pass.
- [-] **Step 3 — Cross-reference [`step-99-north-star-restructure.md`](step-99-north-star-restructure.md) § Acceptance G3:** "100 % skills declare `model_tier`; ≥ 80 % skills > 80 lines use `## Deep Reference`; `schema_version` + migration registry live; `distinguishes_from` + `disambiguation` populated where overlaps detected; `domains:` filter active" — every clause maps to a green check from Phases 1–5.
- [-] **Step 4 — Migration report archived:** Append the final `agents/metrics/migration-report.md` to `agents/audit-2026-05-14-north-star/` for historical record.

**Exit:** G3 clauses all green; selection-accuracy delta ≤ 5 pp; migration report archived. **Rollback:** N/A — Phase 6 is verification, not change.

## Acceptance Criteria

- [-] 100 % of skills declare `model_tier` (linter-enforced)
- [-] ≥ 80 % of skills > 80 body lines carry `## Deep Reference`
- [-] `schema_version: "2"` present on every skill; `MIGRATIONS[("1","2")]` lives in `scripts/migrate_skill_schema.py`
- [-] `distinguishes_from` + `disambiguation` populated for every pair from `skill-overlap.md`
- [-] `domains:` populated against `docs/contracts/domain-vocabulary.yaml`; routing filter active
- [-] `router.json` + `index.json` generated by CI; hand-curation rejected
- [-] Correlation IDs propagated on every memory write; CLI parity available off-MCP
- [-] `task bench` selection-accuracy regression ≤ 5 pp vs pre-schema baseline

## Notes

- The migration registry is the contract that lets this roadmap break frontmatter compatibility without breaking forks. **Old `_upgrade_v1_to_v2` is never deleted** — even after `_upgrade_v2_to_v3` lands. Removing it is the breaking change.
- `domains:` filter has a re-rank fallback when `project_domains` is unset: the runtime sees all skills but ranks domain-matching ones higher. Hard filter only when the project commits to a domain set.
- `## Deep Reference` cut-points are a kernel-budget play, not a stylistic one. The 80-line essentials cap derives from kernel-rule budget per [`docs/contracts/kernel-membership.md`](../../docs/contracts/kernel-membership.md).
- The memory CLI parity addresses [`external-findings.md § 3`](../audit-2026-05-14-north-star/external-findings.md) Row 10: "Memory CLI as only write path" — we keep MCP as the **preferred** path; CLI is the floor.
- Correlation IDs are a JOIN key, nothing more. They do not change retention semantics or trust-score calculation in the existing memory system.
