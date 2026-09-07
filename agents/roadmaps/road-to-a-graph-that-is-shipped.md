---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: "Adds one active roadmap against 8 active at 4c24be50 (floor 10). It repairs a shipped surface that no consumer can receive: the parser pair is a devDependency (ADR-246), the only always-on path is a nudge documented as deprecated and default-off, the MCP server carries 30 tools and no graph tool, and every query parses the whole serialized graph. All four defects reproduce on this tree's own source. Every receiver named below exists in the estate at this pin; no fold target is assumed."
design_validated: "owner ruling 2026-09-07 (docs/decisions/ADR-257, ADR-258) — governance decides how safe the graph is delivered, not whether"
capability_gap: none
---
# Road to a graph that is shipped

> **Source.** Analysis round `road-to-eleven` (2026-09-06/07, two sessions, three
> consolidation loops; evidence artefacts under `agents/tmp/road-to-eleven/`, source-silent
> S-codes only). This file is authored in the repository from that analysis; it is not the
> analysis. Every figure was re-measured on `4c24be50` before writing.

## Goal

A consumer who runs `npm install @event4u/agent-config` has a working code graph on the
next command, without a manual parser install; the graph answers `impact`, `tests-for` and
`dead` from an indexed store; the answers reach the agent through the MCP server and a
structured PreToolUse context line; and the repository's own regression selector reads
this graph instead of its documented substitute. Nothing in this roadmap claims the graph
is *better* than grep — that is `later/road-to-a-graph-that-wins.md`. This one only makes
it *exist* for the people it was built for.

## Reproduced, on this tree

| # | Defect | Measured | Where |
|---|---|---|---|
| D1 | Parsers are devDependencies; no consumer receives the engine | `web-tree-sitter@0.24.7`, `tree-sitter-wasms@0.1.13` under `devDependencies` | `package.json`; ADR-246 |
| D2 | The 51 MB figure ADR-246 rests on is the whole pack; the 13 grammars the target stack needs are **8.7 MB** | `du -c` over php, typescript, tsx, javascript, vue, json, html, css, yaml, go, java, python, bash | `node_modules/tree-sitter-wasms/out/` |
| D3 | Only always-on surface is a nudge, default `false`, "deprecated — honest null" | `hooks.code_graph.enabled` row | `src/agent-src/templates/agent-settings.md:632`; `src/scripts/hooks/code_graph_nudge_hook.ts:12-15` |
| D4 | MCP server: 30 tools, 0 graph tools; install hint still `npx -y` after the bridge pin landed | catalogue listing | `src/scripts/mcp_server/consumer_tool_catalog.json:4` |
| D5 | Every query parses the whole graph; the SQLite twin is a string blob with no read API | `readFileSync`/twin → `JSON.parse`; exports `emitSqliteTwin, loadSerializedFromTwin, twinCounts` only | `src/scripts/code_graph/query.ts:33-34`; `sqlite_store.ts:40-155` |
| D6 | Scale: 1,190 files → 26,391 nodes / 75,514 edges, 20.6 MB JSON, 8.9 s build | `cli build --root src/scripts` | `agents/runtime/state/code-graph-v1.json` |
| D7 | The regression selector documents that it uses a different graph | header comment | `src/scripts/_lib/regression_neighbourhood.ts:15-20` |
| D8 | In-tree importers of the engine outside its own directory: 3 (benchmark, nudge, concern registry) | grep | `src/scripts/_lib/bench_ab_complexity.ts`, `hooks/code_graph_nudge_hook.ts`, `hooks/concern_registry.ts` |

## What this roadmap is NOT

- **Not a benchmark claim.** The v2 corpus stays the regression suite; the skill's
  "No class is graph-first" sentence (`src/skills/code-intelligence/SKILL.md:164`) is not
  touched here.
- **Not a provider ladder.** No LSP, SCIP, tsserver or external analyzer enters `src/`.
- **Not a language expansion.** Three wired languages stay three; the bundle ships the
  grammars, wiring them is the later roadmap's work, one fixture per language.
- **Not a new confidence vocabulary.** Three classes stay; two *fields* are added.
- **Not a new top-level verb** (ADR-041). All new verbs are `code-graph` subcommands.

## Phase 0 — The decision this depends on

- [ ] **0.1 ADR-257 lands** (owner-directed): parsers move to `dependencies` as the 8.7 MB
      default set; the remaining 23 grammars ship as `@event4u/agent-config-grammars`
      (companion package, resolved by the package manager, never fetched at runtime).
      verify: `check_dependency_floors` green; `npm pack --dry-run` lists the 13 wasm
      files and no other; ADR-246 carries `superseded_by: ADR-257`.

## Phase 1 — Delivered on install

- [ ] **1.1 Consumer install builds.** A throwaway directory, `npm install` of the packed
      tarball, `agent-config code-graph build --root .` on a PHP+TS fixture.
      verify: exit 0, node/edge counts printed, no manual step; the install size delta is
      recorded in `docs/MIGRATION.md`.
- [ ] **1.2 Retire the nudge.** Delete `code_graph_nudge_hook.ts` and the
      `hooks.code_graph.enabled` row; add `hook_manifest` entry `code_graph_context`: on
      PreToolUse-capable hosts (per `host_semantics.ts` table) emit the host's structured
      additionalContext once per session when a graph is `fresh|behind:N`; on
      instruction-file hosts deliver the same one line as a rule. Never plain echo.
      verify: fixture asserts the JSON envelope; `enforced_by` per host resolved from the
      table; `grep -c code_graph_nudge src/scripts/hook_manifest.yaml` is 0.
- [ ] **1.3 Freshness from git, no daemon.** post-commit and post-checkout run
      `code-graph refresh --budget-seconds` in the background, single-flight, honouring
      `core.hooksPath`; a union merge driver for the index; staleness exported to the
      runtime journal as `fresh | behind:N | absent`.
      verify: `check_installed_hooks_fresh` covers both hooks; two-branch fixture merges
      without conflict markers; two concurrent commits produce one refresh.
- [ ] **1.4 Ignore hint** for the index path in the installed ignore surfaces (prompt-cache
      invalidation on hosts that hash the workspace).
      verify: `sync_gitignore` output contains the path.

## Phase 2 — Indexed store

- [ ] **2.1 SQLite becomes the read store above 50k edges.** Tables `nodes(id, kind,
      label, file)`, `edges(src, dst, relation, confidence, resolved_via, provider)`,
      indexes on `id`, `label`, `src`, `dst`. JSON stays canonical for hashing and diff.
      verify: `affected` on the D6 build parses no JSON (traced); wall time and RSS
      before/after in the commit; `validate` asserts twin ⇔ JSON by checksum.
- [ ] **2.2 Two fields on every edge.** `resolved_via ∈ {same-file, import-specifier,
      path-alias, psr4, route-table, test-import, name-lookup, dynamic}` and `provider`
      (`native`). Schema version bumps; `build` prints the `resolved_via` histogram.
      verify: no edge lacks either field; the v2 corpus rerun is byte-identical on
      recall/precision.
- [ ] **2.3 Resolution tiers before name lookup:** `tsconfig` `paths` and composer PSR-4.
      verify: INFERRED count on `src/scripts/ai_council` falls; EXTRACTED does not regress.

## Phase 3 — Three verbs a gate can read

- [ ] **3.1 `impact --diff <rev>`** — callers, dependents and test files reachable from the
      changed symbols over accepted edges (`resolved_via` not in `{name-lookup, dynamic}`),
      plus the producing edges and a minimal read set.
- [ ] **3.2 `tests-for <symbol>`** and **`untested --diff <rev>`** — needs relation `tests`
      (test file → subject via import); one fixture.
- [ ] **3.3 `dead`** — zero accepted callers, excluding declared entry points: routes,
      exports, CLI registry (`src/cli/registry.ts`), hook manifest.
      verify for all three: golden outputs on a fixture; each prints `resolved_via` counts
      and the staleness state; `describeImpact` (D8 sanity) is listed by `dead` and by
      nothing else.
- [ ] **3.4 `regression_neighbourhood` reads this graph** via `impact --diff`; the selected
      regressions and the producing edges enter the verdict record. Retires the
      substitute-graph paragraph at `:15-20`.
      verify: the fixture that proves a neighbour regression is caught runs on the native
      graph.

## Phase 4 — Reaches the agent

- [ ] **4.1 MCP tools** `graph_impact`, `graph_tests_for`, `graph_dead`, `graph_query`,
      `graph_path` on the existing server, same telemetry line as the other 30.
      verify: catalogue count 35; `telemetry:report` shows `tools/call` rows for them in a
      fixture session.
- [ ] **4.2 Correct the install hint** at `consumer_tool_catalog.json:4` to the pinned
      entry the bridge roadmap writes.
      verify: doc-drift check green.
- [ ] **4.3 Skill description** names the three verbs as *cheaper* paths; no ordering claim
      is added or removed.
      verify: description length inside the estate budget; `:164` unchanged.

## Kill register
K1 no runtime grammar fetch · K2 no provider in `src/` · K3 no new confidence class ·
K4 no top-level verb · K5 no "graph-first" wording · K6 no language wiring without fixture
· K7 no blocking gate on a stale graph (rebuild-on-demand inside `--budget-seconds`, else
the non-graph path with a visible line).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Install grows by 8.7 MB and the graph is still unused | product | delivery without a reader is the D8 shape again | Phase 3.4 and 4.1 land in the same release as Phase 1; the release-mix taxonomy counts all of it consumer-only | Phase 4 |
| 2 | Store migration changes answers | implementation | a different read path can drop or duplicate edges | 2.1 checksum equality; v2 corpus rerun byte-identical (2.2) | Phase 2 |
| 3 | Git hooks pile up rebuilds | implementation | field-known failure: concurrent refreshes saturate CPU | single-flight lock; existing `--budget-seconds`; the hook returns immediately | Phase 1 |
| 4 | `dead` lists entry points as dead | product | a false "dead" is the confident-liar shape | declared entry-point sources enumerated in 3.3; fixture with a route-only symbol | Phase 3 |

## Acceptance Criteria
- [ ] AC-0 ADR-257 accepted; `package.json` carries the parser pair in `dependencies`.
- [ ] AC-1 A fresh consumer install builds a graph with no manual step (1.1).
- [ ] AC-2 The nudge hook and its flag are gone; `code_graph_context` is in the manifest with per-host `enforced_by` (1.2).
- [ ] AC-3 Queries above 50k edges read SQLite and parse no JSON (2.1); every edge carries `resolved_via` and `provider` (2.2).
- [ ] AC-4 `impact --diff`, `tests-for`, `dead` exist with golden fixtures; `regression_neighbourhood` reads the native graph (3.x).
- [ ] AC-5 Five graph tools are in the MCP catalogue and emit telemetry; the install hint is pinned (4.x).
- [ ] AC-6 The v2 benchmark rerun after all phases is byte-identical on every class — this roadmap moved delivery, not measurement.
