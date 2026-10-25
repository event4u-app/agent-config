---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: >
    `road-to-a-map-that-answers` is archived, so the Workbench page and its
    `map.json` fields exist for every lens here to extend, and a WIP slot is free
    under the cap of five.
  when: >
    The run that closes that roadmap; it was authored in the same round and is
    executed in the same invocation.
  who: >
    none — the maintainer moves this file to `agents/roadmaps/` when the
    condition holds.
review_by: 2026-12-07
estate_offset_exempt: "Parked, not active: the owner's turn-2 demands (deep analysis of the reference tools, memory and every knowledge source visualised) need the Workbench page of road-to-a-map-that-answers to exist first. Owner search: grep -rlF for map_model, map_viewer, agents/map, blast radius, churn and typed-knowledge-graph over agents/roadmaps/*.md, later/ and stubs/ found no roadmap owning the page or the memory view; stubs/road-to-typed-knowledge-graph-memory owns a typed memory store, not its visualisation, and keeps that subject."
relates:
  - slug: road-to-a-map-that-answers
    relation: disjoint
    note: "Parent of the page. Every lens here is a new tab or column on that page and a new field in its map.json; nothing here re-plans its fields."
  - slug: road-to-typed-knowledge-graph-memory
    relation: disjoint
    note: "Stub that owns a typed entity-relation memory store and its four gates. Phase 2 here only draws the memory that exists; it adds no store and no retrieval path."
---
# Road to a knowledge atlas

> **Source:** `agents/tmp.old/inbox-2026-10-ap/` — the owner's second turn
> (2026-10-25) and the second drafted analysis beside it. The first turn's data
> and page are planned in `road-to-a-map-that-answers`; this file carries what
> that roadmap names as out of its scope.
>
> **The owner's demand, turn 2:** analyse the other tools with our own depth
> and see how AC improves from them; visualise memory and all other knowledge
> sources and stores too; go really deep.

## Goal

The Workbench page answers four questions about one selection, not one: how
the code is built (done by the parent), what a change reaches, what AC knows
about it and where that knowledge came from, and what AC has learnt or stored
about it and whether that is still valid. Each reference tool the analyses
named has a written adopt / adapt / reject verdict from a deep read of its
tree, and every adopted item is a step here or in the parent's successor.

## Phase 1 — The reference tools, read in depth

- [ ] **1.1 Run `/analyze:reference` on each tool the analyses named** —
      eleven references (code-map viewers, blast-radius and hotspot tools, a
      dependency-rule checker, two agent-memory graph stores), listed by name
      only in the round's local intake under `agents/tmp.old/inbox-2026-10-ap/`
      — one verdict table per tool as Source A–K, sources anonymised per
      `source-confidentiality`, raw named evidence kept local-only.
      verify: one findings file per tool under `agents/evidence/analysis/`
- [ ] **1.2 Fold the adopted items** into the phases below or into a named
      successor, each with the tool's finding id.
      verify: each adopted row in the 1.1 files names the step that carries it

## Phase 2 — Memory on the page

- [ ] **2.1 Memory collector.** Per file, the memory entries that name it,
      with source, `last_validated`, `review_after_days` and whether retrieval
      returned it in the window — the design's "Memory ?" group filled.
      "Mentioned" is a guessed link, never a described one.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0
- [ ] **2.2 Memory Atlas lens.** Entries by lifecycle (fresh, due, stale,
      superseded), their links to files, roadmaps and decisions, and the
      gaps: a file with drafts but no contract or memory.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0

## Phase 3 — Knowledge beyond one file

- [ ] **3.1 Knowledge & Source explorer.** ADRs, contracts, roadmaps, evidence
      and inbox rounds as a graph of `supersedes` / `superseded_by` /
      `routes_to`, with stale and contradicting entries marked, not hidden.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0
- [ ] **3.2 Agent execution & learning.** Runs, decisions, tests and outcomes
      per area from the data AC already keeps (`map-outcomes.jsonl`, run
      records), as a loop from finding to fix to outcome.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0

## Phase 4 — The remaining code lenses

- [ ] **4.1 Complexity per symbol.** Branch count per function from the
      tree-sitter grammars; the Complexity colour-by and a churn × complexity
      hotspot variant beside the parent's churn × size.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0
- [ ] **4.2 Flow lens** from the request paths the model already holds.
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0
- [ ] **4.3 Change lens and co-change.** Diff neighbourhood, test selection,
      PR overlap, and co-change as a relation (`git-history`, inferred).
      verify: `npx vitest run tests/scripts/code_graph_map.test.ts` -> 0

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A drawn link reads as a confirmed one | product | two memories naming one class are drawn as "describes" | mentioned links are guessed edges, dashed, never solid | Phase 2 — Memory on the page |
| 2 | A graph is added because it looks good | implementation | a typed memory store is built for the picture | this file draws memory only; the store stays with its stub and its gates | Phase 2 — Memory on the page |

## Acceptance Criteria

- [ ] AC-1 — Each named tool has a verdict file, and each adopted item is a
      step somewhere with the finding id.
- [ ] AC-2 — The memory group on the page is filled from a collector, and a
      stale or superseded entry is visibly different from a fresh one.
