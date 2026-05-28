---
complexity: lightweight
---

# Roadmap: Abstraction-budget discovery — measure before you cut

> External feedback rounds 9, 11, and 12 all flagged the same worry: the system is getting complex ("packs, roles, directives, councils, trust, flows, commands… for normal employees potentially a lot", "scope-creep / build-everything energy", "keep frontmatter lean"). Three independent mentions is a real signal. **But** the source is an external AI scraping Glama/Packagist metadata — it could not read the tree and named **no specific abstraction** as removable. Council (claude-sonnet-4-5 + gpt-4o, 2026-05-27, analysis lens) downgraded the finding to **speculative** and was explicit: do **not** charter a reduction roadmap on a vibe. Run a discovery pass first, gate any reduction on hard usage data. This roadmap **is** that discovery pass — and nothing more.

## Context

- **The trap this roadmap avoids.** A "simplicity audit" that spawns new process, new contracts, or a speculative multi-phase reduction backlog **is itself the scope-creep the feedback warns against**. The deliverable here is an inventory + a single go/no-go gate, not a reduction commitment.
- **Why discovery, not action.** Without usage counts, "is abstraction X dead weight?" is unanswerable. The package already values this discipline (`size-enforcement`, kernel-budget contracts) — discovery makes the complexity claim falsifiable instead of rhetorical.
- **Gates.** `minimal-safe-diff` (the inventory script is read-only/analysis, touches no abstraction), `scope-control` (no removals without the gate passing + a follow-up roadmap), `roadmap-progress-sync`.

## Phase 1: Inventory — count, don't judge

- [x] **Step 1:** Build (or extend an existing discovery script into) a read-only inventory of every abstraction class: packs, roles, directives, councils, trust-fields, flows, commands. For each instance emit: name, class, invocation/reference count across the tree, last-modified date, and a mechanical `bloat-candidate` flag (Y if usage-count == 0 OR purpose overlaps another instance). Output to `agents/evidence/analysis/abstraction-budget-inventory.{md,csv}`. <!-- Implemented: scripts/inventory_abstraction_budget.py — read-only, ripgrep-backed with self-ref subtraction. -->
- [x] **Step 2:** Frontmatter field-bloat sub-audit (feedback 11): tabulate which frontmatter fields actually vary across artefacts vs. which are near-constant boilerplate. A field that is identical in >95% of artefacts is a lean-contract candidate. Append to the inventory output. <!-- Result: 26 fields >95% boilerplate across skill/rule/command/persona classes. -->
- [x] **Step 3:** Exit gate — inventory committed as evidence; numbers are real counts (grep/AST-backed), not estimates. <!-- Output: agents/evidence/analysis/abstraction-budget-inventory.{md,csv} + abstraction-budget-frontmatter.csv. -->


## Phase 2: The go/no-go gate

The single decision this roadmap exists to produce. No reduction work happens inside this roadmap.

- [x] **Step 1:** Apply the gate against the Phase 1 data:
  - **GO** (charter a separate `road-to-abstraction-reduction.md`) only if the inventory shows **≥ 3 abstractions with usage-count == 0** OR **≥ 2 abstractions that demonstrably overlap in purpose**, OR a frontmatter field that is pure boilerplate in >95% of artefacts.
  - **NO-GO** (reject Cluster 1 as noise) otherwise — record the rejection with the supporting counts so feedback rounds 14+ that re-raise "it's too complex" are answered by data, not relitigated. <!-- Verdict: GO (scoped). See Notes for citations + council convergence. -->
- [x] **Step 2:** Write the verdict into this roadmap's Notes + the inventory file. If GO, the reduction roadmap is authored separately (its own scope, its own `minimal-safe-diff` discipline); this roadmap does not perform removals. <!-- Verdict written below; sibling roadmap `road-to-abstraction-reduction.md` chartered. -->
- [x] **Step 3:** Exit gate — verdict recorded with citations; if NO-GO, this roadmap is archived as a completed discovery with a reusable inventory script for the next round. <!-- Discovery script stays at scripts/inventory_abstraction_budget.py for re-runs. -->

## Acceptance criteria

- [x] Phase 1: abstraction inventory + frontmatter field-bloat table shipped under `agents/evidence/analysis/`, backed by real counts.
- [x] Phase 2: explicit GO / NO-GO verdict recorded with supporting counts; on GO, a separate reduction roadmap is chartered (not executed here); on NO-GO, the rejection is documented.

## Notes

- **Meta-roadmap risk acknowledged.** This roadmap is deliberately two phases and discovery-only precisely because the feedback warns against "more meta-roadmaps". If even the inventory feels like overhead, the honest alternative is to reject Cluster 1 outright on the source-quality grounds (speculative, no file:line) — that is a legitimate outcome the gate makes available.
- **Roadmap plans work, not a release.** No version/tag/commit step implied.
- **Cross-reference.** Independent of `road-to-wizard-sse-hardening` and `road-to-distribution-identity`. A future `road-to-abstraction-reduction.md` is chartered only on a Phase 2 GO.

## Verdict (2026-05-28) — **GO (scoped to frontmatter-defaults factoring)**

Council (claude-sonnet-4-5 + gpt-4o, 2026-05-28, analysis lens) converged on **GO**, with one bounded scope and three explicit rejections. Cost: $0.0557. Question + inventory snapshot inlined here (council session JSON is gitignored under `agents/runtime/`).

### What triggers GO

- **Frontmatter boilerplate criterion met.** 26 fields are >95% identical across 335 artefacts: `trust.{level,confidence,human_review_required}`, `install.{default,removable}`, `lifecycle`, `source`, `command.disable-model-invocation`, `command.type`, `skill.execution.type`, `rule.validator_ignore`, `persona.{version,source}`. The dominant value covers 97–100% of the population in every case (see `agents/evidence/analysis/abstraction-budget-inventory.md` § "Frontmatter boilerplate candidates"). Estimated redundant repetition ≈ 8,400 lines across the tree. This is the **only** finding the council validated as mechanically actionable and roadmap-ready.

### What the gate explicitly rejects in writing

1. **Role-enum "zero usage" is a methodological artifact, not dead weight.** `roles.active_role` has 6 enum values (`developer`, `reviewer`, `tester`, `po`, `incident`, `planner`); only `developer` is referenced in this repo's settings. The 5 unused values are **cross-user schema vocabulary**, part of the contract defined in `docs/guidelines/agent-infra/role-contracts.md` — not unused abstractions. Removing them would break consumers who select a different role. The gate **rejects** the literal "≥3 usage_count==0" reading on these 5 rows.

2. **Naming-family overlap is heuristic over-fire, not purpose overlap.** The inventory flagged 17 naming families (`judge-*` × 4, `project-*` × 4, `no-*` × 5, command namespaces × 11). Council confirmed these are per-lens / per-namespace specialisation: e.g. `judge-bug-hunter` ≠ `judge-security-auditor`, they are distinct review lenses. The gate **rejects** the literal "≥2 demonstrably overlap" reading on naming alone — only behavioural-overlap evidence would qualify, and the inventory does not provide it.

3. **The 2 zero-usage commands need a discovery loop before any removal.** `command/agents:user:show` and `command/agents:user:review` show zero external references. Whether they are deprecated, vestigial, or conditionally invoked (e.g. by a pack-orchestration path not in this repo) is **unknown**. The gate **rejects** them as direct removal candidates for the GO scope; a separate discovery pass is required before any decision.

### Authorized follow-up roadmap scope (single, bounded)

**`road-to-abstraction-reduction.md`** — factor the 26 boilerplate frontmatter fields into contract-level defaults so artefacts can omit them. Strictly:

- Define defaults at the schema layer (`scripts/schemas/`) for `trust.level=core`, `lifecycle=active`, `install.default=true`, `install.removable=false`, `source=package`, `trust.confidence=high`, `trust.human_review_required=false`, plus the per-class fields above.
- Migrate artefacts to omit fields where value == default.
- Run a schema-stability pre-flight first (blind spot raised by both council members): audit `scripts/` and runtime code for `frontmatter.get("trust.level")` style accesses that assume the field is explicit, and any external consumers parsing artefact YAML.
- Measure before/after line counts; target ≈ 8,400-line reduction.
- **Do NOT** remove abstractions, commands, enums, or naming families in that roadmap.

### Convergence record

- **Members:** anthropic/claude-sonnet-4-5, openai/gpt-4o
- **Date:** 2026-05-28
- **Mode:** `analysis` lens, 1 round, prompt + raw inventory data
- **Cost:** $0.0557 actual (estimate $0.4241)
- **Convergence:** Both members independently recommended GO scoped to frontmatter-defaults, both flagged the same schema-stability blind spot, and both agreed the zero-usage roles and naming-family findings should be rejected in writing.
