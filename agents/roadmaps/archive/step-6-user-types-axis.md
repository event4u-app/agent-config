---
complexity: structural
---

# Roadmap: `user-types/` axis (parallel to `personas/`)

> Add a separate first-class axis `user-types/` so that `personas/` stops being overloaded with two semantics. Persona = **how** we review (methodology — qa, senior-engineer, critical-challenger). User-type = **who** we simulate (real end user — galabau field crew, metalworking shop, truck driver). After this work a refine run reads as `/refine-ticket --personas=qa --user-type=truck-driver PROJ-123`: QA methodology applied through a truck-driver end-user lens. Structural twin of the persona pipeline — same compile flow, linter discipline, schema cadence — deviations only where semantics genuinely differ and each one documented inline.

## Re-validation gate (READ BEFORE EXECUTING)

> **Before any step runs, compare this roadmap against the source brief and the current repo state:**
> 1. Source artefact: the user-authored brief that produced this roadmap (no council session — direct user spec, no third-party validation needed). Re-read the Anti-Generic Quality Bar and the Guardrails before authoring any seed user-type.
> 2. Inherited floors: the locked persona schema (`docs/contracts/persona-schema.md`) and `scripts/schemas/persona.schema.json` must remain **untouched**; `--personas=` behavior must be 100% unchanged after this work; no existing persona moves.
> 3. The codebase may have changed since drafting (new schema fields, new linter classifiers, new tests). Pass criterion: every Phase-1 design decision still maps to the persona pipeline shape. Fail criterion: persona pipeline changed in a way that makes mirroring nonsensical — escalate to the user before forcing it.

## Prerequisites

- [x] Re-validation gate (above) passes
- [x] Read `.agent-src.uncompressed/personas/README.md`, `docs/contracts/persona-schema.md`, `scripts/schemas/persona.schema.json`, `.agent-src.uncompressed/personas/_template-specialist/persona.md`, `.agent-src.uncompressed/personas/qa.md`
- [x] Read `.agent-src.uncompressed/skills/refine-ticket/SKILL.md` and `.agent-src.uncompressed/commands/refine-ticket.md`
- [x] Read `scripts/skill_linter.py` — esp. `lint_persona` (line ~1641), the artifact-type classifier, and every `/personas/` path match (line ~515, ~2027 known; audit the rest)
- [x] Read `Taskfile.yml` + `taskfiles/` (compress / sync / ci / lint targets) and `tests/work_engine/test_persona_integration.py` + `tests/work_engine/test_persona_policy.py` + `scripts/skill_tools/audit_persona_coverage.py`
- [x] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

The user-types axis is **additive**. The repo's persona system is the structural reference: directory shape, schema cadence, linter hook surface, compile pipeline, test pattern, README discipline. Mirror everywhere it makes sense; deviate only where semantics force it (frontmatter `kind`, section spine, `source` semantics typically project-specific). The three seed user-types must pass the Anti-Generic Quality Bar — generic prose ("consider usability", "think about offline") is REJECTED at lint or review time; every section encodes concrete operational reality with ≥ 5 domain-specific review points per file.

Guardrails baked into every user-type's Anti-Patterns section: user-types are **review lenses only**, never operational instruction sources. Allowed: workflow realism, ticket gap analysis, terminology correction, mobile / offline / safety / approval signals as ticket-requirement signals. Not allowed: trade execution instructions (welding, electrical, structural), dangerous how-to, medical / legal / engineering advice.

Naming-vs-brief reconciliation: brief mentions `event4u-app/agent-config` — actual repo is `event4u/agent-config`. Treated as a writing artefact; all paths match this repo. ADRs in the brief are written as `docs/contracts/decisions/` — actual layout is flat `docs/contracts/adr-*.md`. The new ADR follows the flat convention.

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Source artefact:** user-authored brief (no council session this round)
- **Sibling roadmaps:** [`step-1-v2-feedback-followup.md`](step-1-v2-feedback-followup.md) · [`step-2-ai-council-consolidation.md`](step-2-ai-council-consolidation.md) · [`step-3-agent-user-persona.md`](step-3-agent-user-persona.md) · [`step-4-ghostwriter.md`](step-4-ghostwriter.md) · [`step-5-test-cleanup.md`](step-5-test-cleanup.md) — independent of all; can interleave with any of them. No phase ordering between them.

## Phase 0: Verified architecture note (no code yet)

Establish ground truth before touching anything. Output is a short note delivered to the user; nothing else lands in this phase.

- [x] **Step 1 — Map the two trees:** Confirm `.agent-src.uncompressed/` is the hand-edited source and `.agent-src/` is the compiled output. Document the exact `task` target that regenerates the compiled tree and the gate that prevents hand-editing `.agent-src/`.
- [x] **Step 2 — Trace the persona pipeline:** Document end-to-end how a persona file flows: classification (`scripts/skill_linter.py` artifact-type classifier) → schema validation (`scripts/schemas/persona.schema.json`) → lint (`lint_persona` in `skill_linter.py`) → compress (compress pipeline target) → sync (`task sync`) → consumption (`refine-ticket` skill + command, `--personas=` CLI flag). One paragraph per stage with file:line citations.
- [x] **Step 3 — Enumerate every sibling-change site:** List every file that needs a parallel change for the new axis (linter classifier branches, lint hook table, schema dir, compile pipeline target, test files, audit script, README cross-link, refine-ticket skill + command, frontmatter contract if any). One bullet per file with a one-line "what changes" note. Note any sites where the persona system has a clean hook vs. where mirroring requires adding a new switch.
- [x] **Step 4 — Reconcile the brief against reality:** Report any divergence between the brief (esp. `docs/contracts/decisions/`, repo name) and what's in the tree. Already known: ADRs are flat `docs/contracts/adr-*.md`, repo is `event4u/agent-config`. Confirm or expand.
- [x] **Step 5 — STOP-and-report gate:** If the persona pipeline has materially changed since the brief was written (e.g. schema migrated, classifier rewritten, refine-ticket command surface shifted), present the divergence to the user before proceeding. Do not force the mirror on a stale assumption.

## Phase 1: Schema + contract + ADR

Lock the file format and the contract before any directory or code work. ADR records WHY the axis is split; schema doc + JSON schema lock the shape.

- [x] **Step 1 — Author the locked schema doc:** Create `docs/contracts/user-type-schema.md` modeled on `persona-schema.md`. Frontmatter required: `id`, `kind: user-type`, `description`, `source` (project-specific the typical case), `version`. Optional: same optional keys persona-schema.md exposes that semantically apply. Section spine (locked): `## Focus` (who, context) · `## Daily Workflow` (concrete) · `## Vocabulary` (domain terms the software must use) · `## Operational Constraints` (mobile / offline / gloves / noise / time pressure / connectivity / lighting) · `## Unique Questions` (≥ 3, falsifiable against a ticket, not asked verbatim by any persona) · `## Ticket Red Flags` (what this lens would flag as missing or unrealistic) · `## Anti-Patterns` (Guardrails encoded — review-only, never operational instruction). Size budget: match the persona budget unless the spine forces a higher cap — pick one number, justify it in one sentence inside the schema doc.
- [x] **Step 2 — Author the JSON schema:** Create `scripts/schemas/user-type.schema.json` modeled on `persona.schema.json`. Mirror the field structure; differ on `kind` (const `user-type`), `source` (default project-specific), and the required-sections list.
- [x] **Step 3 — Author the ADR:** Create `docs/contracts/adr-user-types-axis.md` (flat layout per repo convention — **not** `decisions/` subdir despite the brief's wording). Sections: Status · Context (overloaded persona axis, two semantics) · Decision (split into parallel axis) · Consequences (one extra CLI flag, one extra schema, one extra lint hook, three seed files; existing persona surface unchanged) · Alternatives considered (extending persona schema with a `subtype` — rejected, scales worse).
- [x] **Step 4 — Lock-in check:** Confirm the locked persona schema and `persona.schema.json` are byte-identical to before this phase (`git diff` empty on those files). Existing `--personas=` behavior cannot drift in v1.

## Phase 2: Directory + compile integration + template + README

Create the new tree and wire it through the existing compile pipeline. No content yet — just the structural twin.

- [x] **Step 1 — Create the source directory:** `.agent-src.uncompressed/user-types/` with a `README.md` mirroring `personas/README.md` shape — what a user-type is, what it is NOT (review-lens only, not an operational manual), the schema summary, how skills cite it, authoring rules including the Anti-Generic Quality Bar and Guardrails.
- [x] **Step 2 — Create the template:** `.agent-src.uncompressed/user-types/_template/user-type.md` mirroring `_template-specialist/persona.md` shape with the new section spine and frontmatter contract from Phase 1.
- [x] **Step 3 — Wire the compile pipeline:** Update `Taskfile.yml` / `taskfiles/` so `task sync` and `task compress` traverse `user-types/` the same way they traverse `personas/`. Verify `.agent-src/user-types/` is generated and `.augment/user-types/` (or whatever projected target the persona axis uses) is generated. Adding the new dir to a passlist is preferred over hand-rolled traversal.
- [x] **Step 4 — Confirm `task ci` is green:** Run `task sync`, `task compress`, `task ci` after the wiring. No content in the new dir yet beyond README + template — CI must accept the empty axis.

## Phase 3: Linter support

Extend the classifier and lint table so user-types are first-class. Audit every `/personas/` path match in `skill_linter.py` and decide treatment for `/user-types/`.

- [x] **Step 1 — Add the artifact-type classifier branch:** In `scripts/skill_linter.py`, register `user-type` as a known artifact type alongside persona. Every existing `if "/personas/" in path_str:` (line ~515, ~2027, audit the rest) gets an explicit decision: "also matches user-types" → extend the condition; "personas-only" → leave alone and document why one line above.
- [x] **Step 2 — Author `lint_usertype`:** Mirror `lint_persona` (line ~1641). Checks: frontmatter shape against `user-type.schema.json`, required sections per the schema spine, size budget, ≥ 3 Unique Questions, `id` matches filename stem, `description` length cap matches the persona cap.
- [x] **Step 3 — Exclude from execution-oriented linting:** User-types are passive review-lens documents — exclude them from execution-related linters the same way personas are. Cite the exact persona-side guard and mirror it.
- [x] **Step 4 — `task lint-skills` green:** Run after the linter additions. Empty `user-types/` (README + template only) must pass.

## Phase 4: `refine-ticket` integration

Wire the new axis into the consumer skill without disturbing `--personas=`.

- [x] **Step 1 — Command surface:** Update `.agent-src.uncompressed/commands/refine-ticket.md` — add `--user-type=<id>` (single id in v1; multi-user-type deferred to v2 with a one-line note). Document that `--user-type=` and `--personas=` compose orthogonally.
- [x] **Step 2 — Skill procedure:** Update `.agent-src.uncompressed/skills/refine-ticket/SKILL.md` — teach the procedure to load the user-type lens after the persona lens and apply it as the END-USER viewpoint. One sentence makes the contract explicit: "Persona = how we review (methodology). User-type = who we simulate (end user). They compose: the persona reviews **as** the user-type would experience the software."
- [x] **Step 3 — Frontmatter contract decision:** Decide whether skills may declare a default `user-types:` key in frontmatter (analog to `personas:`). v1 pick: **CLI-only**, no skill-level default, smaller surface. Document the decision and the migration path to v2 if/when needed.

## Phase 5: Tests

Mirror the persona test pattern; existing persona tests must stay green.

- [x] **Step 1 — Integration test:** Add `tests/work_engine/test_user_type_integration.py` mirroring `test_persona_integration.py`. Cover: loading a user-type, applying it in a `refine-ticket` invocation, persona + user-type composition.
- [x] **Step 2 — Schema / lint test:** Add `tests/work_engine/test_user_type_policy.py` mirroring `test_persona_policy.py`. Cover: schema validation, section spine enforcement, ≥ 3 Unique Questions check, Guardrails encoded in Anti-Patterns.
- [x] **Step 3 — Coverage audit:** Add `scripts/skill_tools/audit_user_type_coverage.py` (sibling to `audit_persona_coverage.py`) or extend the persona audit to cover both axes. Whichever is the smaller diff.
- [x] **Step 4 — `task test` + `task ci` green** end-to-end with all three Phase-6 seed user-types landed (or with the test fixtures in place if seeds land in Phase 6).

## Phase 6: Three seed user-types

Real, lint-passing files. Each must encode ≥ 5 concrete, domain-specific review points and bake the Guardrails into Anti-Patterns. Anti-Generic Quality Bar is the merge gate — generic prose is rejected.

- [x] **Step 1 — `galabau-field-crew`:** `.agent-src.uncompressed/user-types/galabau-field-crew.md`. Encode: gloves + capacitive touch failures, no-signal sites + offline queue + conflict resolve, billable-change documentation (timestamped photo + customer signature), site-day rhythm (morning brief → execution → end-of-day proof), bilingual crew + plain-German vocabulary. ≥ 3 Unique Questions specific to this lens.
- [x] **Step 2 — `metalworking-shop`:** `.agent-src.uncompressed/user-types/metalworking-shop.md`. Encode: shop-floor tablet vs office desktop split, job-traveler / route-card workflow, material-certificate traceability obligation, safety-sign-off prerequisite per process step, noise + PPE constraints on UI affordances. ≥ 3 Unique Questions specific to this lens.
- [x] **Step 3 — `truck-driver`:** `.agent-src.uncompressed/user-types/truck-driver.md`. Encode: driving-while-using-device prohibition (voice / large tap, no typing in motion), proof-of-delivery (photo + signature + GPS timestamp) for invoicing, route reordering + ETA recalc on the move, dead-zone tolerance (queue + sync), hours-of-service / break-window awareness as a ticket-requirement signal. ≥ 3 Unique Questions specific to this lens.
- [x] **Step 4 — Guardrails check:** Each seed's `## Anti-Patterns` explicitly forbids trade execution instructions (welding procedure, electrical work, structural advice) and dangerous how-to. Reviewer test: a generic reviewer persona could not have produced the Unique Questions or Ticket Red Flags of any of the three seeds.

## Phase 7: Migration note + cross-reference

Make the axes discoverable from each other without moving any existing files.

- [x] **Step 1 — Cross-link in `personas/README.md`:** Add one sentence near the top: "For end-user-of-the-software lenses (galabau field crew, truck driver, metalworking shop), see the parallel `user-types/` axis — personas describe **how** we review, user-types describe **who** we simulate."
- [x] **Step 2 — Explicit no-move policy:** State in this roadmap's Done section and in `user-types/README.md` that no existing persona moves in this roadmap. The three seeds are born as user-types; existing personas stay as personas.
- [x] **Step 3 — Follow-up suggestions (do NOT execute here):** If, during Phase 0, any existing persona looks misfiled as a user-type (or vice versa), list it in a single bullet block at the bottom of this roadmap under `## Follow-ups (not in scope)`. No file movement happens in this PR.
- [x] **Step 4 — Final acceptance:** `task lint-skills`, `task test`, `task ci` all pass. `git diff` on `docs/contracts/persona-schema.md`, `scripts/schemas/persona.schema.json`, `.agent-src.uncompressed/personas/*.md` (except the README cross-link) is empty. `--personas=` behavior unchanged.

## Acceptance criteria

- [x] New `.agent-src.uncompressed/user-types/` tree exists with README + `_template/` + three seed files, all lint-passing
- [x] `docs/contracts/user-type-schema.md` and `scripts/schemas/user-type.schema.json` locked; ADR `docs/contracts/adr-user-types-axis.md` recorded
- [x] `scripts/skill_linter.py` recognises `user-type` artifact type; every `/personas/` path match has a documented decision for `/user-types/`
- [x] `refine-ticket` command accepts `--user-type=<id>`; SKILL.md documents persona + user-type composition
- [x] `tests/work_engine/test_user_type_integration.py` and `test_user_type_policy.py` exist and pass; persona tests unchanged and still green
- [x] Three seed user-types each carry ≥ 5 concrete, domain-specific review points and ≥ 3 Unique Questions; Anti-Patterns encode the Guardrails
- [x] `personas/README.md` carries the one-sentence cross-link; no existing persona moved
- [x] `task lint-skills`, `task test`, `task ci` green end-to-end

## Done

- [x] All phases complete, acceptance criteria met, no commits without explicit per-step user approval.

## Follow-ups (not in scope)

- _(empty until Phase 0 surfaces candidates)_
