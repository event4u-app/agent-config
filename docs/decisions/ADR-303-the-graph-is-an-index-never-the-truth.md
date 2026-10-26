---
adr: 303
status: accepted
date: 2026-10-26
decision: the-graph-is-an-index-never-the-truth
supersedes: —
superseded_by: —
amends: ADR-297, ADR-299
phase: road-to-a-map-the-agent-checks-before-it-acts · step 3.9
type: structural
reopen_policy: owner
protected_dimensions: none
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-10-26-graph-is-an-index.md
    - docs/decisions/ADR-297-derived-views-in-agents-map.md
    - docs/decisions/ADR-299-a-graph-home-beside-the-project-graph.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
review_trigger: >-
  Reopen if a confirm of a fact's witness is measured above its latency budget
  on this repository so often that agents stop running it, if a graph, map or
  cache is found written outside the two layouts, or if the owner asks for the
  graph to be trusted without a witness check for a named class of facts.
---

# ADR-303 — The graph is an index, never the truth; one folder per home

## Status

Accepted 2026-10-26 on the owner's direction of the same day (turn 13 of round
`round-7c3e91`, quoted in the owner-directive file named in the evidence
basis). **Amends ADR-299's title and § Decision wording** — "the project graph
stays the only truth" now reads "the project graph is the only *index* of a
project; the source files are the truth" — **and ADR-297 § 2**, whose layout
gains the per-area folders and a single gitignored `.build/`. ADR-124 stands
unchanged: no network and no model call on a build path.

## Context

The code graph answers "who calls X", "which tables does this route reach" and
now columns, interfaces, runtime and delivery facts. Freshness was measured for
the whole graph only (`src/scripts/code_graph/detect.ts:225-331`), and the shipped
rule told agents to read source only for what the index does not cover
(`src/rules/external-code-graph-interop.md:62-68`). A fresh graph that misses a
dynamic usage therefore counted as complete. Two measured defects at the same
pin show a fresh graph can omit or misattribute facts: the Laravel `User` model
had no edges (`providers/laravel.ts:91`) and an outbound `Http::post` resolved to
an in-repo `Comment::post` (`build.ts:784-819`). Graph artefacts sat in five
places (`graph_home.ts:18-19`, `estate_index.ts:9`, `estate_map.ts:27-29`), and a
file written beside the map by another command was carried forward but never
regenerated (`map.ts:490-499`).

## Decision

1. **Every graph answer is a pointer with a witness** — `file:line` plus a hash
   of the span that was read. A witness is evidence of where to look, not of
   what is there now.
2. **Confirm before acting.** An agent about to change code on the strength of a
   graph fact re-reads that fact's witnesses (`confirmed | moved | changed |
   gone`). The depth follows the change-risk class.
3. **Counts are lower bounds**, paired with a text search for the name; a
   difference is a reader defect, logged.
4. **Update after acting.** Touched files are re-read into a working-tree overlay
   and the map shows the result without a full rebuild.
5. **One folder per home.** A project's graphs, map and caches live under
   `agents/map/` (`code/`, `data/`, `interfaces/`, `runtime/`, `delivery/`,
   `manifest.json`, and `.build/` as the only gitignored part); the machine-wide
   hub mirrors that layout in the user-global home and alone carries the
   Projects area. A gate fails any writer outside the two layouts.

## Consequences

- The graph keeps its speed advantage for finding things; deciding needs a read.
- A confirm must be cheap, so it reads spans through the SQLite twin and never
  loads the JSON graph; its budget is a test on this repository.
- Existing CLI and MCP readers keep working for one release through a read
  fallback on the old cache path.
- The rule `external-code-graph-interop` changes from "grep for what the index
  does not cover" to "find with the map, confirm with the source, update after".

## Alternatives considered

- **Trust a fresh graph, re-read only on `stale`.** Rejected: both measured
  defects above occur on a fresh graph.
- **Rebuild the graph before every edit.** Rejected: loading the graph dominates
  query cost on this repository; a per-edit rebuild multiplies it.
- **Keep per-feature folders beside `agents/runtime/state/`.** Rejected by the
  owner's direction: one folder, one structure.

## Evidence

- Owner direction, verbatim, with translation:
  `agents/evidence/owner-directives/2026-10-26-graph-is-an-index.md`.
- Defects at the pin: `src/scripts/code_graph/providers/laravel.ts:91`,
  `src/scripts/code_graph/build.ts:784-819`, `src/scripts/code_graph/detect.ts:225-331`,
  `src/rules/external-code-graph-interop.md:62-68`, `src/scripts/code_graph/map.ts:490-499`.
- Records amended: ADR-297, ADR-299.
