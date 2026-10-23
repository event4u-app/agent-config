---
complexity: structural
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap, no new blocker. It delivers the owner's 2026-10-23 request for a project map in agents/ and fixes four live consumer-path defects of the shipped code-graph engine (wrong root, cache in node_modules, silently unwritten index, version-blind cache)."
estate_offset_exempt: "grep -rlE 'code-graph|code_graph|graph_query' over agents/roadmaps/*.md, later/ and stubs/ (2026-10-23): no active roadmap owns the consumer path or a map; the two later/ graph roadmaps own benchmarks and a gate feeder and stay parked for those. Archiving an unrelated file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: road-to-breadth-with-depth
    relation: extends
    note: "Stage-1 delivery for its step 5.4 (code intelligence: project root, a SCIP reader, more grammars). AGENTS.md / CLAUDE.md 'No app runtime' (its F1) stays owned there. No step of that roadmap is edited."
  - slug: later/road-to-a-graph-that-wins
    relation: extends
    note: "Its Phase 1.1 (grammars) and 1.2 (route / Blade / Eloquent / migration overlay) are pulled forward here (Phases 4 and 6) without its Phase 2 registration as a precondition. Its Phases 2-3 stay where they are; 0.5 marks 1.1 and 1.2 there as moved."
  - slug: later/road-to-a-graph-that-feeds-the-gate
    relation: disjoint
    note: "The gate feeder stays asleep on its own entry condition. Nothing here feeds a gate."
---
# Road to a map that draws itself

> **Source:** `agents/tmp.old/inbox-2026-10-ab/` — one owner chat and three supplied plans (two
> parent proposals and one consolidated master). The master was pinned at `main@cd598914d`; every
> tree fact below was re-verified against the same commit on 2026-10-23. The external reference
> tool is coded **S1** and the Laravel measurement subject **Fixture L** (an MIT Laravel
> application, pinned in the round's intake note). Only mechanisms are taken from S1, re-derived;
> no code is copied.

## Goal

Any project that installs agent-config gets a map of its own code, built locally and
deterministically with no model call, under `agents/map/`. A person opens
`agents/map/index.html` and sees the areas of the system, the files in each and every
connection. An agent reads `agents/map/MAP.md` or asks the same graph over MCP. One engine, two
readers — and the engine underneath is right first: in a consumer project it indexes the
project, writes its cache into the project, and actually writes its index.

## The owner directive (2026-10-23), recorded as stated

> We have no such map today. I want AC to build it in a project's `agents/` folder. AC should
> develop its full potential. The old record that said "we do not want everything" is outdated
> and we are overturning it.

The "outdated record" is the depth-over-breadth position `road-to-breadth-with-depth` already
reverses (owner directive 2026-10-21). It is not ADR-235, which is about the `process-full`
terminal state and is superseded by ADR-237. "The graph has not beaten grep yet" is a **depth
target** here, never a reason to withhold the capability.

## Context — reproduced on this tree

### The engine and the consumer path

| # | Defect | Evidence |
|---|---|---|
| D1 | **The verb indexes the package, not the project.** With no `--root`, `resolveRoot` falls back to the module's own tree after `AGENT_CONFIG_PROJECT_ROOT`. The shared resolver every other command uses (env, anchor walk from `cwd`, `cwd`) is not used. Measured in a consumer: 1,756 files indexed — the installed package. | `src/scripts/code_graph/cli.ts:96`, `:132-145`; `src/scripts/_lib/agent_settings.ts` `resolve_project_root` |
| D2 | **The cache lives in the package directory.** `DEFAULT_CACHE` is anchored to `REPO_ROOT`, so even `--root .` writes into `node_modules/@event4u/agent-config/agents/runtime/state/`. `npm ci` deletes the graph; two projects sharing an install overwrite each other; the MCP tools read `<project>/agents/runtime/state/…` and report no graph after a successful build. | `cli.ts:97`; `src/scripts/code_graph/detect.ts`; `src/scripts/mcp_server/graph_tools.ts` |
| D3 | **The SQLite index is never written on real repositories.** Node ids are `${file}#${name}`; same-named nested functions or `type X` beside `const X` collide, the PRIMARY KEY insert throws, and the catch returns `false` silently. Measured: 75 duplicate ids in this repo's `src/`, 908 in Fixture L. The indexed read path is therefore unreachable and every query parses the JSON graph. | `src/scripts/code_graph/extract.ts`; `sqlite_store.ts:86-163`; `query.ts` |
| D4 | **When the twin is written, it costs 27-31 s.** Inserts run in autocommit mode; in one transaction the same inserts took 0.5 s. | `sqlite_store.ts` (no `BEGIN`/`COMMIT`) |
| D5 | **The incremental cache survives extractor changes.** The sidecar key is `SCHEMA_VERSION` (= 4) only — no package version, extractor or grammar fingerprint. | `build.ts:835`, `:869`; `types.ts:254` |
| D6 | **SCIP is presence-only** — detected, no reader. | `detect.ts` |
| D7 | **Three languages.** PHP / TS / JS, three vendored grammars. | `src/vendor/grammars/` |

### The map

| # | Finding | Evidence |
|---|---|---|
| D8 | **No map, no areas, no report.** No HTML of any graph, no community or hub concept; the only system map is hand-written prose. | `docs/maintainers/system-map.md` |
| D9 | **`/project analyze` is not generic.** It hard-codes one consumer's dual-database shape into every project. | `src/domains/engineering-base/project/analyze/command.md:34`, `:153`, `:159`, `:292-293` |
| D10 | **`agents/` cannot hold a map.** The layout contract is a whitelist, and ADR-124 Class A puts engine state only under `agents/runtime/state/`. | `src/scripts/lint_agents_layout.ts:60`; `docs/decisions/ADR-124-embedded-engine-doctrine.md` § 1 |
| D11 | **A published claim is stale.** `comparison.yaml` says the engine was "permanently defaulted off when it lost"; it ships, its context hook is default-on, and six `graph_*` MCP tools exist. | `docs/comparison.yaml:103`; `src/scripts/mcp_server/consumer_tool_catalog.json` |
| D12 | **On the owner's stack most of a project is unconnected.** Fixture L (2,218 files): 57 % without a drawable edge — every Blade view, migration and translation file; 0 route→controller edges out of 340 routes; a fluent `->middleware()` resolves to an unrelated method. All of it is resolvable by rule: 334/340 routes use `[X::class, 'method']`, 114/116 `view()` and 155/157 `@include` targets resolve to files. | measured on Fixture L |
| D13 | **Two graphs that never meet** — the artefact relation graph is a separate engine. | `src/scripts/discovery_graph.ts` |

### Measured by the source (re-measured in 8.1)

| Reading | This repo (`src/`) | Fixture L |
|---|---|---|
| Files / nodes / edges | 1,923 / 39,945 / 118,141 | 2,218 / 16,518 / 69,338 |
| Engine build | 10.3 s | 7 s |
| Louvain largest area, no hub handling | 21.8 % (one utility, in-degree 361) | 10.3 % |
| + infrastructure hold-out + tests joining their subject | 4.8 %, 55 areas | 8.4 %, 17 areas |
| Map projection + layout | 2.0 s, byte-identical rerun | 1.6 s, byte-identical rerun |
| Self-contained HTML | 824 KB, 0 external URLs | 823 KB, 0 external URLs |

## Phase 0 — Records first, so nothing below fights the tree

- [x] **0.1 ADR: derived views may live in `agents/map/`.** A new ADR amends ADR-124 Class A's
  state clause: a Class-A engine may also write *human-facing derived views* to a registered,
  gitignored `agents/map/`, while the index stays in `agents/runtime/state/`. It carries the
  per-dependency justification ADR-124 requires for the packages of 2.6 and the vendored viewer of
  3.1. The owner asked for the map in `agents/` (directive above).
  verify: `./scripts-run src/scripts/adr_cite_check ADR-124` lists the amendment.
- [x] **0.2 Layout contract row.** `docs/contracts/agents-layout.md` gains
  `map/ | both | local-only (gitignored) | rebuildable | code-graph map`; `map` joins
  `ALLOWED_SOURCE_DIRS` and `src/config/gitignore-block.txt` in the same change.
  verify: the layout lint is green on a fixture with `agents/map/`.
- [x] **0.3 Correct the stale claim (D11).** Rewrite `comparison.yaml:103` to what is true now.
  verify: `grep -c "permanently defaulted off" docs/comparison.yaml` → 0.
- [x] **0.4 Name check.** `/map` against the material hosts' built-in commands; fall back to
  `/code-map` on a collision. The CLI stays in its family: `agent-config code-graph map`.
  Result: no collision — `map` is absent from `src/scripts/_lib/claude_builtin_names.ts`, the
  pinned host fixtures and the package's own command names; `/map` stays.
- [x] **0.5 Mark the pulled rows.** In `later/road-to-a-graph-that-wins`, 1.1 and 1.2 are marked
  moved to this roadmap.

## Phase 1 — The engine tells the truth in a consumer project

Nothing in Phases 2-7 is worth building while D1-D5 stand.

- [x] **1.1 Project root (D1).** `resolveRoot` delegates to the shared project-root resolver:
  `--root` → env → anchor walk → `cwd`. The package tree is never a fallback. Covers every verb,
  the MCP tools and the context hook.
  verify: in a fixture consumer, a flagless `build` reports the fixture's file count.
- [x] **1.2 Cache location (D2).** The default cache is
  `<project>/agents/runtime/state/code-graph-v1.json`, the path MCP and `detect.ts` already read.
  A one-time notice names any cache left inside the package directory.
  verify: after build, `graph_query` answers; nothing is written under the package directory.
- [x] **1.3 Unique ids (D3).** A same-file collision gets a deterministic suffix by declaration
  order (`#walk`, `#walk@2`); `validateGraph` rejects duplicate ids; goldens regenerate once with a
  `SCHEMA_VERSION` bump.
  verify: duplicate-id count 0 on this repo and on the Laravel fixture; the twin exists after `build`.
- [x] **1.4 Twin in one transaction (D4)** and a visible failure: emission runs inside
  `BEGIN … COMMIT`, and a failed emission prints one line with its reason.
  verify: twin emission ≤ 2 s on this repo's graph; `query` takes the index path.
- [x] **1.5 Cache key (D5).** The sidecar version becomes
  `schema × package version × extractor fingerprint × grammar fingerprint`; a mismatch
  re-extracts everything once.
  verify: a changed extractor fingerprint in a test forces `reExtracted == files`.

## Phase 2 — The map model: a projection, not a second engine

`src/scripts/code_graph/map_model.ts`, a pure function `graph → MapModel`, golden-tested like
the engine.

- [x] **2.1 File layer.** Symbol edges fold into file→file edges with weight = count. Only
  accepted mechanisms are drawn; guess edges are counted per file pair as a dashed overlay;
  pseudo-targets become a per-file list of external dependencies, not nodes.
- [x] **2.2 Roles, stack-aware.** Every file gets exactly one role: `code`, `test`, `entry`,
  `view`, `migration`, `translation`, `config`, `infra` (2.3) or `isolated`. "Isolated" is never
  called "dead" on the map.
- [x] **2.3 Infrastructure hold-out.** Code files whose in-degree exceeds the repository's p99
  (threshold printed) are drawn as infrastructure and do not decide areas.
- [x] **2.4 Areas.** Seeded Louvain over `code` + `test`; test→test edges are dropped from
  clustering so a test joins what it tests; areas under 3 files fold into a per-directory bucket;
  an area above 25 % is split once more.
- [x] **2.5 Two lenses.** *Areas* (coupling) and *Folders* (directory tree); per area, the share
  of files outside the hub's directory. Area names are deterministic (hub directory + hub file).
- [x] **2.6 Dependencies and layout.** Exact-pinned `graphology`,
  `graphology-communities-louvain`, `graphology-layout-forceatlas2` (MIT, pure JS), justified in
  0.1. One global layout for the overview and one local layout per area, from a seeded start.
  verify: two builds of the same tree → identical `map.json` bytes.
- [x] **2.7 Analyses.** Hubs, cross-area edges ranked by surprise, import cycles (Tarjan on the
  file layer), per-area cohesion and test share. Every list is capped and the cap printed.

## Phase 3 — First visible slice: HTML, MAP.md, command

- [x] **3.1 One file, offline.** `agents/map/index.html` inlines the data, the CSS and the
  viewer. A test asserts zero `http(s)://` script or style references.
  *Corrected in execution:* the viewer is a small canvas renderer written here
  (`src/scripts/code_graph/map_viewer/`) rather than a vendored third-party bundle, so no
  package, notice or refresh procedure is added; the page pins its inline script and style by
  hash in a `default-src 'none'` Content-Security-Policy, which makes "offline" enforced.
- [x] **3.2 Three levels.** Areas (default) → an area's files plus grey outside neighbours → a
  file's symbols in the panel. The full symbol graph is never drawn at once.
- [x] **3.3 Panel and controls.** Path, area, role, in/out counts with clickable lists, symbols,
  covering tests, guess-edge count, state token (`fresh` / `behind:N`); breadcrumb, search, area
  legend, toggles (infrastructure, guesses, tests), light / dark / system, keyboard order,
  `prefers-reduced-motion`, German and English strings.
- [x] **3.4 Rendering rules.** Labels placed by a collision check and flipped near the right
  edge; dimmed nodes shrink; edges keep contrast in light mode; paths show the file name over the
  ellipsised directory; narrow screens label only hubs in the overview.
- [x] **3.5 Hostile-input safety.** Every label escaped; the embedded JSON escapes every `<`; no
  inline handlers; no absolute host path in title or data; no source string literal enters the
  data. Fixture labels `"`, `<!--`, `<script` and `/Users/<name>/` are part of the golden test.
- [x] **3.6 Canvas-aware render check.** With Playwright present, `agent-config ui:render` at
  desktop, 375 px and 320 px, plus a check from the viewer's own label boxes that no label leaves
  the canvas and no two overlap. Without Playwright: `verification: unverified`.
- [x] **3.7 `MAP.md` and area pages.** Header: commit, state token, counts, seed, thresholds.
  Sections: areas, infrastructure, surprises, cycles, entry points, isolated files by role,
  external dependencies, guess share. Budget 2,000 tokens; overflow says what it cut. One
  `areas/<area>.md` per area of 5 or more files.
- [x] **3.8 Entry points.** `agent-config code-graph map [--root P] [--open]` and a `/map`
  command in `engineering-base`, on demand, no standing payload. *Corrected in execution:*
  the command is `/project map`, a sub of the existing `project` cluster, so no new atomic
  command is added. The `code-intelligence` skill
  gains an "orient first" step naming `MAP.md`.

## Phase 4 — Laravel overlay: the map becomes true for the owner's stack

Pulled forward from `later/road-to-a-graph-that-wins` 1.2.

- [x] **4.1 Routes.** `Route::<verb>(path, [X::class, 'm'])`, with `use`-aliases resolved through
  the existing PSR-4 tier, produces route nodes and `routes-to` edges (`resolved_via:
  'route-table'`). Groups contribute middleware and prefix; closures and string handlers are
  counted, not guessed.
- [x] **4.2 Views.** `view('a.b')` / `View::make` → `resources/views/a/b.blade.php`; Blade
  `@extends/@include/@includeIf/@each/@component` and `<x-…>` → view edges (`resolved_via:
  'directive-scan'`).
- [x] **4.3 Data.** `Schema::create|table('t')` → table nodes; models → tables by `$table` or by
  convention; Eloquent relation methods → model edges.
- [x] **4.4 The request path on the map.** Overlay "route → controller → view / model → table"
  with its own legend. Guard: fluent calls on a route builder (`->middleware()`) never resolve to
  an in-repo method of the same name.
  verify: on the Laravel fixture the route resolves through the controller to its view and table, and isolated files are below 20 %.
  Result (Fixture L at its pin): files with no trusted edge 56.6 % → 11.3 %; 340/340 routes reach
  a handler; 509 Blade includes, 127 renders, 47 tables, 62 Eloquent relations; one false
  `->middleware()` edge dropped. 4.2 also reads `__()` / `trans()` / `config()` to their files
  (*corrected in execution:* without it every translation file stayed unconnected).

## Phase 5 — Reach: freshness, MCP, review

- [x] **5.1 Refresh.** The detached git-hook refresh (`src/scripts/install-hooks.sh`)
  regenerates the map when `agents/map/` exists, under the same lock, budget and atomic rename.
- [x] **5.2 MCP.** `graph_area` (one area's files, edges, hubs) and `graph_map_status` (state,
  counts, path to `MAP.md`) beside the six existing `graph_*` tools; the catalog is regenerated
  and its counts machine-checked.
- [x] **5.3 Diff view.** `map --diff <rev>` marks changed files and their `impact` neighbourhood
  and adds a "this change touches areas …" block to `MAP.md`.
- [x] **5.4 Context hook unchanged by default.** It keeps carrying state, not instructions;
  pointing it at `MAP.md` is decided by 8.3.

## Phase 6 — Breadth: languages, SCIP, docs, this repo

- [x] **6.1 Grammars** (from `later/road-to-a-graph-that-wins` 1.1): python, go, java, vue —
  each vendored with a fixture and a golden graph. *Corrected in execution:* Python, Go and
  Java are vendored (ABI 14, +1.14 MB, packed-binary manifest rows); Vue needs no grammar — a
  component's template is blanked and its `<script>` parsed with the TypeScript grammar, line
  numbers kept. Imports resolve by module path (Python, Java: unique suffix; Go: every non-test
  file of the package), refused when two files match.
- [x] **6.2 SCIP reader (D6).** Read `index.scip` in-process without a native dependency as a
  provider whose edges carry `resolved_via: 'compiler-index'`; a SCIP edge outranks a native
  guess for the same pair. Result: `scip_reader.ts`, a hand-written decoder for the
  documents / occurrences subset (E8: well under 300 lines, no protobuf runtime); edges carry
  `provider: 'scip'`; a superseded native guess is dropped; the index enters the checksum.
- [ ] **6.3 Docs layer.** Deterministic Markdown link and backticked-path extraction: a document
  that names a file gets an edge to it. No model, no PDF or image extraction.
- [ ] **6.4 This repository's own map.** On an agent-config source tree, the artefact graph
  (D13) renders as a second layer; `docs/maintainers/system-map.md` links to it.

## Phase 7 — The map learns and serves the workflow

- [ ] **7.1 Local outcome overlay.** A file a session cites as useful or as a dead end gets a
  local, time-decayed score in `agents/runtime/state/`, drawn as a ring. Never committed, never
  sent anywhere.
- [ ] **7.2 Merge-order hint.** For open PRs, the areas each one touches; two PRs sharing an area
  are flagged as a merge-order risk. Advisory only.
- [ ] **7.3 Area drift.** `MAP.md` states which areas grew, split or merged since the last build.
- [ ] **7.4 `/project analyze` stops duplicating (D9).** It links to the map for structure and
  turns the dual-database shape into a stack-probe result.

## Phase 8 — Measurement, inside the change

Measurements ship with the change and decide defaults. They do not decide whether the map exists.

- [ ] **8.1 Cost readings** on this repo, the Laravel fixture and a synthetic large tree: engine
  build, twin emission, map build, HTML bytes, `query` p50/p95 on the index path. Recorded in an
  evidence report.
- [ ] **8.2 Correctness oracles.** Per relation added in Phases 1, 4 and 6: a positive fixture
  and a negative one (two same-named methods in two namespaces; a fluent `->middleware()`). A
  missing edge is preferred to a wrong one.
- [ ] **8.3 Orientation benchmark.** Pre-registered beside the existing graph-vs-grep reports:
  "which area owns X", "what does area A depend on", "what does route R touch". Arm A grep/read,
  arm B grep/read + `MAP.md` + `graph_area`. On a win the skill routes orientation to `MAP.md`; on
  a tie the map stays on demand. Published either way.

## Kill register

| # | Not doing | Why |
|---|---|---|
| K1 | A model call while building the map | Determinism, no cost, no egress. |
| K2 | CDN-loaded scripts or styles | S1 loads its views from CDNs, one unpinned. Local has to mean offline. |
| K3 | A Python toolchain | The suite is TypeScript; seeded Louvain plus 2.3/2.4 reached the readings above. |
| K4 | Physics in the browser | A precomputed layout opens fast and cannot overflow the stack (S1's recorded failure). |
| K5 | Committing `agents/map/` | It changes on every commit; S1 needed a merge driver for its committed graph. |
| K6 | New settings keys | Owner directive 2026-10-12; command flags suffice. |
| K7 | A token-savings headline | Only Phase 8 numbers are quoted. |
| K8 | A live `--serve` map or a resident language server | Resident processes; a separate decision under ADR-249. SCIP (6.2) supplies precision without one. |
| K9 | Drawing all symbols at once | ~40k nodes on this repo; symbols live in the panel. |
| K10 | LLM extraction of docs, PDFs, images or video | Egress and cost; 6.3 covers docs deterministically. |
| K11 | Flipping the canonical store to SQLite | The index path exists; it was unreachable because of D3/D4, not the design (ADR-129 stands). |
| K12 | A new `agent-config graph …` namespace or `agents/graph/` | Duplicates the `code-graph` family CLI, MCP and skill already use. |
| K13 | Cross-repo, issue-tracker, runtime-trace overlays and multi-session stress gates now | No defect in the tree asks for them yet; each gets its own roadmap when one does. Symfony and React overlays follow the Laravel one when a fixture demands them. |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | product-owned | owner | Amend ADR-124's state clause (0.1) rather than hide the map under `agents/runtime/state/map/` | Owner directive 2026-10-23: build the map in a project's `agents/` folder | the owner moves the map elsewhere |
| E2 | reversible-technical | agent | `agents/map/` is local-only and gitignored (K5) | It changes on every commit; a rebuild costs seconds on top of the engine | a consumer needs the map in review diffs |
| E3 | reversible-technical | agent | Exact-pinned graphology packages, justified in 0.1, over a native implementation | MIT, pure JS, no install script; ADR-124 admits pinned pure-npm deps with a justification | a package turns unmaintained or adds a native step |
| E4 | reversible-technical | agent | `agent-config code-graph map` + `/map` (or `/code-map` after 0.4); folder `agents/map/` | Keeps the existing `code-graph` family (K12) | 0.4 finds a collision |
| E5 | reversible-technical | evidence | Test roots are part of the default map build | Without them tested libraries look orphaned (source measurement: 28 in this repo) | 8.3 shows tests mislead orientation |
| E6 | reversible-technical | evidence | The Laravel overlay follows the first slice (Phase 4), before more languages | D12: 57 % of Fixture L unconnected without it | a non-Laravel consumer stack dominates the fixtures |
| E7 | product-owned | owner | One `process-full` PR for the whole roadmap; Phase 1 runs first inside it | Owner instruction 2026-10-23 (`/roadmap:process-full`, update the PR) | — |
| E8 | reversible-technical | agent | SCIP via a hand-written decoder for the needed protobuf subset if under ~300 lines, else a justified package | No native dependency; ADR-124 implementation preference | the decoder exceeds the bound |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The root fix breaks this repo's own graph | implementation | 1.1 changes the fallback that this checkout's hooks and tests rely on. | The anchor walk resolves to this checkout from inside it; the engine tests run before and after. | Phase 1 — The engine tells the truth in a consumer project |
| 2 | Id salting churns every golden | implementation | 1.3 changes ids that goldens and stored caches carry. | One `SCHEMA_VERSION` bump forces a rebuild; goldens regenerate in the same change. | Phase 1 — The engine tells the truth in a consumer project |
| 3 | The map is wrong in a way nobody sees | product | A canvas hides cut and overlapping labels from DOM checks; a clustering blob hides structure. | 3.6 checks label boxes; AC-7 caps area size; 8.2 oracles prefer a missing edge. | Phase 3 — First visible slice: HTML, MAP.md, command |
| 4 | Hostile file names execute in the viewer | implementation | Paths and symbol names are attacker-influenced in a cloned repo. | 3.5 escaping plus the hostile-label golden (AC-8). | Phase 3 — First visible slice: HTML, MAP.md, command |
| 5 | New dependencies widen the supply chain | implementation | 2.6 and 3.1 add packages and a vendored bundle. | Exact pins, registry check before install, licence notice, justification in 0.1. | Phase 0 — Records first, so nothing below fights the tree |
| 6 | The Laravel overlay invents edges | product | Rule-based resolution can match the wrong method. | Guard in 4.4 and the negative fixtures of 8.2. | Phase 4 — Laravel overlay: the map becomes true for the owner's stack |

## Acceptance Criteria

- [ ] AC-1 — In a fixture consumer, a flagless `agent-config code-graph build` indexes the fixture, writes the cache under the fixture, and MCP `graph_query` answers from it (D1, D2).
- [ ] AC-2 — 0 duplicate node ids on this repo and on the Laravel fixture; the SQLite twin exists, is emitted in ≤ 2 s here, and `query` uses the index path (D3, D4).
- [ ] AC-3 — A changed extractor fingerprint forces a full re-extraction (D5).
- [ ] AC-4 — `agent-config code-graph map` writes `agents/map/{index.html,MAP.md,map.json,areas/}`; the layout lint is green; the files are gitignored.
- [ ] AC-5 — Two builds of the same tree produce byte-identical `map.json`, `MAP.md` and `index.html`.
- [ ] AC-6 — `index.html` contains no external URL, opens offline, and renders at desktop / 375 / 320 px with zero page errors where Playwright is present.
- [ ] AC-7 — No area exceeds 25 % of files on either fixture; thresholds are printed in `MAP.md`.
- [ ] AC-8 — The hostile-label fixture renders as text, never as markup.
- [ ] AC-9 — On the Laravel fixture the map shows route → controller → view / model → table, and isolated files fall below 20 %.
- [ ] AC-10 — `comparison.yaml` makes no claim about the graph that the tree contradicts.
- [ ] AC-11 — `graph_area` and `graph_map_status` are in the MCP catalog with machine-checked counts.
- [ ] AC-12 — The 8.1 readings are recorded; 8.3 is pre-registered before its first run and published whichever way it lands.
