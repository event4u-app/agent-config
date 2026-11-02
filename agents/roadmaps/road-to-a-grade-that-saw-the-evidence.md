---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: 9b358fce88
estate_growth_exempt: "Owner decision OQ-63 (a) asked for the grader fix and the report-only resolver to be executed now, in the same branch that creates this roadmap. It closes and archives on that branch."
estate_offset_exempt: "grep -rlE 'grade_target_readiness|behaviour-contract|#AC-|acceptance citation|AC resolver' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole active, later and stub tree) — no match; no roadmap owns the readiness grader's behaviour-contract probe or an acceptance-citation resolver. stubs/road-to-executable-specification-adapter owns only the executable-spec adapter (related, not promoted here)."
relates:
  - slug: stubs/road-to-executable-specification-adapter
    relation: disjoint
    note: "The grader now counts an executable specification as contract evidence; the adapter that would run one stays in the stub."
  - slug: archive/road-to-records-that-say-what-is-true
    relation: disjoint
    note: "Carried M7.2 and E4 (report-only half) from its owner-decision table; the rest of that table stays deferred below."
---

# Road to a grade that saw the evidence

> **Source:** Owner decision OQ-63 (agents/owner-questions.md § Answered,
> 2026-11-02) — option (a): the readiness-grader fix first, then a report-only
> `<slug>#AC-n` resolver. No ratchet; the ratchet stays council-reserved.

## Goal

The readiness grader stops reporting a behaviour contract it did not see: an
`AGENTS.md` (or any prose file) at the root no longer passes the dimension, an
executable or machine-readable contract does. Then a report-only resolver
measures how many acceptance-criterion citations in the test tree resolve to
exactly one roadmap anchor — a number, not a gate.

## Context — verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| C1 | The behaviour-contract dimension passes on `AGENTS.md` / `CONTRACT.md` presence | still-true | `src/scripts/grade_target_readiness.ts:349-357` |
| C2 | The registry names that limitation and marks `behavior-spec` `degraded` | still-true | `src/config/assurance-capability-registry.json:52-63` |
| C3 | The `full` fixture's only contract file is `AGENTS.md` | still-true | `tests/fixtures/target-repos/full/` |
| C4 | No test file uses the explicit `<slug>#AC-n` form; 123 files under `tests/` cite a bare `AC-n` | still-true | `grep -rlE '#AC-[0-9]+' tests` → 0; `grep -rlE '\bAC-[0-9]+' tests` → 123 |
| C5 | Roadmaps declare AC anchors as list / table lines opening with `AC-n` | still-true | e.g. `agents/roadmaps/archive/road-to-executable-specification-layer.md:414` |

## Phase 1 — The grader grades evidence

- [ ] **1.1 A prose-only target does not pass (test first).** A target whose
      only candidate is `AGENTS.md` grades 0 on `behaviour-contract`; an
      OpenAPI document or a Gherkin feature file grades above 0.
      verify: `npx vitest run tests/scripts/grade_target_readiness.test.ts` -> 0
- [ ] **1.2 Registry, fixtures and command doc say the new truth.**
      verify: `jq -r '.capabilities["behavior-spec"].limitations | join(" ")' src/config/assurance-capability-registry.json` -> /executable/

## Phase 2 — Report-only acceptance-citation resolver

- [ ] **2.1 Resolver with tests.** `src/scripts/report_acceptance_citations.ts`
      classifies each cited `AC-n` (explicit `<slug>#AC-n`, or bare with the
      file's named roadmap slugs as candidates) as resolved, ambiguous or
      dangling against the whole roadmap tree. Always exits 0.
      verify: `npx vitest run tests/scripts/report_acceptance_citations.test.ts` -> 0
- [ ] **2.2 Report-only task, measured number recorded.** A
      `report-acceptance-citations` task outside every CI pipeline; the
      measured file counts land in the table below.
      verify: `./scripts-run src/scripts/report_acceptance_citations` -> /resolved/

## Measurement

Filled by step 2.2.

## Owner decisions — carried, not executed here

| ID | Decision | State |
|---|---|---|
| E4-ratchet | A ratchet over the resolver's dangling / ambiguous counts | Council-reserved (OQ-63) |
| E1/E3 | `promotes:` receipt at archive time | Deferred (OQ-63) |
| E5 | Spec judge on the consumer `/work` path | Deferred (OQ-63) |
| M6.4 | Narrower Doc-Impact `.md` glob in the consumer template | Deferred (OQ-63) |
| D5 | Structured partial supersession (18 ADRs) | Deferred (OQ-63) |
| M6.1 | Optional object form for ticket `acceptance` | Deferred (OQ-63) |
