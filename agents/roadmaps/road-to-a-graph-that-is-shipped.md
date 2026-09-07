---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-a-graph-that-wins
    relation: extends
    note: >
      Parked successor. This file makes the graph exist for a consumer; that one
      decides whether it wins, and may not start before this one is archived.
  - slug: road-to-first-reference-analysis-observation
    relation: disjoint
    note: >
      Reference-analysis observation, not code intelligence — no shared surface.
estate_growth_exempt: "Owner-instructed 2026-09-07. Adds one active roadmap. Measured at 0918def55: active_roadmaps floor 4 at origin/main (the floor is the base-ref measurement, ADR-243 removed the stored number), 5 files present. It repairs a shipped surface no consumer can receive — the parser pair is a devDependency (ADR-246 → ADR-259), the only always-on path is a nudge shipped default-off, the MCP server carries 31 tools and no graph tool, and no query path reads the graph without deserializing all of it. Every defect below reproduces on this tree's own source; every receiver named exists in the estate at this pin."
estate_offset_exempt: "Offsets nothing at promotion. Closing, parking or folding this work each cost more than the charge: its parent decision (ADR-259) has already landed with it, `later/road-to-a-graph-that-wins.md` is explicitly gated on this file being archived, and there is no active roadmap holding the code-graph delivery surface to fold into — the 216 commits before this pin touched `src/scripts/code_graph` in zero files."
design_validated: "owner ruling 2026-09-07 (docs/decisions/ADR-259, ADR-260) — governance decides how safely the graph is delivered, not whether"
capability_gap: none
---
# Road to a graph that is shipped

> **Source.** Owner analysis round `inbox-2026-09-u` (2026-09-07, two external LLM
> ideation sessions, three consolidation loops), consumed to
> `agents/tmp.old/inbox-2026-09-u/`. This file is authored in the repository from that
> analysis; it is not the analysis. Every figure was **re-measured on `0918def55`
> (v14.20.0)** before writing, and the corrections that re-measurement forced are marked
> `corrected-from-reproduction` in the defect table below.

## Goal

A consumer who runs `npm install @event4u/agent-config` has a working code graph on the
next command, without a manual parser install; the graph answers `impact`, `tests-for` and
`dead` from an indexed store rather than by deserializing the whole graph; the answers reach
the agent through the MCP server and a structured PreToolUse context line; and the
repository's own regression selector reads this graph instead of its documented substitute.
Nothing here claims the graph is *better* than grep — that is
`later/road-to-a-graph-that-wins.md`. This one only makes it *exist* for the people it was
built for.

## Prerequisites

- [ ] Read `docs/decisions/ADR-259-code-graph-parsers-ship-with-the-package.md`,
      `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md` (the record it
      supersedes, including its 2026-08-28 confirmation that the benchmark trigger did not
      fire), and `src/scripts/hooks/host_semantics.ts`.
- [ ] Run `agent-config roadmap:context --roadmap road-to-a-graph-that-is-shipped` and
      record the probe's `scanned:` line against the `relates:` block above.
- [ ] Run [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
      before the first checkbox.

## Reproduced, on this tree at `0918def55`

| # | Defect | Measured | Where |
|---|---|---|---|
| D1 | Parsers are devDependencies; no consumer receives the engine | `tree-sitter-wasms@0.1.13`, `web-tree-sitter@0.24.7` under `devDependencies` | `package.json:115,120`; ADR-246 |
| D2 | The 51 MB figure ADR-246 rests on is the whole pack; the 13 grammars the target stack needs are **8.69 MiB** | `du -ck` over php, typescript, tsx, javascript, vue, json, html, css, yaml, go, java, python, bash = 8,896 KB; whole `out/` = 49 MiB over 36 files | `node_modules/tree-sitter-wasms/out/` |
| D3 | The only always-on surface is a nudge, default `false`, and the settings table itself calls it deprecated | `hooks.code_graph.enabled` row: `false`, "deprecated — honest null 2026-07-28", "requires manually installing the ABI-locked parser pair" | `src/agent-src/templates/agent-settings.md:632` |
| D4 | The hook's **own** header does not say deprecated — it says default-OFF, warn-only, `fail_closed: false`. `corrected-from-reproduction`: the draft claimed the deprecation wording sat at `:12-15` of the hook; `grep -ni 'deprecat\|honest'` over that file returns **zero**. The deprecation lives only in D3's settings table, which is a weaker signal to a reader of the code | `:3` "PreToolUse code-graph nudge (ADR-124 Phase 4) — deterministic, warn-only"; `:12-15` "Default-OFF … Disabled / missing / already-latched → no-op exit 0" | `src/scripts/hooks/code_graph_nudge_hook.ts:3,12-15` |
| D5 | MCP server carries **31** tools and zero graph tools; the stdio install hint is still `npx -y` after the bridge pin landed. `corrected-from-reproduction`: 31, not 30 | `"install_hint_stdio": "npx -y @event4u/agent-config mcp-server"` | `src/scripts/mcp_server/consumer_tool_catalog.json:4` |
| D6 | No query reads the graph without materializing all of it. `corrected-from-reproduction`: the draft said every query does `readFileSync` + `JSON.parse`; the SQLite twin (ADR-129) is in fact **preferred** and `readFileSync` is the fallback — but `loadSerializedFromTwin` returns the whole serialized **string**, so `JSON.parse` and the full node/edge `Map` build run on *both* paths. The twin is a cheaper blob transport, not an index. The defect is real and the accurate name for it is **no query API**, not "no read API" | `const fromTwin = loadSerializedFromTwin(graphPath)` (:32); `const raw = fromTwin ?? fs.readFileSync(...)` (:33); `JSON.parse(raw)` (:34) | `src/scripts/code_graph/query.ts:27-41` |
| D7 | The store exports no per-node or per-edge read. `corrected-from-reproduction`: six exports, not three — `GRAPH_STORE_VERSION` (:36), `sqliteTwinPath` (:40), `emitSqliteTwin` (:54), `loadSerializedFromTwin` (:122), `twinCounts` (:155), a type re-export (:174). None takes a node id, a label or a relation | listed exports | `src/scripts/code_graph/sqlite_store.ts:36-174` |
| D8 | The regression selector documents that it uses a different graph, and says why | "## Which graph, and why it is not the one the step names … the substitution is STATED rather than hidden … There is no index to select against." | `src/scripts/_lib/regression_neighbourhood.ts:15-26` |
| D9 | In-tree importers of the engine outside its own directory: **3** — benchmark, nudge, concern registry | `../code_graph/loader.js`, `../code_graph/detect.js`, `./code_graph_nudge_hook.js` | `src/scripts/_lib/bench_ab_complexity.ts:64-65`, `src/scripts/hooks/code_graph_nudge_hook.ts:25`, `src/scripts/hooks/concern_registry.ts:61` |
| D10 | No graph index exists in a fresh checkout; the cache path is gitignored and disposable, and `code-graph detect` in this checkout answers "no code-graph source detected" | `agents/runtime/state/` absent; subcommands `build`, `validate`, `detect`, `refresh`, `query`, `path`, `explain`, `affected`, `suggest-verb` | `src/scripts/code_graph/cli.ts:5-42`; `regression_neighbourhood.ts:15-26` |

## What this roadmap is NOT

- **Not a benchmark claim.** The v2 corpus stays the regression suite. The skill's "No class
  is graph-first" sentence (`src/skills/code-intelligence/SKILL.md:164`) is not touched, and
  ADR-246's recorded non-firing of its own measurement trigger (2026-08-28, 2026-09-04) is
  not disputed here.
- **Not a provider ladder.** No LSP, SCIP, tsserver or external analyzer enters `src/`.
- **Not a language expansion.** Three wired languages stay three; the bundle ships the
  grammars, wiring them is the later roadmap's work, one fixture per language.
- **Not a new confidence vocabulary.** Three classes stay; two *fields* are added.
- **Not a new top-level verb.** All new verbs are `code-graph` subcommands, per the
  controlled leading-token allowlist in `src/config/discovery/command-verbs.yml` (ADR-041).

## Phase 0 — The decision this depends on

- [ ] **0.1 ADR-259 lands** (owner-directed): parsers move to `dependencies` as the
      8.69 MiB default set; the remaining 23 grammars ship as
      `@event4u/agent-config-grammars` (companion package, resolved by the package manager,
      never fetched at runtime).
      verify: `./scripts-run src/scripts/check_dependency_floors` green; `npm pack --dry-run`
      lists the 13 wasm files and no other; ADR-246 carries `superseded_by: ADR-259`;
      `./scripts-run src/scripts/adr_cite_check ADR-259` reports it live.

## Phase 1 — Delivered on install

- [ ] **1.1 Consumer install builds.** A throwaway directory, `npm install` of the packed
      tarball, `agent-config code-graph build --root .` on a PHP+TS fixture.
      verify: exit 0, node/edge counts printed, no manual step; the size delta is re-measured
      and recorded in `docs/MIGRATION.md` in bytes.
- [ ] **1.2 Retire the nudge.** Delete `src/scripts/hooks/code_graph_nudge_hook.ts` and the
      `hooks.code_graph.enabled` row; add a `hook_manifest` entry `code_graph_context`: on
      PreToolUse-capable hosts (per the `VERIFIED_PLATFORMS` table in
      `src/scripts/hooks/host_semantics.ts:61`) emit the host's structured
      `additionalContext` once per session when a graph is `fresh|behind:N`; on
      instruction-file hosts deliver the same one line as a rule. Never a plain echo.
      Remove the D9 import in `concern_registry.ts:61` in the same change.
      verify: fixture asserts the JSON envelope; `enforced_by` per host resolved from the
      table, not from a host name; `grep -c code_graph_nudge src/scripts/hook_manifest.yaml`
      is 0; `./scripts-run src/scripts/check_enforcement_coverage` green.
- [ ] **1.3 Freshness from git, no daemon.** post-commit and post-checkout run
      `code-graph refresh --budget-seconds` in the background, single-flight, honouring
      `core.hooksPath`; a union merge driver for the index; staleness exported to the runtime
      journal as `fresh | behind:N | absent`.
      verify: `check_installed_hooks_fresh` covers both hooks; a two-branch fixture merges
      without conflict markers; two concurrent commits produce one refresh.
- [ ] **1.4 Ignore hint** for the index path in the installed ignore surfaces
      (prompt-cache invalidation on hosts that hash the workspace).
      verify: `sync_gitignore` output contains the path.

## Phase 2 — Indexed store

- [ ] **2.1 SQLite becomes the read store above 50k edges — as a queryable index, not a
      blob.** Tables `nodes(id, kind, label, file)`, `edges(src, dst, relation, confidence,
      resolved_via, provider)`, indexes on `id`, `label`, `src`, `dst`. Add the per-node and
      per-edge read API `sqlite_store.ts` lacks today (D7), and route `affected`/`query`
      through it so neither `JSON.parse` nor the full `Map` build runs (D6). JSON stays
      canonical for hashing and diff.
      verify: `affected` on a ≥50k-edge build parses no JSON (traced); wall time and RSS
      before/after recorded in the commit; `code-graph validate` asserts twin ⇔ JSON by
      checksum.
- [ ] **2.2 Two fields on every edge.** `resolved_via ∈ {same-file, import-specifier,
      path-alias, psr4, route-table, test-import, name-lookup, dynamic}` and `provider`
      (`native`). Schema version bumps; `build` prints the `resolved_via` histogram.
      verify: no edge lacks either field; the v2 corpus rerun is byte-identical on recall and
      precision.
- [ ] **2.3 Resolution tiers before name lookup:** `tsconfig` `paths` and composer PSR-4.
      verify: INFERRED count on `src/scripts/ai_council` falls; EXTRACTED does not regress.

## Phase 3 — Three verbs a gate can read

- [ ] **3.1 `impact --diff <rev>`** — callers, dependents and test files reachable from the
      changed symbols over accepted edges (`resolved_via` not in `{name-lookup, dynamic}`),
      plus the producing edges and a minimal read set.
- [ ] **3.2 `tests-for <symbol>`** and **`untested --diff <rev>`** — needs relation `tests`
      (test file → subject via import); one fixture.
- [ ] **3.3 `dead`** — zero accepted callers, excluding declared entry points: routes,
      exports, the CLI registry (`src/cli/registry.ts`), the hook manifest.
      verify for 3.1–3.3: golden outputs on a fixture; each prints `resolved_via` counts and
      the staleness state; `describeImpact` is listed by `dead` and by nothing else.
- [ ] **3.4 `regression_neighbourhood` reads this graph** via `impact --diff`; the selected
      regressions and the producing edges enter the verdict record. Retires the
      substitute-graph section at `regression_neighbourhood.ts:15-26`.
      verify: the fixture that proves a neighbour regression is caught runs on the native
      graph; `grep -c 'no index to select against' src/scripts/_lib/regression_neighbourhood.ts`
      is 0.

## Phase 4 — Reaches the agent

- [ ] **4.1 MCP tools** `graph_impact`, `graph_tests_for`, `graph_dead`, `graph_query`,
      `graph_path` on the existing server, same telemetry line as the other 31.
      verify: catalogue count **36**; `telemetry:report` shows `tools/call` rows for them in
      a fixture session.
- [ ] **4.2 Correct the install hint** at `consumer_tool_catalog.json:4` to the pinned entry
      the MCP-bridge work wrote.
      verify: doc-drift check green; `grep -c 'npx -y' src/scripts/mcp_server/consumer_tool_catalog.json`
      is 0.
- [ ] **4.3 Skill description** names the three verbs as *cheaper* paths; no ordering claim is
      added or removed.
      verify: description length ≤ 200 chars (`src/scripts/schemas/skill.schema.json:28`);
      `src/skills/code-intelligence/SKILL.md:164` unchanged.

## Kill register

- **K1** No runtime grammar fetch.
- **K2** No external provider in `src/`.
- **K3** No new confidence class.
- **K4** No new top-level CLI verb.
- **K5** No "graph-first" wording.
- **K6** No language wiring without a fixture.
- **K7** No blocking gate on a stale graph — rebuild on demand inside `--budget-seconds`,
  else the non-graph path with a visible line.
- **K8** Moving this file to `later/` or descoping a step to a carrier. A step that fails
  enters a fix loop; a step that needs a decision this file does not contain is reported as
  a question in the PR body and the step stays `[ ]` with the question quoted.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan; the two benchmark **subjects** ADR-260 § 5 reserves belong to the
  successor roadmap, not to this one.
- **Gap table:** the ten defects above were audited against the existing surface before
  drafting. `KEEP` — D1, D2, D3, D5, D8, D9, D10 (reproduced unchanged). `KEEP, corrected` —
  D4, D6, D7 (the draft's framing did not survive re-measurement; the corrected wording is in
  the table and marked). `CUT` — the draft's claim that ADR-246's benchmark trigger was
  unevaluated: it was evaluated twice and recorded as not fired, so this roadmap rests on the
  consumer-reachability argument alone.
- **Council:** none. The decision is an owner ruling recorded in ADR-259 and ADR-260 with
  `reopen_policy: owner`; routing it to a council is what ADR-260 § 4's Alternatives
  section rejects.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | The install grows by 8.69 MiB and the graph is still unread | product | Delivery without a reader is the D9 shape again — three importers, two of them the benchmark and the surface being retired. A shipped parser nobody calls is a pure cost. | Phases 3.4 and 4.1 land in the same release as Phase 1, so a reader ships with the payload; the release-mix taxonomy counts all of it consumer-only under ADR-260 § 1 | Phase 4 — Reaches the agent |
| 2 | The store migration changes answers | implementation | A different read path can drop or duplicate edges, and the v2 corpus is the only thing that would notice. | 2.1 asserts twin ⇔ JSON by checksum; 2.2 requires the v2 rerun byte-identical on recall and precision; AC-6 makes that a release condition | Phase 2 — Indexed store |
| 3 | Git hooks pile up rebuilds | implementation | Concurrent refreshes saturate CPU on a busy branch — the known failure of every commit-triggered indexer. | Single-flight lock, the existing `--budget-seconds`, and the hook returns immediately; K7 forbids blocking on a stale graph | Phase 1 — Delivered on install |
| 4 | `dead` reports entry points as dead | product | A confident false "dead" is worse than no verb: it invites a deletion the graph cannot justify. | 3.3 enumerates the declared entry-point sources — routes, exports, `src/cli/registry.ts`, the hook manifest — and requires a fixture with a route-only symbol | Phase 3 — Three verbs a gate can read |
| 5 | Phase 2.1 is scoped from a corrected reading and could still be wrong | implementation | The draft's read-path claim did not survive reproduction (D6). The corrected claim — twin returns a serialized blob, so both paths deserialize everything — was verified at one pin and could shift again. | 2.1's verify traces the actual parse rather than asserting it; a re-read of `query.ts:27-41` is a Prerequisite, not an assumption | Phase 2 — Indexed store |

## Acceptance Criteria

- [ ] AC-0 ADR-259 accepted; `package.json` carries the parser pair in `dependencies`.
- [ ] AC-1 A fresh consumer install builds a graph with no manual step (1.1).
- [ ] AC-2 The nudge hook and its flag are gone; `code_graph_context` is in the manifest with
      per-host `enforced_by` resolved from the platform table (1.2).
- [ ] AC-3 Queries above 50k edges read SQLite through a per-node/per-edge API and parse no
      JSON (2.1); every edge carries `resolved_via` and `provider` (2.2).
- [ ] AC-4 `impact --diff`, `tests-for`, `dead` exist with golden fixtures;
      `regression_neighbourhood` reads the native graph (3.x).
- [ ] AC-5 Five graph tools are in the MCP catalogue, taking it to 36, and emit telemetry;
      the install hint is pinned (4.x).
- [ ] AC-6 The v2 benchmark rerun after all phases is byte-identical on every class — this
      roadmap moved delivery, not measurement.
