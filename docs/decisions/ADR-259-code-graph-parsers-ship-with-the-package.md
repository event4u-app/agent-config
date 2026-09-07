---
adr: 259
status: accepted
date: 2026-09-07
decision: code-graph-parsers-ship-with-the-package
supersedes: ADR-246
superseded_by: —
phase: road-to-a-graph-that-is-shipped · Phase 0.1
type: structural
reopen_policy: owner
provenance:
  kind: owner
  decision_makers: [owner]
  human_directed: true
  agentic_mode: none
evidence:
  strength: E1
  basis:
    - package.json
    - docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md
    - src/agent-src/templates/agent-settings.md
    - src/scripts/mcp_server/consumer_tool_catalog.json
    - src/scripts/code_graph/query.ts
    - src/scripts/code_graph/sqlite_store.ts
    - internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md
review_trigger: >-
  Reopen only on an owner ruling. Explicitly NOT a trigger: a benchmark result in either
  direction. ADR-246 made delivery conditional on a measurement; this record separates the
  two — governance decides how safely the graph is delivered, never whether. The
  measurement question lives in later/road-to-a-graph-that-wins.md and its own
  registration.
---

# ADR-259 — The code-graph parsers ship with the package

## Status

Accepted, owner-directed, 2026-09-07. Supersedes ADR-246
(`code-graph-parsers-stay-devdependencies`, 2026-08-26) in full.

## Context

ADR-246 kept `web-tree-sitter` and `tree-sitter-wasms` as devDependencies on two grounds:
a consumer cost of ≈51 MB, and the absence of a measured case in which the graph beats
grep. Both grounds were re-examined on 2026-09-06/07 and re-measured at
`0918def55` (v14.20.0) before this record was written.

**On the size ground.** The 51 MB figure is the whole grammar pack: `node_modules/tree-sitter-wasms/out/`
holds 36 `.wasm` files, 51,765,657 bytes apparent / 49 MiB on disk. The thirteen grammars
the target stack needs — php, typescript, tsx, javascript, vue, json, html, css, yaml, go,
java, python, bash — measure **8,896 KB (8.69 MiB, 9,085,798 bytes apparent)** together;
the `web-tree-sitter` runtime is 380 KB. ADR-246 itself records at its own evidence line
that the 51 MB was the figure carried over from `docs/MIGRATION.md` and was "not
re-measured here", so the decision rests on a pack-wide number that no default set ever
required.

**On the measurement ground.** ADR-246's first reopen trigger asks for "a CONSUMER case the
graph answers and disciplined grep cannot — stated by a consumer, not inferred from the
engine's capability". No consumer has ever received the engine, so that case cannot arise:

- the only always-on surface is a PreToolUse nudge that ships **default-off**
  (`hooks.code_graph.enabled: false`) and is described in the settings table as
  "deprecated — honest null 2026-07-28", requiring a manual install of the ABI-locked
  parser pair (`src/agent-src/templates/agent-settings.md:632`);
- the MCP server carries **31 tools and none of them is a graph tool**
  (`src/scripts/mcp_server/consumer_tool_catalog.json`);
- in-tree importers of the engine outside its own directory number **three**, two of which
  are the benchmark harness and that same nudge (`src/scripts/_lib/bench_ab_complexity.ts:64-65`,
  `src/scripts/hooks/code_graph_nudge_hook.ts:25`, `src/scripts/hooks/concern_registry.ts:61`).

A reopen trigger that requires the thing it prevents is not a trigger. ADR-246's *second*
trigger — a retrieval measurement beating grep — was independently evaluated on 2026-08-28
and again on 2026-09-04 and **did not fire**: zero of four classes met the +10 pp bar, every
class tied, `path-between` grep recall 0.917 against graph 1.000 for a delta of +8.3 pp
(`internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83`). This
record does not dispute that result and does not rest on it. It separates the two
questions instead.

The owner's standing direction (2026-08-27, 2026-09-04, restated 2026-09-07) is that
runtime and code intelligence are infrastructure whose *safety* governance ensures, not
whose *existence* it withholds.

## Decision

1. `web-tree-sitter` and `tree-sitter-wasms` move to `dependencies`. The published package
   carries the thirteen-grammar default set (8.69 MiB, listed in `package.json` `files`).
2. The remaining grammars ship as a companion package `@event4u/agent-config-grammars`,
   resolved by the package manager under the lockfile. **No grammar is ever fetched at
   runtime.**
3. `check_dependency_floors` gains the two entries; `docs/MIGRATION.md` states the install
   delta in bytes, re-measured rather than carried over.
4. Delivery and measurement are decoupled: no default, wording or routing claim changes
   under this record. In particular `src/skills/code-intelligence/SKILL.md:164` ("No class
   is graph-first") is not touched. Those change only through the registration and result
   recorded by `later/road-to-a-graph-that-wins.md`.

## Consequences

- ADR-246's consumer-case trigger becomes reachable for the first time. Its
  extraction-quality exclusion is unaffected and still stands.
- The estate's runtime-absence and zero-network claims are unaffected: parsing is local,
  and the companion package is a package-manager resolution, not a network call.
- Governance-only work on the graph — further benchmarks against this repository's own
  source — is not scheduled before Phase 4 of the parent roadmap has landed.
- The 8.69 MiB is a real consumer cost paid before any measured retrieval win. That is the
  trade this record makes deliberately, and the parent roadmap's Risk Register ranks it
  first.

## Alternatives

- Keep devDependencies and document a manual install — rejected: it is the state that
  produced zero consumer importers in six weeks, and it is the state that makes ADR-246's
  own reopen trigger unreachable.
- Fetch grammars on first use — rejected: a network fetch at first use is a supply-chain
  surface the spawn-hardening floor exists to avoid.
- Ship all 36 grammars — rejected on the measured 49 MiB; the companion package carries
  them for the consumers who need them.
- Wait for a benchmark win — rejected as circular, per the Context.

## Evidence

| Claim | Basis |
|---|---|
| Parsers are devDependencies | `package.json:115` (`tree-sitter-wasms: "0.1.13"`), `:120` (`web-tree-sitter: "0.24.7"`) |
| 13 grammars = 8.69 MiB; whole pack = 49 MiB / 36 files | `du -ck` over the named files under `node_modules/tree-sitter-wasms/out/` at `tree-sitter-wasms@0.1.13` |
| ADR-246's 51 MB is the pack figure, not re-measured | `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md` evidence line |
| No consumer surface | `src/agent-src/templates/agent-settings.md:632` (default-off, deprecated); `consumer_tool_catalog.json` (31 tools, zero graph tools); 3 external importers by grep |
| Benchmark trigger evaluated, not fired | `internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83` |
