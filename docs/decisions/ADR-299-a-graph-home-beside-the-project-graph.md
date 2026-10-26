---
adr: 299
status: accepted
date: 2026-10-24
decision: a-graph-home-beside-the-project-graph
supersedes: —
superseded_by: —
amended_by: ADR-303
amends: ADR-297, ADR-129
phase: road-to-a-graph-that-follows-you · step 2.1
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: mixed
  agentic_mode: council
  decision_makers: [owner, council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/roadmaps/archive/road-to-a-graph-that-follows-you.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
    - docs/decisions/ADR-129-sqlite-substrate-maintainer-override.md
    - docs/decisions/ADR-297-derived-views-in-agents-map.md
review_trigger: >-
  Reopen if a graph or index under the user-global home is found to leave the
  machine, if a repository without `agents/` is found written into by a graph
  build, if a merged machine-wide graph is proposed again with a measured
  cross-project coupling the estate index cannot answer, or if the owner asks for
  source lineage to be auditable in CI (council decision O5).
---

# ADR-299 — The project graph stays the only truth; the user-global layer is a home and an index, never a merged graph

> **Note, 2026-10-26 — owner attribution unverified, not a reopening.** This record
> names the owner as decision-maker but cites none of his words. The owner states it
> was created automatically: much of its substance is his, but he did not ask for it
> as a record and does not confirm this one
> (`agents/evidence/owner-directives/2026-10-26-auto-created-adrs.md`). Read the
> decision as owner-directed; do not cite it as owner authority or as precedent for
> an owner-reserved transition.

> **Amended 2026-10-26 by [ADR-303](ADR-303-the-graph-is-an-index-never-the-truth.md).**
> "The only truth" in the title and decision reads as "the only *index*": the
> project graph is the one place to find a project's facts, the source files are
> the truth, and every graph answer is confirmed against them before an agent acts.

## Status

Accepted 2026-10-24 on the owner's two questions of the same day (a graph on the
machine as well as per project, because a project does not always carry `agents/`;
sources drawn as an encrypted graph) and on the AI-council closure of decisions
O1–O7 recorded in `road-to-a-graph-that-follows-you`. **Amends ADR-297 § 2** (the
map gains a location for roots without `agents/`) **and ADR-129** (the SQLite twin
no longer carries the graph blob). ADR-124 stands unchanged: the engine is Class A,
local, lazy, with no network or model call on a build path.

## Context

`code-graph build` and `code-graph map` always wrote into `<root>/agents/`, so a
globally installed agent asked about a repository that has no `agents/` folder
either created one in somebody else's tree or answered "no graph". The MCP graph
tools knew only the server root. The twin added by ADR-129 stored the whole graph a
second time as `meta.graph_json`, and a refresh left its temporary twin behind (11
orphans of ~166 MB in one state directory). Separately, the harvest provenance had
no stable source identity and recorded adoptions only.

## Decision

1. **The project graph is the only truth.** Inside a root that has `agents/` or a
   project install, every graph, map and lock path is exactly what it is today, and
   sharing a map through the repository is unchanged.
2. **A graph home for roots without one.** Every other root gets its graph, map and
   lock under `~/.event4u/agent-config/runtime/graphs/<repo id>/`. A build there
   writes nothing into the repository. The repo id is a machine-local HMAC (12 hex)
   over the credential-stripped canonical origin URL, the realpath without a remote;
   a worktree keeps its parent's id plus an instance suffix (O2).
3. **One registry, one index — never a merged graph.** A user-global project
   registry records projects by use (a build or refresh, or an explicit `add`) and
   never by crawling `$HOME`. An estate index stores declared packages and exports
   only, is off by default and switched on per machine (O1), and estate queries read
   the index, never a project graph. Global-home graphs are evicted least recently
   used under a stored budget, skipping pinned and lock-held entries and never
   touching a repository's own `agents/` (O4).
4. **Nothing in the user-global layer leaves the machine.** No telemetry, council,
   release, advisory report or map export path reads the registry, the index or the
   local lineage ledger; a test enforces it.
5. **Lazy, per ADR-124.** No daemon and no watcher: the index is rewritten on a
   project's own refresh.
6. **JSON stays canonical; the twin is a disposable projection (O3).** The twin keeps
   its row tables, counts and `source_checksum` and no longer stores `graph_json`;
   a refresh promotes or removes its twin and sweeps the ones a killed refresh left.
7. **Sealed lineage splits in two (O5–O7).** Anything that links a source to a
   mechanism — source ids, pins, locators — stays in a local ledger under the
   user-global home. The repository tracks a source-free decision ledger
   (`provenance/mechanisms.jsonl`) that records rejections and gaps as well as
   adoptions. The tracked lineage view shows mechanisms by verdict only. An upstream
   watch is off per source until the owner enables it and writes roadmap stubs,
   never code.

## Evidence

- The defects D1–D4 and L1–L5, each with `file:line` at `main@a15a8bbe2f`, are the
  context table of `road-to-a-graph-that-follows-you`.
- Phase 1 of that roadmap (twin promotion, orphan sweep, the dropped blob) landed
  with tests in `tests/scripts/code_graph_refresh.test.ts` and
  `tests/scripts/code_graph_sqlite_store.test.ts`.
- Council closure O1–O7: unanimous on O1–O4, O6, O7; O5 chose the stricter
  local-only option, with dissent on routing only.

## Consequences

- A repository without `agents/` can be built, mapped and queried with a clean
  `git status`.
- Estate questions ("which of my projects use package X") are answered from a small
  local index, at a disk cost bounded by the budget.
- A machine-wide answer can only be as current as each project's last refresh.
- Lineage auditing in CI is not possible by design; the tracked ledger carries
  decisions, not their sources.

## Alternatives considered

- **One merged machine-wide graph.** Rejected: it duplicates every project graph,
  id prefixing breaks every tool contract, and 13 local repositories measured zero
  package edges between them.
- **Plain SHA-256 of the origin URL as repo id.** Rejected: dictionary-guessable,
  and it can hash a token embedded in the URL.
- **A tracked, encrypted source ledger.** Rejected (O5): ciphertext, keyed ids,
  relations and timestamps in public history stay correlatable forever.

## References

- ADR-124 — Class-A engine doctrine, unchanged.
- ADR-129 — the twin; its blob is dropped here.
- ADR-297 — `agents/map/`; it gains the user-global fallback here.
