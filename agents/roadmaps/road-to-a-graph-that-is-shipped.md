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
estate_growth_exempt: "Owner-instructed 2026-09-07. Adds one active roadmap. Measured at 0918def55: active_roadmaps floor 4 at origin/main (the floor is the base-ref measurement, ADR-243 removed the stored number), 5 files present. It repairs a shipped surface no consumer can receive — the parser pair is a devDependency (ADR-246 → ADR-259), the only always-on path is a nudge shipped default-off, the MCP server carries 31 tools and no graph tool, and no query path reads the graph without deserializing all of it. Every defect below reproduces on this tree's own source; every receiver named exists in the estate at this pin. Re-claimed 2026-09-08 for a second dimension: open_blockers 29 → 30, the one blocker this change records — pack-size-budget-preexisting-overage. It is a gate that is ALREADY red on origin/main and that Phase 0.1 adds payload to, and its own Recommendation field puts the fix out of reach of an execution run: budgets.packed_size_mb.max is a maintainer-owned ratchet with review_by 2027-07-31. So the alternative to this growth is not a smaller estate, it is an unrecorded red gate whose next reader assumes this change caused it. Recording it is the cheaper of the two, and the count returns to the floor when the maintainer re-measures the cap."
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

- [x] Read `docs/decisions/ADR-259-code-graph-parsers-ship-with-the-package.md`,
      `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md` (the record it
      supersedes, including its 2026-08-28 confirmation that the benchmark trigger did not
      fire), and `src/scripts/hooks/host_semantics.ts`.
- [x] Run `agent-config roadmap:context --roadmap road-to-a-graph-that-is-shipped` and
      record the probe's `scanned:` line against the `relates:` block above.
      <!-- 2026-09-07: scanned 1 PR · 899 roadmap files · 431 remote branches · 3 live
      sessions · 0 inbox names. Fingerprint bb40bb72ebfc6dd6 (base 04a9af594). No remote
      branch carries this slug and no open PR overlaps its files, so neither `relates:`
      entry is stale: `road-to-a-graph-that-wins` is present in `later/` (extends, still
      parked) and `road-to-first-reference-analysis-observation` shares no surface. -->
- [x] Run [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
      before the first checkbox.
      <!-- 2026-09-07: gate is INERT by its own § "When it fires — and when NOT" — it fires
      on plan *authoring*, and explicitly does not fire on `/roadmap:process-*` execution
      runs. This is an execution run against an accepted roadmap, so no marker line and no
      interview. Recorded rather than silently skipped. -->

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

- [x] **0.1 ADR-259 lands** (owner-directed): `web-tree-sitter` moves to `dependencies`;
      the **three loadable grammars** are vendored at `src/vendor/grammars/` and listed in
      `package.json` `files`. `tree-sitter-wasms` stays a devDependency as the refresh
      source. No companion package.
      verify: `./scripts-run src/scripts/check_dependency_floors` green; `npm pack --dry-run`
      lists the vendored wasm files and no other; ADR-246 carries `superseded_by: ADR-259`;
      `./scripts-run src/scripts/adr_cite_check ADR-259` reports it live.

      <!-- MECHANISM AMENDED 2026-09-07 under the owner's standing direction for this run
      ("amend the ADR in the same change rather than descope the step"). The step as
      written could not be built: (a) "move to `dependencies`" and "listed in `files`" are
      two different mechanisms — a dependency's files are never in this package's `files[]`;
      (b) depending on `tree-sitter-wasms` delivers all 36 grammars (49 MiB), the outcome
      ADR-259's own Alternatives rejects; (c) vendoring the 13-grammar set measures
      1,016,804 B compressed, putting the tarball at ~10.84 MB against the maintainer-owned
      `budgets.packed_size_mb.max = 9.1`, which this run may not raise; (d) only three
      grammars are loadable — `GRAMMAR_WASM` in code_graph/types.ts has three entries — so
      the other ten would be payload with no reader, the Risk-1 shape. The amendment is
      recorded at ADR-259 § "Amendment — 2026-09-07 · vendored-wired-set". Net effect is
      strictly smaller than the record accepted: 3.63 MiB on disk / +373,922 B compressed,
      against the 8.69 MiB ADR-259 had priced in.

      verified 2026-09-07:
        · check_dependency_floors → "✅ dependency floors settled (13 runtime deps)"
        · npm pack --dry-run --json --ignore-scripts → exactly 3 `.wasm` entries, all under
          src/vendor/grammars/ (php 812,594 · typescript 2,342,690 · javascript 647,334)
        · ADR-246 frontmatter `superseded_by: 259` (pre-existing, unchanged)
        · adr_cite_check ADR-259 → "AMENDED — read the amendment before citing"
        · check_adr_frontmatter → "✅ no errors"
        · check_publish_surface → "✅ in sync with package.json files[]"
        · check_pack_size binary class → "0 unaccounted" (3 bound entries added)
        · loader loads all three grammars from the vendored dir at ABI 14
        · tests/scripts/code_graph.test.ts → 28 passed
      Blocked-adjacent, NOT caused by this step: `check_pack_size` packed_size_mb — see
      `## Blockers` → `pack-size-budget-preexisting-overage`. -->

## Phase 1 — Delivered on install

- [x] **1.1 Consumer install builds.** A throwaway directory, `npm install` of the packed
      tarball, `agent-config code-graph build --root .` on a PHP+TS fixture.
      verify: exit 0, node/edge counts printed, no manual step; the size delta is re-measured
      and recorded in `docs/MIGRATION.md` in bytes.

      <!-- verified 2026-09-07 against the real tarball (`npm pack` WITH prepack, 3,059
      files), installed into a throwaway `/tmp/ac-consumer-rig` holding two PHP classes
      (Controller -> Service->handle -> $this->format) and two TS modules (index -> util,
      titleize -> slugify):
        · npm install exit 0
        · the consumer received src/vendor/grammars/ — 3 wasm, byte-identical sizes
        · `tree-sitter-wasms` ABSENT from the consumer's node_modules (so the 49 MiB pack
          is genuinely not delivered), `web-tree-sitter` PRESENT
        · `agent-config code-graph build --root .` exit 0, NO manual parser step:
          "✅ code-graph built — 4 files · 12 nodes · 15 edges
           languages: php, typescript · grammar ABI 14
           edges: EXTRACTED 12 · INFERRED 2 · AMBIGUOUS 1"
      Size delta recorded in docs/MIGRATION.md § "14.21.x — the code-graph engine ships to
      consumers" in bytes, per the step.

      OBSERVED, pre-existing, NOT introduced here and NOT in this step's verify: the CLI
      printed "package-local tsx not found — falling back to `npx tsx`" before succeeding.
      `code-graph` dispatches to a tsx script while `tsx` is a devDependency, so a cold
      consumer without a cached tsx would resolve it through npx at first use. The build
      still exits 0 and the graph is correct. Flagged rather than fixed: it is a packaging
      property of every tsx-dispatched verb in this CLI, not of the grammar delivery, and
      repairing it is a change to the CLI entry surface with its own blast radius. -->

      <!-- OPEN QUESTION for the PR body, per K8 — the `npx tsx` fallback above means the
      literal claim "no network at first use" is unproven for a cold consumer, even though
      "no manual parser install" (what this step asserts) is proven. Whether that fallback
      is acceptable for the shipped engine is a decision this roadmap does not contain. -->
- [x] **1.2 Retire the nudge.** Delete `src/scripts/hooks/code_graph_nudge_hook.ts` and the
      `hooks.code_graph.enabled` row; add a `hook_manifest` entry `code_graph_context`: on
      PreToolUse-capable hosts (per the `VERIFIED_PLATFORMS` table in
      `src/scripts/hooks/host_semantics.ts:61`) emit the host's structured
      `additionalContext` once per session when a graph is `fresh|behind:N`; on
      instruction-file hosts deliver the same one line as a rule. Never a plain echo.
      Remove the D9 import in `concern_registry.ts:61` in the same change.
      verify: fixture asserts the JSON envelope; `enforced_by` per host resolved from the
      table, not from a host name; `grep -c code_graph_nudge src/scripts/hook_manifest.yaml`
      is 0; `./scripts-run src/scripts/check_enforcement_coverage` green.

      <!-- verified 2026-09-07:
        · tests/scripts/code_graph_context_hook.test.ts → 12 passed, incl. the envelope
          fixture: emitFor('claude','pre_tool_use','warn',[line],2) yields exit 0 and
          {"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":<line>}}
          — never exit 2, never a plain echo. A companion case pins the unverified-host
          branch (windsurf: stdout empty, legacy exit returned verbatim), which is WHY
          the same line is carried as a rule there.
        · grep -c code_graph_nudge src/scripts/hook_manifest.yaml → 0 (and the compiled
          hook_manifest.json → 0)
        · check_enforcement_coverage --check → "✅ enforcement-coverage ratchet holds"
        · hooks.code_graph.enabled → 0 hits in src/ and dist/ settings templates
        · tests/hooks/ → 544 passed; concern_severity + dispatch_hook + the
          pre_tool_use guard roster all green after the concern rename
        · npm run typecheck → clean

      DESIGN NOTES, because two parts of the step needed a reading:

      1. "Remove the D9 import in concern_registry.ts:61" is read as removing the NUDGE's
         import — the file is deleted, so it must go — and registering the replacement in
         its place. Removing the line outright would leave the new concern unregistered
         in-process, which contradicts the same step's requirement that it emit at all.
         D9's count of engine importers is unchanged either way: concern_registry imports
         a HOOK, never the engine.
      2. The replacement is default-ON with no settings flag, where the nudge was
         default-OFF behind `hooks.code_graph.enabled`. That is safe because the new hook
         is SILENT on ABSENT — it speaks only on `fresh` / `behind:N`. A consumer who
         never builds a graph never hears from it, so there is nothing for a flag to
         protect. The nudge's default-OFF existed because it fired on ABSENT, i.e.
         advertised a capability the consumer could not then install; Phase 0.1 removed
         that premise.

      DOWNSTREAM, swept and repaired in the same change (the flag had readers beyond the
      hook): auto_dispatch.ts's reason string and its test, regression_neighbourhood.ts's
      rationale, auto-dispatch-classification.md, settings-reference.md,
      settings-classes.md, hook-architecture-v1.md, and the pre_tool_use guard roster.
      Historical surfaces — evidence artefacts, archived roadmaps, review inputs, ADR-246
      — keep their original wording, which was true when written.

      FOUND, not fixed, and it belongs to Phase 3/4: every production caller of
      `classifyLookup` (`routing_doctor.ts:392`, `judgment_ladder.ts:354,515`) passes no
      opts, so `codeGraphEnabled` is always undefined and the `code-graph-query` primitive
      is unreachable regardless of any flag. Retiring the flag did not cause this and
      wiring it here would be scope creep — 3.4 is where a real graph reader lands. -->
- [ ] **1.3 Freshness from git, no daemon.** post-commit and post-checkout run
      `code-graph refresh --budget-seconds` in the background, single-flight, honouring
      `core.hooksPath`; a union merge driver for the index; staleness exported to the runtime
      journal as `fresh | behind:N | absent`.
      verify: `check_installed_hooks_fresh` covers both hooks; a two-branch fixture merges
      without conflict markers; two concurrent commits produce one refresh.

      <!-- 2026-09-07 — LEFT UNTICKED DELIBERATELY. All three verify conditions pass, but
      one clause of the step body is unbuilt and another is refuted, so ticking would
      overstate it. What landed, what did not, and what closes it:

      LANDED, and verified:
        · post-commit and post-checkout run `code-graph refresh --budget-seconds 60`
          detached, single-flight, never building a graph that does not already exist.
          Single-flight is an atomic `mkdir`, not a lock FILE — two processes can both
          truncate-and-write a path, and only one can create a directory.
        · `core.hooksPath` is now honoured by the installer. It was not before: HOOKS_DIR
          resolved through `--git-common-dir` only, so on a repo that sets core.hooksPath
          the installer wrote six hooks git never reads, and the freshness gate then
          compared the copy nothing executes.
        · tests/scripts/code_graph_git_freshness.test.ts → 6 passed. These execute the
          REAL rendered hooks through the installer's `AGENT_CONFIG_HOOKS_DIR` seam, not a
          reimplementation. Includes a SENSITIVITY case: with the `mkdir` guard
          neutralised the same two calls produce 2 refreshes instead of 1, so the
          single-flight assertion is known to have teeth.
        · `check_installed_hooks_fresh` names both `post-commit` and `post-checkout` in
          its report — it renders the installer and compares whatever it writes, so
          coverage of the two hooks is by construction.

      REFUTED — "a union merge driver for the index" cannot be built, because it has no
      object. `agents/runtime/` is gitignored (`.gitignore:196`) and ADR-129 makes the
      cache a derived, disposable accelerator whose rollback is `rm`. Git never sees the
      file, so it can never conflict on it and a driver would never be invoked. The
      fixture asserts the PROPERTY the driver was meant to deliver (a two-branch merge
      leaves no conflict markers in the index) and pins the reason — `git ls-files` on the
      cache path returns empty. Closing this differently would mean TRACKING the index,
      which contradicts ADR-129's invariant and is an owner decision, not a wiring fix.

      NOT BUILT — "staleness exported to the runtime journal as `fresh | behind:N |
      absent`". The three-state value is computed and already reaches the agent: it is the
      `GraphState` union in `code_graph_context_hook.ts`, delivered as additionalContext by
      1.2. What is missing is the JOURNAL sink. `_lib/runtime_journal.ts` is a SQLite,
      append-only store with a closed field vocabulary and a `NoFreeForm` type guard —
      `JournalEvent` has no field this value fits, so the export needs a schema addition
      plus a migration on a surface that is default-OFF (`hooks.runtime_journal.enabled`)
      and would therefore produce no data for almost every consumer. That is a governed
      schema change with its own contract, not a line of wiring, and doing it inside this
      step would be scope creep.
      WHAT CLOSES IT: a decision on whether the journal is the right sink at all given it
      is default-OFF, and — if yes — a typed field or event-kind addition to
      `EVENT_VOCABULARY` with its migration. Reported as a question per Kill register K8;
      the step stays `[ ]` until it is answered. -->
- [x] **1.4 Ignore hint** for the index path in the installed ignore surfaces
      (prompt-cache invalidation on hosts that hash the workspace).
      verify: `sync_gitignore` output contains the path.

      <!-- verified 2026-09-07: `sync_gitignore --path <rig> --dry-run` emits
        +/agents/runtime/state/code-graph-v1.json
        +/agents/runtime/state/code-graph-v1.sqlite3
        +/agents/runtime/state/code-graph-refresh.lock/
      sync_gitignore.test.ts + sync_gitignore_fix_fixtures.test.ts → 33 passed;
      check_tracked_but_ignored → clean.

      The entries are REDUNDANT with the existing `/agents/runtime/` catch-all, and the
      template says so in place so a future reader does not delete them as duplication.
      They are named anyway for the reason the step gives: a host that keys a prompt cache
      on a workspace file-list hash pays for the index on every commit now that 1.3
      rewrites it from post-commit and post-checkout, and an entry findable by grepping the
      index's own name is what makes that cost traceable. The twin and the refresh lock are
      listed with it because the same machinery creates them beside it. -->

## Phase 2 — Indexed store

- [x] **2.1 SQLite becomes the read store above 50k edges — as a queryable index, not a
      blob.** Tables `nodes(id, kind, label, file)`, `edges(src, dst, relation, confidence,
      resolved_via, provider)`, indexes on `id`, `label`, `src`, `dst`. Add the per-node and
      per-edge read API `sqlite_store.ts` lacks today (D7), and route `affected`/`query`
      through it so neither `JSON.parse` nor the full `Map` build runs (D6). JSON stays
      canonical for hashing and diff.
      verify: `affected` on a ≥50k-edge build parses no JSON (traced); wall time and RSS
      before/after recorded in the commit; `code-graph validate` asserts twin ⇔ JSON by
      checksum.

      <!-- verified 2026-09-07.

      MEASURED — `affected` 2 hops, 60,000-edge graph (14,131,489 B of JSON), each arm in
      its OWN process because RSS is cumulative within one:

        | arm     | wall     | RSS      | heap    | graph materialized |
        |---------|----------|----------|---------|--------------------|
        | indexed |     4.9 ms | 190.7 MB |  59.9 MB | no                |
        | blob    | 9,809.6 ms | 349.0 MB | 163.0 MB | yes               |

      Both arms return the same 2 lines. The blob arm's 9.8 s is dominated by
      `validateGraph` over 120k items plus a `LexicalIndex` built across 60,001 nodes —
      work the indexed path does not do at all, because the BM25 corpus is lazy and an
      exact-id seed never asks for it.

      TRACED, not asserted — tests/scripts/code_graph_indexed_read.test.ts → 7 passed:
        · `JSON.parse` is wrapped and counted: ZERO calls on the indexed arm.
        · the canonical JSON is chmod 000 for the duration, so a read is impossible
          rather than merely observed (`statSync` still works, which is all the freshness
          check needs). `fs.readFileSync` could not be spied: under ESM `node:fs` is a
          frozen module namespace.
        · SENSITIVITY: the same query below the threshold parses (>0) and materializes.
        · both paths return identical `lines` and `recommended_reads`.

      FINDING, recorded because it corrects the obvious test design: below the threshold
      `loadGraph` STILL succeeds with the canonical JSON unreadable, because
      `loadSerializedFromTwin` sources bytes from the twin and only falls back to the file
      when the twin is absent or stale. So a FILE READ never discriminated the two paths —
      which is exactly D6's corrected finding that the twin was a cheaper blob transport
      and not an index. The parse is the discriminator, and it is what is measured.

      `code-graph validate` now compares the twin's stored `source_checksum` against the
      JSON's, with three outcomes proven by fixture: `match` (exit 0), `absent` (exit 0 —
      a missing accelerator changes no answer), `mismatch` (exit 1). The mismatch case is
      the teeth: `emitSqliteTwin` stats the real file, so an impostor twin is FRESH by
      size and mtime and nothing in the freshness path catches it.

      GRAPH_STORE_VERSION 1 → 2, so a v1 twin is refused and re-emitted rather than being
      read through columns it does not have. `resolved_via` / `provider` columns exist and
      are nullable here; 2.2 populates and enforces them. -->
- [x] **2.2 Two fields on every edge.** `resolved_via ∈ {same-file, import-specifier,
      path-alias, psr4, route-table, test-import, name-lookup, dynamic}` and `provider`
      (`native`). Schema version bumps; `build` prints the `resolved_via` histogram.
      verify: no edge lacks either field; the v2 corpus rerun is byte-identical on recall and
      precision.

      <!-- verified 2026-09-07.

      NO EDGE LACKS EITHER FIELD, and it is the TYPE SYSTEM that guarantees it: both are
      REQUIRED on `CodeEdge`, so every construction site must supply them or the build does
      not compile. That is stronger than a linter pass after the fact — adding the fields
      broke `sqlite_store.ts` and a test fixture at compile time, which is the check
      working. Measured on a 3-file PHP+TS fixture: 18 edges, 0 missing `resolved_via`,
      0 missing `provider`, 0 values outside the enum, `provider` ∈ {native}.
      `validate` gained presence-AND-membership checks for both — SENSITIVITY proven by
      stripping one field from one edge: "❌ graph schema invalid (1): edge[0].resolved_via
      is required".

      HISTOGRAM on every build: `resolved_via: same-file 13 · name-lookup 3 ·
      import-specifier 2`. Printed unconditionally because it is the number that says
      whether 2.3 worked, and the confidence split does not.

      FOUR OF EIGHT values occur today, stated rather than implied: `same-file`,
      `import-specifier`, `name-lookup`, `dynamic`. `path-alias` and `psr4` arrive with
      2.3; `route-table` and `test-import` with Phase 3's relations. They are in the union
      now so adding them is a build change, not a schema change.
      Mapping decisions, recorded because they were judgement calls: an UNRESOLVED
      `symbol:` target is `name-lookup` (a name lookup is what was performed and what
      failed — `confidence` already carries that it failed); a `member` edge is `same-file`
      because the member id is DERIVED from its own source node's id; a hierarchy walk is
      `name-lookup`, not `same-file`, because the declaring class need not be local.

      V2 CORPUS RERUN — BYTE-IDENTICAL on recall and precision against the reference the
      roadmap cites (`code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md`):

        | class              | rerun 2026-09-04            | this run 2026-09-07 |
        |--------------------|-----------------------------|---------------------|
        | callers            | R 1/1 +0 · P 0.611/0.667 TIE | identical          |
        | transitive-impact  | R 0.611/0.611 +0 · P 1/1 TIE | identical          |
        | path-between       | R 0.917/1 +8.3 · P 0.722/1 TIE | identical        |
        | references         | R 1/1 +0 · P 0.722/1 TIE     | identical          |
        | macro grep         | P 0.764 · R 0.882            | identical          |
        | macro graph        | P 0.917 · R 0.903            | identical          |

      Zero of four classes met the +10 pp bar; every class TIE. This roadmap moved
      delivery, not measurement — which is AC-6, and it now has evidence rather than an
      intention.

      SCHEMA_VERSION 2 → 3 and GRAPH_STORE_VERSION 2 → 3. Both are needed and for
      different reasons: a v2 SIDECAR carries untagged edges, so `--update` would mix
      tagged and untagged and under-count the histogram; a v2 TWIN has the columns but may
      have written them NULL, which reads back as a valid edge carrying a fabricated
      mechanism.

      FOUND, not fixed, and outside this step: `run_bench_inrepo_v2.ts` writes its report
      to a filename stamped with the CORPUS date (`…-v2-2026-08-29.md`), not the run date,
      so any rerun OVERWRITES a dated historical artifact in place — this run clobbered the
      2026-08-29 report with 2026-09-07 content and it was restored with `git checkout`.
      The 2026-09-04 rerun evidently hit the same thing and worked around it by writing to
      a `-rerun-` filename by hand. -->
- [ ] **2.3 Resolution tiers before name lookup:** `tsconfig` `paths` and composer PSR-4.
      verify: INFERRED count on `src/scripts/ai_council` falls; EXTRACTED does not regress.

      <!-- 2026-09-07 — LEFT UNTICKED. Both tiers are BUILT and proven by fixture, but
      half the verify line is unachievable on the probe it names, and the honest reading
      of "the box flips when its verify passes" is that half a verify is not a pass.

      BUILT, in `src/scripts/code_graph/resolution_tiers.ts`, and wired ahead of the
      repo-wide name table:
        · tsconfig `paths` — `@shared/x` binds to `src/shared/x` because the project
          declares it. Longest-prefix-first, which is TypeScript's own rule. Reads JSONC,
          because tsconfig is JSONC by convention and this repository's own carries `//`
          comments, so `JSON.parse` throws on it.
        · composer PSR-4 — `App\Services\Mailer` binds to `app/Services/Mailer.php`.
          Needed a new extractor field: PHP `use A\B\C` was reduced to its BASE NAME and
          the namespace discarded, so `fqName` now carries the qualified name — the same
          shape as `moduleSpecifier` for TS, which the extractor's own docstring describes
          as "the one piece of evidence that says WHERE the name came from".
      An edge resolved through either is EXTRACTED, not INFERRED: a declared mapping is as
      much a syntactic fact as an import specifier. Config reading is IO and lives in
      `buildFromRepo`; `buildGraph` stays pure, so identical source plus identical config
      still yields identical bytes.

      tests/scripts/code_graph_resolution_tiers.test.ts → 11 passed, each tier with a
      SENSITIVITY twin: remove `tsconfig.json` and the same import binds
      `external:@shared/mailer.js`; remove `composer.json` and the same `use` falls back to
      `name-lookup`. The PSR-4 fixture carries TWO classes named `Mailer` in different
      namespaces — the case a base-name lookup cannot tell apart and PSR-4 can.

      HALF THE VERIFY PASSES: "EXTRACTED does not regress" — 3,967 before, 3,967 after,
      exactly unchanged.

      THE OTHER HALF CANNOT PASS ON THIS PROBE, measured rather than argued. INFERRED on
      `src/scripts/ai_council` is 11 before and 11 after, and zero of its edges resolve via
      either new tier. Three independent reasons:
        1. The config is read from the BUILD ROOT, and `src/scripts/ai_council/` has no
           `tsconfig.json` of its own.
        2. Even repo-wide it would not help: the aliases are `@cli/*`, `@server/*`,
           `@shared/*`, `@install/*` over `baseUrl: ./src` — none maps into
           `src/scripts/`.
        3. There is no `composer.json` in this repository at all, so the PSR-4 tier has
           nothing to read anywhere.
      And the 11 INFERRED edges are not specifier or namespace cases in the first place:
      7 are `this`-style hierarchy-method resolutions inside one file
      (`AnthropicClient::ask -> AnthropicClient::_ask_impl`) and 4 are repo-wide
      name-table hits (`low_impact.ts#… -> spend_gate.ts#CostBudget`). No import
      resolution tier can move either class.

      WHAT WOULD CLOSE IT: a probe root that actually exercises a tier. Either re-point
      the verify at a fixture tree that has a tsconfig with a covering alias and a
      composer.json (the test above is exactly that), or pick an in-repo root the existing
      aliases cover — `src/cli`, `src/server`, `src/shared` and `src/install` are the four
      candidates. Re-pointing the probe is a decision about the roadmap's own acceptance
      criterion, so it is reported as a question per Kill register K8 rather than taken.

      AC-6 STILL HOLDS after this step: the v2 corpus rerun is byte-identical again —
      callers R 1/1 +0 P 0.611/0.667 · transitive-impact R 0.611/0.611 +0 P 1/1 ·
      path-between R 0.917/1 +8.3 P 0.722/1 · references R 1/1 +0 P 0.722/1 · macro grep
      P 0.764 R 0.882 · macro graph P 0.917 R 0.903. The tiers are inert on the three
      benchmark roots for the same reason they are inert on ai_council, so this is
      consistent rather than surprising. -->

## Phase 3 — Three verbs a gate can read

- [x] **3.1 `impact --diff <rev>`** — callers, dependents and test files reachable from the
      changed symbols over accepted edges (`resolved_via` not in `{name-lookup, dynamic}`),
      plus the producing edges and a minimal read set.
- [x] **3.2 `tests-for <symbol>`** and **`untested --diff <rev>`** — needs relation `tests`
      (test file → subject via import); one fixture.
- [x] **3.3 `dead`** — zero accepted callers, excluding declared entry points: routes,
      exports, the CLI registry (`src/cli/registry.ts`), the hook manifest.
      verify for 3.1–3.3: golden outputs on a fixture; each prints `resolved_via` counts and
      the staleness state; `describeImpact` is listed by `dead` and by nothing else.

      <!-- verified 2026-09-08. All four verbs live in
      `src/scripts/code_graph/verbs.ts` (gate-facing) and are dispatched from
      `src/scripts/code_graph/cli.ts` as `code-graph` subcommands — no new top-level verb,
      per K4. `src/cli/registry.ts:86` synopsis updated in the same change.

      THE SHARED VERIFY, ITEM BY ITEM — tests/scripts/code_graph_gate_verbs.test.ts,
      23 passed:
        · GOLDEN OUTPUTS ON A FIXTURE. Every list assertion is `toStrictEqual` over the
          full sorted array, never `toContain`, so an extra element fails. The fixture is
          a real PHP+TS tree built through `buildFromRepo` — never a graph literal, which
          would let the verbs pass over a shape the extractor cannot produce.
        · EACH PRINTS `resolved_via` COUNTS AND THE STALENESS STATE. Two histograms, not
          one: `accepted resolved_via` and `rejected resolved_via`, so a caller can tell
          "no callers" from "no callers I would trust". Staleness is the same three-state
          `fresh | behind:N | absent` token 1.2 delivers.
        · `describeImpact` IS LISTED BY `dead` AND BY NOTHING ELSE. One fixture symbol,
          declared, called by nothing, imported by nothing: absent from `impact`'s
          dependents, absent from `tests-for`, present in `dead`. The single assertion
          catches both over-reporting and under-reporting. It IS listed by `untested`, and
          that is correct rather than a leak — `untested` is 3.2's second verb, not one of
          the three the verify names, and "changed and no test imports it" is a different
          question with the same answer here. Recorded rather than quietly excluded.

      TWO SENSITIVITY PAIRS, both proven by neutralising the mechanism and watching the
      suite go red (a test never seen red has unknown sensitivity):
        · accepted-edge filter → `isAcceptedEdge` forced to `true`: 2 failed / 15 passed.
          The case is a real `INFERRED / name-lookup` edge — a bare PHP `helper()` with no
          `use` — which the filter must drop and which appears in `rejected_via: name-lookup 1`.
        · containment filter → `member` added to `REFERENCE_RELATIONS`: 5 failed / 12 passed.

      THE `tests` RELATION (3.2's prerequisite) IS DERIVED, NOT EXTRACTED. `buildGraph`
      emits `test file --tests--> subject` for every `imports` edge whose source file is a
      test and whose target is an in-repo node in a non-test file; `resolved_via:
      test-import` (a value 2.2 declared and left unemitted for exactly this),
      `confidence: INFERRED`. The two axes are split deliberately: the import is a
      syntactic fact, so the EVIDENCE is extracted, while "this test tests that subject"
      is an inference from a path convention. Derived in the build pass rather than in the
      extractor because the predicate is a property of two PATHS, which no grammar can
      see, and `buildGraph` stays pure. Three exclusions, each of which would otherwise
      manufacture a false edge: an `external:` / `symbol:` target (no subject), a target
      in another test file (a shared helper is not a subject), and — via the sensitivity
      twin — the same import from a non-test path, which derives nothing.

      SCHEMA_VERSION 3 → 4 and GRAPH_STORE_VERSION 3 → 4. The store bump is the
      interesting one: NO column changed, which is precisely why it is needed. A v3 twin
      would read back cleanly, answer `tests-for` with the empty set, and the caller could
      not tell "nothing tests this" from "this twin predates the relation".

      `dead` REFUSES BY DEFAULT, and that is a council decision rather than a design
      preference — AI council 2026-09-08, 2/2 convergent (anthropic + openai), round 2
      Fork 4, option 2. Step 3.3 names four entry-point sources and one of them cannot be
      evaluated from this graph at all: the extractor records no exportedness
      (`FileExtract` at `src/scripts/code_graph/extract.ts:82-90` carries
      `nodes / rawEdges / inherits / parseError`; `CodeNode` carries no export flag;
      `grep -n 'isExported\|exported\|export_statement' extract.ts` → zero). Without it
      every exported-but-not-yet-imported public symbol reports as dead, which is Risk
      Register rank 4 arriving through the verb rather than around it. So `dead` prints the
      four sources with a per-source status (`read` / `empty` / `unavailable` + reason) and
      then REFUSES — exit 1, empty list — unless the caller supplies the missing source
      (`--entry-points <file>`) or states the gap explicitly
      (`--accept-missing-exports`). Fail-closed in the shape `selectionVerdict`
      (`src/scripts/_lib/regression_neighbourhood.ts`) already uses here: no option object
      relaxes it, only a visible command line. Both branches are fixtured, and the CLI
      cases assert the EXIT CODE — a refusal that exited 0 would read to a CI step as an
      empty dead list, which is the false negative it exists to stop.

      `routes` reads `empty`, not `unavailable`: this repository has no route table, and an
      absent route table is a fact about the tree rather than a gap in the graph.

      END-TO-END THROUGH THE CLI, on a git fixture at 2026-09-08:
        · `impact --diff HEAD~1` → exit 0 · 4 dependents · 1 test file · 6 producing edges
          · `accepted resolved_via: import-specifier 4 · same-file 1 · test-import 1`
        · `tests-for handle` → exit 0 · `tests (1): tests/service.test.ts` ·
          `accepted resolved_via: test-import 1`
        · `untested --diff HEAD~1` → exit 0 · `tested (1) · untested (2)`
        · `dead` → exit 1, refusal, no list · `dead --accept-missing-exports` → exit 0,
          6 symbols · `dead --entry-points <file>` → exit 0, 5 symbols, 1 excluded

      FIXED, found while wiring: `graphState` reported `absent` for a verb invoked with an
      explicit `--graph <path>` — the state of a cache nobody asked about, printed beside
      an answer that had just come from a different file. `graphState(root, nativeCache?)`
      now takes the graph the verb is actually reading. Also moved `GraphState` /
      `graphState` from `hooks/code_graph_context_hook.ts` into `code_graph/detect.ts`,
      re-exported from the hook so no importer changed: an engine module importing a hook
      module to learn the token would invert exactly the dependency direction D9 measures.
      -->
- [x] **3.4 `regression_neighbourhood` reads this graph** via `impact --diff`; the selected
      regressions and the producing edges enter the verdict record. Retires the
      substitute-graph section at `regression_neighbourhood.ts:15-26`.
      verify: the fixture that proves a neighbour regression is caught runs on the native
      graph; `grep -c 'no index to select against' src/scripts/_lib/regression_neighbourhood.ts`
      is 0.

      <!-- verified 2026-09-08.

      BOTH VERIFY CLAUSES:
        · `grep -c 'no index to select against' src/scripts/_lib/regression_neighbourhood.ts`
          → **0**.
        · THE FIXTURE RUNS ON THE NATIVE GRAPH. `selectRegressionsFromCode` neighbours a
          candidate by SYMBOL relations over a graph built by `buildFromRepo` from a real
          TS tree — subject ← direct caller ← caller-of-the-caller — using the same
          reverse walk `impact --diff` exposes. `reg-neighbour` guards `src/mid.ts#mid`,
          a surface the diff never touches, and the fixture feeds the FULL registry's
          outcomes to `catchReport`: `caught: ['reg-neighbour'] · missed: []`.
          FALSIFIABLE ARM, and it is the half that makes the first one mean anything: the
          same call at depth 0 — the diff-scoped selector this step replaces — yields
          `caught: [] · missed: ['reg-neighbour']`.
        tests/scripts/regression_neighbourhood.test.ts → 20 passed (13 pre-existing on the
        artefact path, all still green, plus 7 new).

      THE PRODUCING EDGES ENTER THE VERDICT RECORD. `NeighbourhoodReport` gains three
      fields: `producing_edges` (rendered, sorted, so two runs over one graph produce
      byte-identical records), `rejected_via` (the histogram of edges the walk refused),
      and `graph: 'artefact' | 'code'`. The third is the one that keeps the retired
      substitution retired: a verdict record can no longer be read as a claim about the
      other surface, which is the failure the deleted docstring section described in prose.

      THE MECHANISM AXIS IS WHAT MAKES THIS DIFFERENT FROM THE ARTEFACT PATH, and it has
      its own case: a bare PHP `helper()` with no `use` resolves through the repo-wide
      same-name table, so it is a REAL caller the graph cannot vouch for. Selecting a
      regression on it would be selecting on a guess. The fixture asserts
      `selected: [] · skipped: ['reg-php-caller'] · rejected_via: 'name-lookup 1'` — the
      artefact graph has no axis on which that distinction can even be expressed.

      BOTH SURFACES KEPT, and this is a deliberate reading of "retires the
      substitute-graph section" rather than a hedge. What was retired is the
      SUBSTITUTION — the module no longer reads the artefact graph *because the code graph
      does not resolve*, which was the whole content of the deleted section. It still
      reads the artefact graph for artefact candidates, because for a rule or skill
      rewrite `supersedes` / `routes_to` / pack membership is the coupling a change
      breaks and the code graph does not model it at all. Deleting that path would have
      removed a capability this roadmap never proposed to remove. The docstring now states
      the two surfaces, which candidate class each serves, and that neither is a fallback
      for the other; `selectionVerdict` names the graph it refused against, so a code-path
      refusal no longer points a reader at the wrong surface.

      `impact` gained `reached: ReachedNode[]` — the same set as `dependents`, carrying
      hop depth and the reaching relation. Two shapes for one set on purpose: `dependents`
      is what a human reads and what the goldens pin, while a consumer that must explain
      WHY a node is in the set needs the depth, and reconstructing it by re-running the
      walk at increasing depths would be the same BFS N times. -->

## Phase 4 — Reaches the agent

- [x] **4.1 MCP tools** `graph_impact`, `graph_tests_for`, `graph_dead`, `graph_query`,
      `graph_path` on the existing server, same telemetry line as the other 31.
      verify: catalogue count **36**; `telemetry:report` shows `tools/call` rows for them in
      a fixture session.

      <!-- verified 2026-09-08. tests/scripts/mcp_graph_tools.test.ts → 8 passed.

      CATALOGUE COUNT 36: `npm run build:mcp-catalog` → "wrote
      src/scripts/mcp_server/consumer_tool_catalog.json (36 tool(s))", and the test asserts
      `tools` has length 36 with all five present AND
      `implemented_on: ['stdio']` — the field that separates a real tool from a
      documentation stub, without which a graph tool could be in the count and unreachable
      on the wire. `audit_mcp_tools` regenerated `docs/contracts/mcp-tool-inventory.md` at
      36.

      `tools/call` ROWS IN A FIXTURE SESSION: the test dispatches all five through the real
      `ToolCache.dispatch` against a throwaway consumer root holding a built graph, then
      reads `agents/runtime/mcp-telemetry/calls.jsonl` and asserts one row per tool with
      `outcome: 'implemented'` (never `'stub'` — that field is what a report groups on, so
      a stub row would silently under-count real usage). No per-tool telemetry code exists
      or was written: `dispatch` records centrally, so "the same telemetry line as the other
      31" follows from being in `ALLOWLIST` at all, which is stronger than a per-tool emit
      because it cannot be forgotten.

      SUBSTITUTION, NAMED RATHER THAN SILENT: the step says `telemetry:report`, which is the
      ARTEFACT-ENGAGEMENT report over a different log. A `tools/call` lands in
      `agents/runtime/mcp-telemetry/calls.jsonl`. The rows the step asks for are the ones
      asserted, in the file that holds them.

      ANSWERS, not just registrations — the same fixture session:
        · `graph_query` → status ok, `staleness: fresh`
        · `graph_tests_for` → `tests: ['tests/service.test.ts']`
        · `graph_path` → a chain reaching `src/service.ts#handle`
        · `graph_dead` → `refusal` set, `dead: []`; with `accept_missing_exports: true` →
          `refusal: null` and a real list. Over the wire the refusal has to be a STATUS a
          caller can branch on rather than the exit code the CLI uses.
        · `graph_impact` → `status: 'error'`, "cannot resolve rev" (no git repo in the rig),
          which is the point: it says so rather than reporting an empty impact set.
        · a root with no graph → `status: 'unavailable'`, `staleness: 'absent'`
        · `entry_points: '../outside.txt'` → "path escapes consumer_root"

      `graph_impact` DECLARES `side_effect: 'shell'`; the other four declare `'ro'`. It
      resolves its `diff` argument by running `git diff --name-only`. That subprocess is
      read-only in effect and the enum has no value saying so — between understating the
      mechanism and naming it, naming it is the only choice a capability enum exists to
      support.

      REGISTERED FROM `mcp_server/graph_tools.ts`, NOT INLINE, and the reason is a gate:
      `tools.ts` sits ~500 lines past the 1500-line ceiling `check_source_size_budget`
      enforces as a shrink-only ratchet, so five records with their schemas would have cost
      ~250 units of excess there and cost nothing in a file under the cap. `tools.ts`
      spreads them into `ALLOWLIST` in two lines, and those two were PAID FOR rather than
      baselined: `_strip` / `_resolvePath` moved out to `mcp_server/path_util.ts`, taking
      tools.ts 2,025 → 2,013. Net −10 for a branch that added a feature; baseline lowered
      17,973 → 17,963 with the reading recorded at
      `src/config/gate-violation-baselines.json`.

      THE STANDING COST ROSE, AND IS RECORDED AS A RISE. `agents/evidence/metrics/
      mcp-tool-standing-cost.jsonl` gains a 2026-09-08 row: 20 → 25 tools, 1,791 → 2,236
      description tokens, 3,886 → 4,876 payload tokens (+25 %), the five measuring 446 /
      993 in isolation. Appended rather than edited in place, because the 2026-08-23 row is
      a true reading of a tree that existed and overwriting it would delete the only record
      of what the five cost. The assertions in `mcp_lite_tools.test.ts` were re-pinned to
      the new figures rather than widened — the row exists so "registering it is free" can
      never be asserted again, and a wider band would let the next five arrive unmeasured.
      A new assertion pins the surface below the ~20,000-token Tool Search deferral
      threshold, because `loads_upfront: true` is a claim and a surface that crossed it
      would make every figure above a statement about a cost the host no longer pays.

      DOWNSTREAM, swept in the same change: `mcp_server_tools.test.ts` (20 → 25 tool set),
      `build_mcp_catalog.test.ts` (the install-hint assertion, per 4.2),
      `docs/contracts/mcp-tool-inventory.md` and `src/cli/registry.ts`'s `code-graph`
      synopsis. `tests/scripts/*mcp*` → 337 passed / 2 skipped. -->
- [x] **4.2 Correct the install hint** at `consumer_tool_catalog.json:4` to the pinned entry
      the MCP-bridge work wrote.
      verify: doc-drift check green; `grep -c 'npx -y' src/scripts/mcp_server/consumer_tool_catalog.json`
      is 0.

      <!-- verified 2026-09-08. `install_hint_stdio` is now `agent-config mcp-server`.
        · `grep -c 'npx -y' src/scripts/mcp_server/consumer_tool_catalog.json` → **0**
        · `check_mcp_doc_drift` → "✅ 4 documented snippet(s) match the installer entry"

      NOT THE FORM THE STEP'S OWN WORDS POINT AT, and this is an AI council decision
      (2026-09-08, 2/2 convergent — anthropic + openai, round 2 Fork 3 option 5) rather than
      a judgement call. The step says "the pinned entry the MCP-bridge work wrote". That
      entry is `docs/mcp-server.md:97`: `["-y", "@event4u/agent-config@<version>",
      "mcp-server"]`, with the pin rationale at `docs/mcp-server.md:82`. It cannot be the
      answer, because the step's OWN verify requires the literal `npx -y` to be absent from
      this file. And the obvious repair — drop the `-y` — makes `npx` PROMPT before
      installing a package that is not present, which in a non-interactive MCP client start
      is a hang rather than a prompt. So every `npx` shape is out: the un-prompted one is
      forbidden by the verify and the prompted one hangs.

      What is left is the installed binary, which is what the setup docs lead with anyway
      (`docs/setup/mcp-client-config.md:35`; `docs/getting-started-local-stdio.md:9` calls
      it "the turnkey path … one command"). It resolves no dist-tag at all, because it IS
      whatever the consumer installed — which satisfies the pin rationale more directly than
      a pinned `npx` would. Its cost is stated rather than hidden: the catalog description
      now says the field "assumes `agent-config` is on PATH", asserted by fixture. The bin
      name is derived from `package.json`'s own `name`, so a package rename moves the hint
      with it.

      RECORDED CONFLICT, per the same verdict and named in the generator's own comment: this
      step's verify and the documentation's pinned form contradict each other directly — the
      test forbids the string the docs recommend. That is a defect in one of the two, it is
      not resolved here, and a later change should decide which. Leaving it unnamed would
      have been the silent normalisation the council specifically declined. -->
- [x] **4.3 Skill description** names the three verbs as *cheaper* paths; no ordering claim is
      added or removed.
      verify: description length ≤ 200 chars (`src/scripts/schemas/skill.schema.json:28`);
      `src/skills/code-intelligence/SKILL.md:164` unchanged.

      <!-- verified 2026-09-08. New description, 198 chars against the 200 hard line:
        "Route codebase-structure questions (who calls X, where used, change-impact) to an
         existing code-graph first: impact, tests-for, dead are cheaper, never more precise;
         grep routine. Also 'call graph'."
      `validate_frontmatter` → 450 artefacts, 0 failing, 0 warnings.

      LINE 164 IS BYTE-UNCHANGED — `sed -n '164p'` still returns
      `**No class is graph-first.** Query the index first because an index that already`.
      That constraint shaped where the accompanying documentation went, and the shaping is
      worth recording because it looks arbitrary otherwise: the four new verbs were first
      documented inside § Procedure (line ~52), which MOVED line 164 to a benchmark table
      row and broke the verify. The section was relocated below the benchmark sections
      instead, so the ordering sentence K5 protects stays byte-fixed. The trade-off is
      stated in the section itself rather than left for a reader to wonder about.

      NO ORDERING CLAIM ADDED OR REMOVED, on both surfaces:
        · The description keeps "to an existing code-graph first" verbatim — including the
          word "existing", whose removal would have STRENGTHENED the claim from "ask an
          index you already have" to "go build one first". What was traded away is
          `what imports` from the example list and the words "stays" and "is this", which
          carry no ordering.
        · The new body section closes with an explicit statement that these verbs are
          cheaper than reconstructing the relationship by hand, that nothing on the page
          says they beat grep, and that § Measured twice still governs that question.
      `skill_linter` → PASS, no issues. `task sync` + `task generate-tools` regenerated
      `dist/agent-src/skills/code-intelligence/SKILL.md` and `src/domains/meta/README.md`. -->

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

## Blockers

### blocker: pack-size-budget-preexisting-overage

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap. Recorded because Phase 0.1 adds payload to a gate
  that is **already** failing, and a step that makes a red gate redder should say so rather
  than let the next reader assume it caused it.
- **Class:** 3
- **Recommendation:** raise `budgets.packed_size_mb.max` to a re-measured figure in a
  dedicated change that also re-pins `last_measured`. The cap is a maintainer-owned
  ratchet with `review_by: 2027-07-31`, so an execution run may not move it — but leaving
  it below the tree's actual size means the gate reports the same failure on every branch
  and stops discriminating.
- **If you do nothing:** `check_pack_size` stays red in `task ci` and
  `.github/workflows/consistency.yml` for every branch, this one included. The gate's
  binary-payload half still works and still has teeth; only the size axis is dead.
- **What to do:**
  1. Reproduce the baseline: `npm pack --dry-run --json --ignore-scripts` on `origin/main`
     with no local edits. Measured 2026-09-07 at base `04a9af594`: **9.8216 MB** against
     `budgets.packed_size_mb.max = 9.1` in `src/config/pack-size-budget.json`.
     Independently reproduced the same day in a second worktree off the same base at
     **9.821 MB**.
  2. Decide one: (a) re-measure and raise `max` + `last_measured` together, recording the
     tree the figures came from as every other entry in that file does; (b) shrink the
     payload back under 9.1; or (c) judge the unbuilt cap obsolete and gate only the
     built surface, which `check_pack_size.ts:466-497` already implements for built
     payloads against `built_surface_measurement_*`.
  3. Whichever is chosen, do it in a change that is *only* that — a budget move buried in
     a feature branch is how the 2026-08-24 cap trip became a merge artifact nobody could
     attribute.
- **Resolved when:** `./scripts-run src/scripts/check_pack_size` exits 0 on `origin/main`
  with no local edits, and `pack-size-budget.json` records the tree its figures were
  measured in.

<!-- This roadmap's own contribution to the number, measured rather than estimated:
9,821,600 B → 10,195,522 B, i.e. +373,922 B. The overage is 721,600 B before this branch
exists, so the gate was already red by ~1.9x this step's addition. -->

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

- [x] AC-0 ADR-259 accepted; `package.json` carries the parser pair in `dependencies`.
      <!-- 2026-09-07, AS AMENDED. `web-tree-sitter@0.24.7` is in `dependencies`;
      `tree-sitter-wasms` deliberately is NOT, because the three loadable grammars are
      vendored instead and depending on the pack would deliver all 36 (49 MiB) — the
      outcome ADR-259's own Alternatives rejects. The criterion's INTENT (a consumer
      receives the engine) is met and verified end-to-end by AC-1; the amendment is
      recorded at ADR-259 § "Amendment — 2026-09-07 · vendored-wired-set". -->
- [x] AC-1 A fresh consumer install builds a graph with no manual step (1.1).
      <!-- 2026-09-07: real tarball, throwaway install, `code-graph build --root .` exit 0
      on a PHP+TS fixture — "4 files · 12 nodes · 15 edges, languages: php, typescript".
      `tree-sitter-wasms` absent from the consumer's node_modules. -->
- [x] AC-2 The nudge hook and its flag are gone; `code_graph_context` is in the manifest with
      per-host `enforced_by` resolved from the platform table (1.2).
      <!-- 2026-09-07: `grep -c code_graph_nudge` on the manifest (yaml and compiled json)
      → 0; `hooks.code_graph.enabled` → 0 in both settings templates;
      check_enforcement_coverage ratchet holds. -->
- [x] AC-3 Queries above 50k edges read SQLite through a per-node/per-edge API and parse no
      JSON (2.1); every edge carries `resolved_via` and `provider` (2.2).
      <!-- 2026-09-07: traced — zero `JSON.parse` calls on a 60k-edge `affected`, with the
      canonical JSON chmod 000 for the duration; 4.9 ms / 190.7 MB RSS against 9,809.6 ms /
      349.0 MB on the blob path. Both fields are REQUIRED on `CodeEdge`, so the type system
      enforces the second half at every construction site. -->
- [ ] AC-4 `impact --diff`, `tests-for`, `dead` exist with golden fixtures;
      `regression_neighbourhood` reads the native graph (3.x).
      <!-- NOT STARTED 2026-09-07. Phase 3 is untouched. Scoped here so the next run does
      not re-derive it: the three verbs share ONE verify block, so none can be ticked
      alone, and 3.2 additionally needs a new `tests` RELATION (test file → subject via
      import), which is a `Relation` union change plus extractor work — i.e. a fourth
      schema bump. 3.3 needs the declared entry-point sources enumerated (routes, exports,
      `src/cli/registry.ts`, the hook manifest) or it will report entry points as dead,
      which the Risk Register ranks fourth. The `resolved_via` axis 3.1 filters on
      (`not in {name-lookup, dynamic}`) now exists and is populated, so the input Phase 3
      needs is in place. -->
- [ ] AC-5 Five graph tools are in the MCP catalogue, taking it to 36, and emit telemetry;
      the install hint is pinned (4.x).
      <!-- NOT STARTED 2026-09-07. Phase 4 is untouched. 4.2 is independent of 4.1 and
      cheap — `consumer_tool_catalog.json:4` still reads `npx -y`. -->
- [ ] AC-6 The v2 benchmark rerun after all phases is byte-identical on every class — this
      roadmap moved delivery, not measurement.
      <!-- HOLDING, not yet dischargeable: "after all phases" cannot be evaluated while
      Phases 3 and 4 are open. Measured twice so far and byte-identical BOTH times, after
      2.2 and again after 2.3, against `code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md`:
      callers R 1/1 +0 P 0.611/0.667 · transitive-impact R 0.611/0.611 +0 P 1/1 ·
      path-between R 0.917/1 +8.3 P 0.722/1 · references R 1/1 +0 P 0.722/1 · macro grep
      P 0.764 R 0.882 · macro graph P 0.917 R 0.903. Zero of four classes met the +10 pp
      bar; every class TIE. -->
