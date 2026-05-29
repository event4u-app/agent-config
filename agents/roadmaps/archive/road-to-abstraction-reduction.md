---
complexity: structural
---

# Roadmap: Abstraction reduction — factor frontmatter boilerplate into contract defaults

> Chartered by the **GO verdict** on `road-to-abstraction-budget-discovery.md` (council: claude-sonnet-4-5 + gpt-4o, 2026-05-28, analysis lens, converged). The discovery inventory measured **26 frontmatter fields that are >95% identical across 335 artefacts** (skill 129, rule 71, command 135, persona 30) — ≈ 8,400 lines of redundant repetition. The council authorized a **single bounded scope**: factor those constants into contract-level defaults and migrate artefacts to omit them. This roadmap does **NOT** remove abstractions, commands, enums, or rename naming families — every other Cluster-1 finding was explicitly rejected at the gate.

## Context

- **Source of truth.** `agents/evidence/analysis/abstraction-budget-inventory.md` § "Frontmatter boilerplate candidates" lists the exact 26 fields with their dominant values and population coverage. Re-run via `scripts/inventory_abstraction_budget.py` to refresh.
- **The trap the discovery roadmap warned against.** Unbounded "simplicity audits" that spawn new contracts / new process. This reduction is single-scoped (frontmatter defaults), measurable (line-count delta), and reversible (defaults flip back to explicit values if downstream consumers break).
- **Gates.** `minimal-safe-diff` (touch only the 26 fields; do not refactor neighbouring frontmatter or content), `scope-control` (no abstraction removals; only field-omission migrations), `roadmap-progress-sync`, `verify-before-complete` (schema + lint + condense round-trip must stay green).
- **Non-goal:** the 2 zero-usage commands (`agents:user:show`, `agents:user:review`) are out of scope here — their removal-or-keep decision needs a separate discovery loop (see Notes).
- **Non-goal:** naming-family consolidation. The council rejected purpose-overlap reads on `judge-*`, `project-*`, `no-*`, and command namespaces; they are per-lens / per-namespace by design.

## Phase 0: Schema-stability pre-flight

The council's strongest blind spot: removing 8,400 lines of "redundant" frontmatter is only safe if no consumer assumes the fields are explicit. Audit first, factor second.

- [ ] **Step 1:** Grep for explicit frontmatter accesses across the runtime + tooling layer. Patterns: `frontmatter.get("trust.level"`, `frontmatter["trust.level"]`, `fm.get("install.default"`, equivalent for every field in the 26-row list. Capture results in `agents/evidence/analysis/abstraction-reduction-preflight.md`.
- [ ] **Step 2:** For each access site found, classify: (a) reads the field with a default fallback (safe), (b) reads the field without a default (requires the field to remain explicit OR the parser to inject defaults), (c) parses YAML directly outside the central loader (potential external-consumer risk — flag for follow-up).
- [ ] **Step 3:** Survey published surfaces: skills/rules/commands exposed via `.claude/`, `.cursor/`, `.windsurf/`, npm package bin, MCP listing. Document whether any external consumer parses the frontmatter YAML directly vs. consuming the condensed runtime output. Append findings to the pre-flight doc.
- [ ] **Step 4:** Decide per-field whether it is (a) safe to default (no external consumer depends on its explicit presence), (b) needs a parser-injected default first, or (c) must remain explicit. Record the per-field decision in the pre-flight doc.

**Exit criteria:** `abstraction-reduction-preflight.md` exists with the per-field classification. No field migrates to a default until classified.

**Rollback:** delete `abstraction-reduction-preflight.md`. No code changed yet.

## Phase 1: Contract-level defaults in schemas

Lock the defaults at the validation layer before touching any artefact.

- [ ] **Step 1:** For each schema under `scripts/schemas/` covering skill / rule / command / persona frontmatter, identify where defaults are declared today (jsonschema `default` keyword, or absent). Capture the current state in the pre-flight doc.
- [ ] **Step 2:** Add `default` declarations for every field classified as "safe to default" in Phase 0 § Step 4. Use the dominant value from the inventory (e.g. `trust.level: default: core`, `install.default: default: true`, `lifecycle: default: active`, `source: default: package`).
- [ ] **Step 3:** Update the central frontmatter loader (`scripts/validate_frontmatter.py` and any agent-runtime equivalent) to inject schema defaults into the parsed dict when a field is absent. The downstream code that reads `frontmatter["trust.level"]` must keep working unchanged.
- [ ] **Step 4:** Add a unit test per defaulted field: artefact with field present → unchanged; artefact with field absent → default value injected at read time.
- [ ] **Step 5:** Run `python3 -m pytest` for the schema + loader tests. Confirm green.

**Exit criteria:** the loader injects defaults transparently; all existing artefacts (which still carry the explicit values) keep validating; new fixtures with omitted fields validate against the schema and read back the default.

**Rollback:** revert the schema `default` declarations and the loader injection patch. Artefacts are untouched at this phase.

## Phase 2: Migrate artefacts to omit defaulted fields

Touch artefacts only after the loader path is proven.

- [ ] **Step 1:** Write `scripts/migrate_frontmatter_defaults.py` — read each artefact, parse frontmatter, drop any field whose value equals the schema default, rewrite the file. Idempotent (re-running is a no-op).
- [ ] **Step 2:** Dry-run the migration on the full tree: `python3 scripts/migrate_frontmatter_defaults.py --dry-run`. Capture the per-class line-count delta in `agents/evidence/analysis/abstraction-reduction-deltas.md`.
- [ ] **Step 3:** Apply the migration: `python3 scripts/migrate_frontmatter_defaults.py`. Verify `git diff --stat` matches the dry-run prediction within tolerance.
- [ ] **Step 4:** Run `python3 scripts/validate_frontmatter.py` across the migrated tree — every artefact must still validate.
- [ ] **Step 5:** Re-condense the changed artefacts and verify the condensation hashes still match (`bash scripts/condense.sh --changed`). Frontmatter-default migration must not break condensation.
- [ ] **Step 6:** Re-run `python3 scripts/inventory_abstraction_budget.py` and confirm the frontmatter boilerplate row count drops materially (target: 0 fields >95% identical in the 26 migrated cases, because the explicit value is gone for the default cases).

**Exit criteria:** all 26 fields migrated where Phase 0 classified them safe; condensation + validation + inventory all green.

**Rollback:** `git checkout` the migrated artefacts; revert the migration script.

## Phase 3: Lint that prevents the boilerplate from coming back

A reduction without a guardrail re-accumulates on the next contribution.

- [ ] **Step 1:** Add `scripts/lint_frontmatter_boilerplate.py` — for each artefact, if a field is present AND its value equals the schema default, fail with a hint to omit the field.
- [ ] **Step 2:** Wire the lint into the `task ci-fast` cadence (or whichever lint stage the package uses for frontmatter checks). Verify it fails on a fixture that re-introduces a boilerplate field.
- [ ] **Step 3:** Update the contributing docs (`docs/guidelines/agent-infra/skill-quality-checklist.md` or sibling) with a one-line "omit fields equal to their schema default" rule + link to the linter.

**Exit criteria:** linter green on the migrated tree; linter red on a fixture that re-adds a defaulted field; contributing docs updated.

**Rollback:** remove the linter script + the docs line; the migration itself stays.

## Acceptance criteria

- [ ] Phase 0 pre-flight doc lists every explicit frontmatter access site, classifies per-field safety, and decides per-field migration disposition.
- [ ] Phase 1 schemas carry `default` declarations for every "safe" field; loader injects them transparently; unit tests prove parity for present-vs-absent fields.
- [ ] Phase 2 artefacts no longer carry the defaulted fields; line-count delta documented; condensation + validation green.
- [ ] Phase 3 lint prevents regression; docs updated.

## Notes

- **Roadmap plans work, not a release.** No version/tag/commit step implied.
- **Council-mandated bounded scope.** Out-of-scope here (each requires its own roadmap if chartered): removing the 2 zero-usage commands, naming-family consolidation, role-enum trimming. The 2-commands discovery is the lightest follow-up if a maintainer wants to charter it.
- **Re-run discovery.** `python3 scripts/inventory_abstraction_budget.py` is the canonical re-measurement when feedback round 14+ revisits the complexity claim. The verdict in `road-to-abstraction-budget-discovery.md` is the canonical citation against speculative "it's too complex" feedback.
