---
complexity: structural
status: later
tree_pin: 9b6242da90
review_by: 2027-01-15
entry_condition:
  what: "a free slot under the WIP cap of 25 active roadmaps"
  when: "when an active roadmap closes"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: >-
  Receiver for owner directives OD3 (modularity in the DDD sense as the default where possible,
  modules replaceable, docking via events) and OD4 (one source, one truth) from round
  inbox-2026-11-xa. The two are one roadmap because they meet: sharing code across modules to
  avoid a copy is the coupling OD3 rules out. Lands in later/ because 32 roadmaps are active
  against a WIP cap of 25.
estate_offset_exempt: >-
  Owner search ran before this file was written:
  grep -rlF -e swap-check -e find-existing -e modular -e 'bounded context' -e 'code-graph twins'
  -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs — no hit.
  road-to-a-map-that-holds-on-the-real-repo (active) owns domain completeness on the map (7.1);
  it is read, not edited.
relates:
  - slug: road-to-a-decision-that-shows-its-matrix
    relation: feeds
    note: "Supplies the computed Boundary and Truth cells. Each phase here is useful without the matrix."
  - slug: road-to-a-map-that-holds-on-the-real-repo
    relation: disjoint
    note: "Active. Owns domain assignment on the map; the Boundary cell reads its output."
  - slug: road-to-repo-knowledge-generated-not-written
    relation: disjoint
    note: "Active. Its constraint — project knowledge is generated, not hand-written — binds the `sources` map here."
---
# Road to modules you can swap and facts with one source

> **Source:** `agents/tmp.old/inbox-2026-11-xa/` — an owner transcript plus two external plan
> chains. Claims verified against `main@9b6242da90` on 2026-11-24.

> **Owner directives (2026-11-23, owner's own words, recorded as owner intent):**
> - **OD3.** Modularity in the DDD sense: a module — the owner's example, a chat — can be taken
>   out and replaced by another; other code docks onto its processes through events and does
>   not use the module's code. **Constraint, stated by the owner:** this does not always work;
>   where it does, AC uses it as the standard and supports the user in getting there.
> - **OD4.** One source, one truth: every fact has a single authoritative place; code is not
>   spread or duplicated.

## Goal

AC can tell, for a declared module, what would have to change to replace it; it sees coupling
through events as coupling; it offers the dock-on option before a reach-in one; and before it
writes a new function, constant, schema or rule it looks for the one that already exists.
"One source" is a fact with one owning module — inside a module reuse it, across modules
reference it through a public part, an event or a generated copy, never a hand copy and never
an import of internals. Two modules each holding their own model of a thing that means
something different to each are not a duplicate.

## Context — what the tree shows at `9b6242da90`

| ID | Finding | Evidence |
|---|---|---|
| M1 | Domains are a declared axis with an optional public part, and breaches are counted; a proposed domain never becomes a breach | `src/scripts/code_graph/domains.ts:9-10`, `:26`, `:66`; `map_knowledge.ts:103` |
| M2 | The architecture rule says nothing about module boundaries or events; events appear only as advice-tier R-A9 in a pack rule | `src/rules/architecture.md:22-24`; `src/rules/scale-discipline.md:74` |
| M3 | The graph has no event relation: `consumes` is a CI-job → image edge, `publishes` a service → port edge; a listener exists only as a flow entry kind. An event-coupled module looks uncoupled | `src/scripts/code_graph/lanes/delivery/read_delivery.ts:214`; `vocabulary.ts:75`, `:91`; `lanes/flows/flows.ts:18` |
| M4 | `module-management` reaches only the maintainer workspace | `src/skills/module-management/SKILL.md:6-7` |
| S1 | Consumers already receive one-source guidance: `redundancy-taxonomy` aims at "one honest authority per shared fact" and has the verdicts `keep-duplicated` and `de-abstract`; `abstraction-thresholds` sets the bar for extracting | `docs/guidelines/redundancy-taxonomy.md:13`, `:137-138`; `docs/guidelines/abstraction-thresholds.md` |
| S2 | No look-first step before backend code: the two rules that forbid duplication act only after the agent has found the original. UI work and new AC artefacts have one; code does not | `src/rules/active-remediation.md:45`; `senior-engineering-discipline.md:48`; `src/rules/ui-audit-gate.md:30-31`; `src/rules/improve-before-implement.md:74-76` |
| S3 | The graph cannot see a second copy: no clone, constant-twice or described-twice detection | `src/scripts/code_graph/lint.ts:9`; `map_answers.ts:177-178`; grep of `code_graph/*.ts` for clone detection: no hit |
| S4 | A project's map layers file (`layers.yaml` in its map directory; absent in this repo) has no schema; four readers each take their own key, so a `sources:` key needs a new reader, not a schema change | `map_answers.ts:381-396`; `domains.ts:48-56`; `scope.ts:59-67` |
| S5 | AC's own tree carries hand-kept twins beside its generated projections: 15 scripts with `parity` and 22 with `drift` in the name (recursive), the split unrecorded | `ls -R src/scripts` |

## What this roadmap is NOT

- It does not make events mandatory and enforces no boundary a project has not declared
  (OD3's own constraint).
- Look-alike code stays where it is unless it is the same fact; AC's parity checks stay in
  place and are only classified.
- It writes no second duplication taxonomy: every Truth finding carries a
  `redundancy-taxonomy` verdict.
- It does not widen the maintainer-only `source-of-truth` rule to consumers.

## Phase 0 — Planted repositories

Evidence (read): `src/scripts/code_graph/domains.ts:26`.

- [ ] **0.1 Fixtures** under `tests/fixtures/change-reach/`, ground truth as data: (c) two
      modules, one coupled by import, one by event, plus a module-level cycle; (d) an existing
      helper and a task that invites rewriting it, one exact and one renamed clone, a
      validation rule kept in a front end and a back end, repeated test data that must not be
      reported, a shared core grown a `consumer === …` branch chain, and two modules each with
      a deliberate model of their own.
      verify: `jq -e '.expected | length > 0' tests/fixtures/change-reach/c/truth.json tests/fixtures/change-reach/d/truth.json` -> 0
- [ ] **0.2 Thresholds K10-K13** pre-registered in the vocabulary file, one council round.
      verify: `grep -cE '^ *K1[0-3]:' src/config/decision-vocabulary.yaml` -> 4

## Phase 1 — Event edges and replaceability

Evidence (read): `src/scripts/code_graph/vocabulary.ts:91`.

- [ ] **1.1 `emits` and `handles`** in the relation vocabulary, read by framework providers that
      state them in files (listener maps, attributes, subscriber classes); an event named by a
      runtime string is `unknown`. Fixture (c) shows the event-coupled module as coupled.
      verify: `npx vitest run tests/scripts/code_graph/event_edges.test.ts` -> 0
- [ ] **1.2 `code-graph module swap-check <domain>`**: inbound edges that bypass the public part
      and events, its reaches into other modules' internals, tables it shares or writes,
      routes it owns, events it emits and who handles them, module-level cycles. One line:
      `replaceable as-is` · `replaceable after N edges move` · `cannot tell`. The answer is a
      structural swap — the output says so; capability and data portability are not claimed.
      verify: `npx vitest run tests/scripts/code_graph/swap_check.test.ts` -> 0
- [ ] **1.3 The Boundary cell**: `removes a cross-module edge · neutral · adds an edge through a
      public part or an event · adds an edge into another module's internals · unknown`. No
      declared domains → `unknown`, and AC offers the declaration snippet the map already
      proposes (M1).
      verify: `npx vitest run tests/scripts/code_graph/swap_check.test.ts -t cell` -> 0
- [ ] **1.4 Recorded breaches, new ones blocked**: a project that declares domains gets its
      existing breaches written to a baseline, each with owner, reason and expiry; a later
      option adding one fails the MUST screen; old ones are listed as debt.
      verify: `npx vitest run tests/scripts/code_graph/swap_check.test.ts -t baseline` -> 0

## Phase 2 — Look first, then write

Evidence (read): `docs/guidelines/redundancy-taxonomy.md:137-138`.

- [ ] **2.1 Failing tests on fixture (d)**: both clones found; the front/back validation twin
      found through co-change without a reference; the existing helper returned for the
      tempting task; repeated test data and the deliberate per-module models **not** reported
      as failures; the branch-chain core reported with the `de-abstract` verdict.
      verify: `npx vitest run tests/scripts/code_graph/twins.test.ts` -> /failed/
- [ ] **2.2 `code-graph twins`**: `clone-exact`, `clone-renamed` (token comparison; nothing
      fuzzier claimed), `constant-twice`, `described-twice` (a table, route or operation stated
      in two artefacts of different kinds), `moves-together` (co-change without reference),
      `consumer-branching` (a shared unit growing per-consumer branches). Each finding carries
      witnesses and a `redundancy-taxonomy` verdict; test fixtures and test data are excluded
      by default. Anything undecided is `unknown`.
      verify: `npx vitest run tests/scripts/code_graph/twins.test.ts` -> 0
- [ ] **2.3 `code-graph find-existing`**: takes a name, a signature shape or a draft snippet and
      returns existing symbols by name, signature, constants and clone match, ranked, with
      their module and whether they are in its public part.
      verify: `npx vitest run tests/scripts/code_graph/find_existing.test.ts` -> 0
- [ ] **2.4 `code-graph sources`**: a proposed map fact → authoritative place, read from the
      graph plus CODEOWNERS, OpenAPI files, migrations and ADRs, every entry `inferred`. The
      project adopts entries into a `sources:` key of the project's map `layers.yaml` through a new
      reader (S4). An inferred source never fails a MUST; a declared one does.
      verify: `npx vitest run tests/scripts/code_graph/sources.test.ts` -> 0
- [ ] **2.5 The Truth cell**: `removes a second copy · uses the existing source · derives a copy
      by generation, marked and checked · adds a hand-kept second copy · unknown`. A new unit
      with an unused `find-existing` candidate is `adds a hand-kept second copy` unless the
      option states why the candidate is a different fact — a judged cell with a basis ref
      naming what would have to change together if it were wrong.
      verify: `npx vitest run tests/scripts/code_graph/find_existing.test.ts -t cell` -> 0
- [ ] **2.6 Twins feed the defect-pattern search**: after a fix, `downstream-changes` §
      Defect-pattern search asks `twins` for the fixed span's clones before it greps, in its
      mechanics context, not the rule body.
      verify: `grep -c 'code-graph twins' src/agent-src/contexts/execution/mandated-lines.md` -> /[1-9]/

## Phase 3 — Guidance where the user works

Evidence (read): `src/rules/architecture.md:59` routes structure to `module-detect-on-the-fly`.

- [ ] **3.1 `docs/guidelines/modular-by-default.md`** and a section in `module-detect-on-the-fly`:
      module = public part + events; dock on, do not reach in; choose a synchronous call or an
      event by whether the caller needs the answer; when it does not fit (an atomic transaction
      across modules, a hot path) say so and record it as a decision. Inside a module reuse;
      across modules reference or derive; run `find-existing` before creating; a deliberate
      twin is recorded with `decision:memo` and a recheck condition. The guideline cites
      `redundancy-taxonomy` and `abstraction-thresholds` instead of restating them.
      verify: `test -f docs/guidelines/modular-by-default.md` -> 0
- [ ] **3.2 A look-first step** in `code-refactoring` and in the context
      `senior-engineering-discipline` loads (not the rule body).
      verify: `grep -c 'find-existing' src/skills/code-refactoring/SKILL.md` -> /[1-9]/
- [~] **3.3 `module-management` for consumers**: open it to the engineering workspace, or keep
      the new `module-detect-on-the-fly` section as the consumer carrier.
      <!-- blocked-by: module-management-workspace -->
      verify: `grep -A2 '^workspaces' src/skills/module-management/SKILL.md` -> /engineering|agent-config-maintainer/

## Phase 4 — AC holds itself to OD4

Evidence (read): `src/scripts/check_generated_artefact_headers.ts` exists.

- [ ] **4.1 A generated census of the parity and drift checks**: for each script with `parity`
      or `drift` in its name, does it guard a generated projection or a fact kept by hand in
      two places? The second group is listed as debt with both locations. No consolidation.
      verify: `grep -cE '^\| [a-z_]+(parity|drift)[a-z_]* \| (projection|hand-twin) \|' agents/evidence/analysis/twin-guard-census-*.md` -> /^[1-9][0-9]$/
- [ ] **4.2 `twins` and `sources` on this repository**, compared with 4.1: a twin the census
      missed, or a census row the verbs cannot see, is a finding either way. Precision per
      twin kind and the false-positive rate on deliberate twins feed K10-K12.
      verify: `grep -cE '^\| (clone-exact|clone-renamed|constant-twice|described-twice|moves-together|consumer-branching) \| precision 0\.[0-9]+ \|' agents/evidence/analysis/twins-self-run-*.md` -> 6

## Kill criteria (thresholds set in 0.2)

| ID | Fires when | Then |
|---|---|---|
| K10 | precision of a twin kind, or the `find-existing` hit rate, is below the floor | that kind stays advisory and out of the Truth cell |
| K11 | deliberate twins are failed above the set rate | the Truth MUST screen is off until 2.5 is fixed |
| K12 | event-edge precision on fixture (c) is below the floor | `emits`/`handles` stay advisory and out of the Boundary cell |
| K13 | `swap-check` reports `replaceable as-is` for the import-coupled module of fixture (c) | swap-check output is labelled experimental |

## Decisions (proposed)

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| PD13 | business-owned | owner (OD3) | Dock-on is the generated default sibling and the tie-break; a MUST only where the project declared domains | M1; OD3's own constraint | the owner wants enforcement without a declaration |
| PD15 | business-owned | owner (OD4) | The unit of "one source" is a fact; scope is per owning module; across modules reference or derive, never hand-copy, never import internals | S1; OD3 + OD4 | the owner wants textual duplication removed regardless of meaning |
| PD16 | contested-technical | proposed | Second copies are evidenced by computed signals; sameness of meaning is a judged cell with a basis | S3; clone-detection literature (types 1-2 reliable, 3 partly, 4 not) | K10 |
| PD17 | deterministic | proposed | Sources of truth are inferred by a command and adopted by declaration; only declared sources fail a MUST | `road-to-repo-knowledge-generated-not-written` constraint; `domains.ts:1-12` | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Wrong abstraction for a copy | product | "One source" pushes two modules onto a shared unit, creating the coupling OD3 forbids | truth scoped per owning module; `de-abstract` and `keep-duplicated` are first-class verdicts | Phase 2 — Look first, then write |
| 2 | Events hide coupling | product | Without event edges an event-coupled module reads as independent and dock-on looks free | 1.1 lands before the Boundary cell; K12 | Phase 1 — Event edges and replaceability |
| 3 | Noise from twin detection | implementation | Test data, generated files and deliberate models flood `twins` and the agent learns to ignore it | default exclusions; fixture (d) negatives; K10, K11 | Phase 2 — Look first, then write |
| 4 | Enforcement without consent | product | A boundary is enforced in a project that never declared domains | inferred domains never breach (M1); 1.3 offers, does not enforce | Phase 1 — Event edges and replaceability |

## Blockers

### blocker: module-management-workspace
- **Status:** open
- **Owner:** council
- **Class:** 1
- **Ownership:** contested-technical
- **Blocks:** Phase 3 — step 3.3
- **Question:** Open `module-management` to the engineering workspace, or carry OD3 for consumers only through the new `module-detect-on-the-fly` section?
- **Recommendation:** carry it through `module-detect-on-the-fly` first; open the skill only if the 3.1 section proves too thin.

## Acceptance Criteria

- [ ] AC-1 — Fixture (c): the event-coupled module is coupled, the import-coupled one is `replaceable after N edges move`.
- [ ] AC-2 — Fixture (d): both clones and the helper are found; deliberate models and test data are not failed.
- [ ] AC-3 — Every `twins` finding carries a `redundancy-taxonomy` verdict; no new duplication class list exists.
- [ ] AC-4 — No boundary is enforced in a project without declared domains.
