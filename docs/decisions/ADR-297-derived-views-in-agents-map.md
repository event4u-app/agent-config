---
adr: 297
status: accepted
date: 2026-10-23
decision: derived-views-in-agents-map
supersedes: —
superseded_by: —
amends: ADR-124
phase: road-to-a-map-that-draws-itself · step 0.1
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: owner
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/roadmaps/road-to-a-map-that-draws-itself.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
review_trigger: >-
  Reopen if a derived view under agents/map/ is found carrying anything that is
  not rebuildable from the index plus the tree (a hand edit, a recorded outcome,
  a secret), if the map is ever committed by default, or if a fourth pinned
  dependency is added under this record without its own justification row.
---

# ADR-297 — A Class-A engine may write human-facing derived views to `agents/map/`

## Status

Accepted 2026-10-23 on the owner's directive of the same day ("build the map in a
project's `agents/` folder"). **Amends ADR-124 § 1, Class-A row, state clause only;
does not supersede it.** Every other part of ADR-124 stands, including Class C
(no network or model call in a build path) and the termination clause.

## Context

ADR-124 Class A allows engine state "only as gitignored, rebuildable build/index
artifacts under the suite's own runtime dirs (`agents/runtime/state/`)". The code-graph
map (`agent-config code-graph map`) produces three artefacts a **person** opens:
`index.html`, `MAP.md` and per-area pages, plus the `map.json` they are rendered from.
Under `agents/runtime/state/` they sit beside lock files, ledgers and a 140 MB SQLite
index, where nobody looks. The owner asked for the map in the project's `agents/`
folder, and the layout contract (`docs/contracts/agents-layout.md`) is a whitelist
that has no row for it.

## Decision

1. **The index stays where it is.** The graph JSON, its extract sidecar and the
   SQLite twin remain under `agents/runtime/state/`. Nothing changes for them.
2. **Derived views get their own registered directory, `agents/map/`.** A Class-A
   engine may write human-facing views of its own index there. They are:
   - **rebuildable** — deleting the directory loses nothing a rebuild does not restore;
   - **gitignored by default** — the consumer `.gitignore` block lists `agents/map/`;
     a project that wants to commit its map opts in by removing the line;
   - **local** — no network, no model call, same as the engine (Class C unchanged).
3. **The layout contract gains the row** `map/ | both | local-only (gitignored) |
   rebuildable | code-graph map` and `lint_agents_layout` admits `map`.

## Dependency justifications (ADR-124 § 1: per dependency, in the adopting ADR)

| Dependency | Why a lighter option does not suffice |
|---|---|
| `graphology` (MIT, pure JS) | The graph container the two algorithms below operate on. A hand-rolled adjacency structure would have to re-implement its iteration and attribute API just to feed them. |
| `graphology-communities-louvain` (MIT, pure JS) | Seeded Louvain modularity clustering is the area definition. A correct, deterministic implementation with a seeded RNG is ~600 lines of numerics; re-deriving it adds risk without adding capability. |
| `graphology-layout-forceatlas2` (MIT, pure JS) | The precomputed layout that lets the viewer open without browser physics (the reference tool's stack-overflow failure). Run synchronously, iteration-bounded, from a seeded start, so the output is byte-reproducible. |
| Map viewer (`src/scripts/code_graph/map_viewer/`) — **not a dependency** | The HTML must work offline with zero external URLs, so the renderer is inlined. It is a small canvas renderer written in this repository rather than a vendored third-party bundle, so no package and no licence notice is added. |

All three packages carry no install script and no native step; they are runtime
dependencies because a consumer builds its own map. They take caret floors at a
settled `.0` patch like every other runtime dependency (`check_dependency_floors`);
the lockfile pins the exact versions, and the map's byte-identical output is a
property of one installed set, tested per build rather than promised across
upgrades.

## Evidence

- The map was built on this repository (4,589 files, 110 areas, ~2 s on top of the
  engine) and rendered at 1440 / 375 / 320 px with zero page errors, zero network
  requests and no label cut off or overlapping (`agent-config code-graph map`,
  render check `verified`, 2026-10-23).
- `tests/scripts/code_graph_map.test.ts` pins determinism, the offline page, the
  hostile-name escaping and the absence of host paths in every artefact.

## Consequences

- `agents/map/` is a second engine-written directory. Anything written there must pass
  the rebuildable test above; a recorded outcome or a learning overlay belongs in
  `agents/runtime/state/` and is only *drawn* in the map.
- The `.gitignore` block grows by one line for every consumer on the next install.

## Alternatives considered

- **Keep the map under `agents/runtime/state/map/`.** Rejected: the owner asked for it
  in `agents/`, and a person does not browse runtime state.
- **Commit the map.** Rejected as a default: it changes on every commit and needed a
  merge driver in the reference tool. Left as a per-project opt-in.

## References

- ADR-124 § 1 — the Class-A row this amends.
- `agents/roadmaps/road-to-a-map-that-draws-itself.md` — Phase 0.
