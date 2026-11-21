---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
relates:
  - slug: road-to-ui-fixes-that-measure-first
    relation: disjoint
    note: "Same-retro sibling (measure 15). Its `ui_reference.ts` / `ui:reference` is the one scanner for Storybook, UI libraries, handovers and measurement channels; this file's `ui-stack` reader calls `agent-config ui:reference --json` when the verb exists instead of scanning a second time, and owns only rendering the topic file."
  - slug: road-to-done-claims-with-read-exit-codes
    relation: disjoint
    note: "Same-retro sibling (measure 1). Its `live-surfaces.json` reachability map and this file's `testing-env` topic both read compose files and Taskfile targets; that file owns the map the verify skill reads, this one owns the path-triggered knowledge text."
  - slug: road-to-a-map-that-holds-on-the-real-repo
    relation: disjoint
    note: "Owns map correctness (scope, lanes, committed-map lifecycle, the map bench). This file needs no map: the generator reads agents/map/ facts only when a map already exists (2.3) and never builds one."
  - slug: road-to-a-map-that-knows-what-happened
    relation: extends
    note: "Its I.1 source registry gets one row for the new generated store (5.4); its K.2 feedback signals are read as one session-mining input when present (3.2). Its Stage D wait governs map and memory payloads, not repo-derived recipes (D4)."
  - slug: road-to-a-knowledge-atlas
    relation: disjoint
    note: "Parked; draws memory and knowledge sources on the Workbench page. Adds no store and no delivery path; nothing here draws a page."
  - slug: road-to-a-memory-each-worker-is-handed
    relation: extends
    note: "Parked; its 1.2 knowledge_refs slot in implementer templates is the fallback channel 4.4 uses if the subagent probe (4.3) shows host-native path loading does not reach subagents. Its 3.1 SubagentStart delivery stays its own."
  - slug: road-to-a-probe-that-cannot-report-a-false-green
    relation: disjoint
    note: "Archived; UI conformance probe on empty references. Lexical hit only."
  - slug: road-to-generated-artifact-conflict-drawdown
    relation: disjoint
    note: "Archived; untracking generated files in this repo to cut merge conflicts. 4.1 reads its outcome when deciding committed vs local-only, nothing more."
  - slug: road-to-global-user-memory
    relation: disjoint
    note: "Archived; the user-level memory layer. This file generates project knowledge, never user preferences."
  - slug: road-to-mcp-stdio-end-user-packaging
    relation: disjoint
    note: "Archived; stdio MCP packaging. Lexical hit only."
  - slug: road-to-per-workspace-license-policy
    relation: disjoint
    note: "Parked; license derivation per monorepo workspace. Lexical hit only."
  - slug: road-to-session-closeout-gated
    relation: disjoint
    note: "Stub; session-closeout residue needing external capabilities. Lexical hit only."
  - slug: road-to-skill-tiering-live-arm
    relation: disjoint
    note: "Stub; live arm for skill tiering. Lexical hit only."
  - slug: road-to-a-learning-pipeline-that-yields-lessons
    relation: disjoint
    note: "Same retro round, measure 13. It builds on this file (its 3.2 adds a lesson layer to 3.4's merge, its 3.3 triggers 5.1's refresh, its 5.1a re-runs 4.3's probe); this file owns the store, the projection and the probe and waits on nothing there."
  - slug: road-to-honest-graph-freshness
    relation: disjoint
    note: "Same retro round, measure 11: the code-graph freshness string. This file builds no graph and reads none of its state."
# scanned: roadmap:context --roadmap road-to-repo-knowledge-generated-not-written, 7 sibling hits; rows 1-4 owner-named neighbours, last 2 same-round siblings found by reading agents/roadmaps/
estate_growth_exempt: "Created on 2026-11-21 at the owner's request to plan and execute every measure of the session retro of the same day ('Lass uns alle Learnings einplanen und abarbeiten'); adds one active roadmap and one open blocker (b-transcript-consent) for measure 7. No existing roadmap owns generated per-repo knowledge (relates: block)."
estate_offset_exempt: "Same owner request of 2026-11-21; the neighbours keep their own scope — the two active map roadmaps own map output, later/road-to-a-knowledge-atlas owns the page, later/road-to-a-memory-each-worker-is-handed owns spawn delivery and is parked on a shadow-count entry condition this work must not wait for — so nothing is archived to offset this one. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
---
# Road to repo knowledge that is generated, not written

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions across six profiles and seven repositories; § 2 pattern G "knowledge
> gets lost", § 6 knowledge base, measure 7 of § 7) and the AI council round of the
> same day (members: anthropic and openai, one round, analysis mode). Both seats
> backed per-repo trap and test-environment recipes as the largest lever; both
> rejected an automatic graph build as unbacked by the map bench (2.8 M tokens with
> map against 290 k without, same correctness); openai asked to separate *existed /
> current / reached the acting agent / changed behaviour* and to verify that
> subagents use the recipes. The owner then reworked measure 7 the same day: no
> hand-maintained or owner-written context files — every piece of project knowledge
> is generated or refreshed by a command or hook from the repository, the sessions
> or the telemetry.

## Goal

In each of the seven repositories named in the retro (galawork-api, galawork-web,
javascript, elvau, agent-switch, azeroth-companion, agent-config), a command
generates the per-repo knowledge the retro found missing — known traps,
test/environment recipe, UI stack, domain map, cross-repo ownership — from repo
inspection, session mining and telemetry; the first generation and every refresh
happen without anyone typing a command or building a map; each file loads only
when a matching path is touched; a measured probe shows whether a subagent
receives it; and the retro's per-repo holes table, frozen as a fixture before any
code is written, is covered to the pre-registered threshold.

## Context

- **What the retro measured (not re-measured here).** Nothing creates a first map
  or graph: installer, session start and CI never call `build` or `map`;
  `/project:map` is `visibility: internal` and `suggestion.eligible: false`
  (`src/domains/engineering-base/project/map/command.md:5,11`), and the owner got
  "Unknown command" on 2026-10-23. galawork-web, javascript, elvau and
  azeroth-companion have no `agents/map/`. The knowledge commands that exist are
  internal and maintainer-workspace only: `/team-knowledge:bootstrap`
  (`src/domains/meta/team-knowledge/bootstrap/command.md:5,13-14`), `/context:create`
  (`src/domains/meta/context/create/command.md:5,14-15`), `/project:analyze`
  (`src/domains/engineering-base/project/analyze/command.md:5,13-14`).
- **Why the existing seeds do not satisfy the owner constraint.**
  `bootstrap_knowledge.ts` is deterministic but marks every inference
  `[HUMAN: verify]` and stages into `agents/.bootstrap-staging/` for a human review
  before anything lands (`src/scripts/bootstrap_knowledge.ts:11-17`) — a
  hand-curation step by design. `memory_recall_hook.ts` delivers from a
  "hand-authored table" (`src/scripts/hooks/memory_recall_hook.ts:20-21`) and is
  silent in consumers, which have no memory store. `mine_session.ts` requires
  `--confirm-transcript-access` per invocation (`src/scripts/mine_session.ts:22`),
  so it never runs unattended.
- **Learning settings that block the existing pipeline.** `memory.session_index:
  "off"` and `memory.learn_on_session_end: false` in the template
  (`src/config/agent-settings.template.yml:1144,1155`); `code_graph.consumer_index_paths: []`
  (`:750`). This roadmap does not flip them; the learning-pipeline diagnosis
  (retro measure 13), the freshness display (measure 11), the settings drift
  (measure 22) and the static-context diet (measure 17) are separate roadmaps of the
  same retro round.
- **The per-repo holes (retro § 6, the acceptance target).** galawork-api: worktree
  and test recipe (`.tmp/`, vendor, `.env`, `DUMP_DB_HOST`, ECS memory, locale),
  cross-repo ownership (API → web), cache-tag rule, `admin/dev`, domain map, Sentry
  login, contexts 900 commits old. galawork-web: UI stack (component library,
  Storybook), dev topology (webpack container, Node version), CI specifics, contexts
  copied from the API. javascript: no AGENTS.md, monorepo orientation, registry
  tokens, rebase-only. elvau: B2B domain rules, where private analyses live, inbox
  scope, plan ↔ code link. agent-switch: no AGENTS.md, `gui:dev`/`dist/`, the
  `claude` wrapper, v2/v3 backport, Windows paths, release race. azeroth-companion:
  owner workflow (main, in-game test before commit), German UI terms ↔ frames.
  agent-config: traps sheet, known-red on main, host-blocked operations, and
  the council CLI trap: `council:run` and `council:estimate` read their
  `<question>` argument as a file path (`src/scripts/_dispatch.bash:186-189`
  says `<question>`, its own examples at `:493-494` pass `prompt.txt`). The
  retro saw sessions pass question text, fail, and retry with a file several
  times.
- **Unverified here (taken from the retro's audits, not re-read in those repos):**
  the per-repo states above, the dispatcher summary path
  `agents/runtime/state/.dispatcher/*/summary.json` and its block counts, and the
  `agents/state/verify-before-complete/` record shape. Step 3.1 reads both shapes
  from a live repo before coding against them.
- **Static cost.** Every generated file is path-triggered only; the ~40 k static
  baseline the retro measured must not grow (AC-5).

## Phase 1 — Freeze the target before writing code

- [ ] **1.1 Freeze the holes table as a fixture with its threshold.** Write
      `tests/fixtures/repo-knowledge/holes-2026-11-21.json`: one atomic item per
      cell fragment of the Context table (repo, item id, expected topic, expected
      source class `repo | session | telemetry | none`), plus
      `"threshold": {"covered_min_share": 0.67, "silent_max": 0}` written in the
      same commit, before 2.1 exists. A loader test pins the item count and
      pins one named item, `agent-config/council-cli-file-path` (topic
      `known-traps`, source class `session`).
      verify: `npx vitest run tests/scripts/repo_knowledge_holes_fixture.test.ts` -> 0
- [ ] **1.2 Seven shape fixtures, red first.** Minimal repos under
      `tests/fixtures/repo-knowledge/shapes/` reproducing each repo's shape: a PHP app
      with docker-compose, `.env.example` and a `.tmp/` worktree convention; a React
      app with a Storybook config and a webpack dev container; a pnpm/npm workspaces
      monorepo with `.npmrc`; a plan-docs repo (`agents/plan/*.md` beside code); a CLI
      with a GUI dev script and a release workflow; a Lua addon with locale files; a
      Taskfile-driven TypeScript package. `tests/scripts/repo_knowledge_generate.test.ts`
      asserts the five topics per shape and fails today (no generator).
      verify: `npx vitest run tests/scripts/repo_knowledge_generate.test.ts` -> 1

## Phase 2 — Repo-inspection layer (no map, no graph)

- [ ] **2.1 Readers with evidence.** `src/scripts/repo_knowledge/inspect.ts` reads
      manifests (composer, package, workspaces), Taskfile/Makefile/package and composer
      scripts, docker-compose services and memory limits, `.env.example` and `.npmrc`
      **key names only**, `.nvmrc`/engines, CI workflow job names and run steps,
      `.gitattributes` and `.gitconfig` merge settings, Storybook and UI-library
      dependencies, locale files. Every fact carries `path:line`. A test plants a value
      shaped like a token in `.env.example` and `.npmrc` and asserts it never appears
      in output (positive control: the key name does appear).
      verify: `npx vitest run tests/scripts/repo_knowledge_inspect.test.ts` -> 0
- [ ] **2.2 Renderer with machine header and path triggers.** Topics `known-traps`,
      `testing-env`, `ui-stack`, `domain-map`, `cross-repo` render to one file each;
      header: generator, commit, input digest, `paths:` globs derived from the
      evidence paths (e.g. tests, compose files, Taskfile for `testing-env`). An item
      with no machine source renders as a `gap:` line naming the missing source, never
      as prose. Cap ≤ 2,048 B per topic file, enforced by test.
      verify: `npx vitest run tests/scripts/repo_knowledge_render.test.ts` -> 0
- [ ] **2.3 Domain map from the tree, map facts when present.** Domains from module
      directories, route files and migrations; plan docs linked to code by shared
      identifiers (the elvau shape); duplicated context files across sibling repos
      detected by digest (the galawork-web shape) and reported; existing hand-written
      contexts reported with "commits since last touch", never edited. When
      `agents/map/` exists, its domain facts are read; absent, nothing is built.
      verify: `npx vitest run tests/scripts/repo_knowledge_domain_map.test.ts` -> 0
- [ ] **2.4 A hand edit is detected and overwritten.** The header digest covers the
      body; `status` reports `hand-edited` on mismatch and the next `generate`
      rewrites the file, so no human-maintained content survives a refresh. Test
      edits a generated fixture file and asserts both outcomes.
      verify: `npx vitest run tests/scripts/repo_knowledge_hand_edit.test.ts` -> 0
- [ ] **2.5 One visible CLI verb.** `agent-config repo-knowledge generate [--out DIR]
      [--json] | status [--json] | score --holes FILE` registered in
      `src/scripts/_dispatch.bash` (help block near line 264, case block near line
      1748), not workspace-gated. 1.2's test turns green except the session and
      telemetry items.
      verify: `npx vitest run tests/scripts/repo_knowledge_generate.test.ts tests/scripts/repo_knowledge_cli.test.ts` -> 0

## Phase 3 — Session-mining and telemetry layers

- [ ] **3.1 Telemetry reader.** Read one live dispatcher summary and one
      verify-before-complete record first and pin their shapes as fixtures (Context
      marks both unverified). Then derive: host-blocked operations (concern, command
      shape, count), verify commands that failed then passed, and project verify
      commands actually used. Counts and command shapes only, no free text.
      verify: `npx vitest run tests/scripts/repo_knowledge_telemetry.test.ts` -> 0
- [ ] **3.2 Session reader.** From the chat-history log or host transcripts (the
      sources `mine_session.ts` already resolves, its redaction reused): failed →
      succeeded command pairs in one session become `known-traps` entries with
      recurrence count; sessions that edit two repositories become `cross-repo`
      ownership edges; repeated owner corrections on the same path become trap
      candidates (≥ 2 distinct sessions); K.2 feedback signals of the sibling are read
      when present. Fixture transcripts only in tests. One fixture is the
      council trap: `agent-config council:run "<question text>" ...` fails,
      and a later `agent-config council:run <file>.txt ...` in the same session
      succeeds. Seen in two distinct sessions, it renders one `known-traps`
      entry with recurrence 2 and `session:<id>#<turn>` evidence, and the
      entry's command shape names the file-path form.
      verify: `npx vitest run tests/scripts/repo_knowledge_sessions.test.ts` -> 0
- [ ] **3.3 Known-red on main.** `gh run list --branch <default> --status failure`
      plus job names → `known-traps` "red on main since <sha>", cached with a 6 h TTL;
      offline degrades to a `gap:` line with the reason. Test stubs `gh`.
      verify: `npx vitest run tests/scripts/repo_knowledge_known_red.test.ts` -> 0
- [ ] **3.4 Merge and rank.** Layers merge per topic, deduped by normalised command
      shape, ranked by recurrence × recency, cut to the 2.2 cap; every entry keeps its
      evidence (`path:line`, `session:<id>#<turn>`, `telemetry:<concern>`).
      verify: `npx vitest run tests/scripts/repo_knowledge_merge.test.ts` -> 0

## Phase 4 — Delivery: path-triggered, measured at the subagent

- [ ] **4.1 Council: where the files live and how hosts load them.** First action:
      `agent-config council:status`, then a council round on two contested choices —
      committed under `agents/knowledge/generated/` vs local-only (gitignored or under
      the user's home keyed by repo id), and the host projection (Claude path-scoped
      `.claude/rules/` entries, Cursor glob rules, AGENTS.md pointer for the rest).
      Inputs: 2.2's header, the archived conflict-drawdown outcome, D2. Verdict
      recorded as a `## Decisions` row.
      verify: `grep -cE '^\| D5 ' agents/roadmaps/road-to-repo-knowledge-generated-not-written.md` -> /^1$/
- [ ] **4.2 Project per the verdict, static baseline unchanged.** Implement the 4.1
      projection. On the TypeScript-package shape fixture,
      `./scripts-run src/scripts/audit_initial_context` before and after generation
      reports the same session-start bytes; touching a `paths:`-matched file loads the
      topic. Positive control: an unscoped copy raises the bytes.
      verify: `npx vitest run tests/scripts/repo_knowledge_projection.test.ts` -> 0
- [ ] **4.3 Subagent probe.** In a scratch copy of a shape fixture, a generated
      `testing-env` file carries a canary token; a headless host run spawns one
      subagent that reads a `paths:`-matched file and reports the canary or "absent".
      Record parent and subagent outcomes in the probe's JSON output; the run is the
      measurement, whatever it shows.
      verify: `./scripts-run src/scripts/repo_knowledge/subagent_probe --json` -> /"subagent":"(present|absent)"/
- [ ] **4.4 Close the gap the probe found.** If 4.3 reads `absent`: hand the topic
      pointers matching the spawn's paths to the `{{knowledge_refs}}` slot through
      `composeSpawnBrief` (`src/scripts/_lib/subagent_spawn.ts:97`) and re-run 4.3 to
      `present`. If `present`: add the probe as a regression test and change nothing
      else.
      verify: `./scripts-run src/scripts/repo_knowledge/subagent_probe --json` -> /"subagent":"present"/

## Phase 5 — Automatic first generation and refresh

- [ ] **5.1 Stale check on the session-register slot.** Extend the session_start
      branch of `src/scripts/session_register_hook.ts` (the retro probe rides it,
      `:942-949`) — no new concern. Inputs digest or HEAD differ from the header, or
      no generated files exist → detached single-flight `repo-knowledge generate`
      (repo and telemetry layers), budget 30 s. Every run writes
      `agents/runtime/state/repo-knowledge/last.json` with outcome and reason,
      including `skipped: <reason>`. `check_hook_bundle_composition` runs before and
      after.
      verify: `npx vitest run tests/scripts/repo_knowledge_refresh_hook.test.ts` -> 0
- [ ] **5.2 First generation needs no command and no map.** A shape fixture with no
      `agents/map/` and no generated files gets all five topics after one simulated
      session_start; `agents/map/` is still absent afterwards.
      verify: `npx vitest run tests/scripts/repo_knowledge_first_run.test.ts` -> 0
- [ ] **5.3 Session layer in the automatic refresh.** Behind the
      `knowledge.generate.session_mining` setting (default `off`, Class B); the manual
      verb keeps `--confirm-transcript-access`. On: the refresh includes 3.2.
      <!-- blocked-by: b-transcript-consent | asked: no — authored by a non-interactive workflow subagent; the question goes to the owner with this roadmap -->
      verify: `npx vitest run tests/scripts/repo_knowledge_session_setting.test.ts` -> 0
- [ ] **5.4 Register the store.** One row in `src/config/source-registry.json` (name,
      path, writer `repo-knowledge`, readers, privacy class, owner `project`, delete
      path `agent-config repo-knowledge clean`).
      verify: `./scripts-run src/scripts/check_source_registry` -> 0

## Phase 6 — Acceptance run on the seven repositories

- [ ] **6.1 Score the real repos, read-only.** For each of the seven local checkouts,
      `agent-config repo-knowledge generate --out <scratchpad>/<repo> --json` (no write
      into the repo), then `repo-knowledge score --holes
      tests/fixtures/repo-knowledge/holes-2026-11-21.json` writes the generated report
      `agents/evidence/analysis/repo-knowledge-coverage-2026-11.md`.
      verify: `agent-config repo-knowledge score --holes tests/fixtures/repo-knowledge/holes-2026-11-21.json --json` -> /"silent":0/
- [ ] **6.2 Close uncovered items at the reader, never by hand.** For each item below
      threshold: add the missing reader to 2.1, 3.1 or 3.2 with a fixture test, or mark
      it `gap: no machine source` in the generator's gap table with the reason; re-run
      6.1 until `covered_share` ≥ 0.67.
      verify: `agent-config repo-knowledge score --holes tests/fixtures/repo-knowledge/holes-2026-11-21.json --json` -> /"meets_threshold":true/

- [ ] **6.3 The council trap is derived from sessions, not typed.** Run 6.1
      for agent-config with the session layer on (manual verb with
      `--confirm-transcript-access`, so it does not wait on
      `b-transcript-consent`). The generated `known-traps` file must carry
      the council file-path trap with `session:` evidence, and the score must
      read the fixture item `agent-config/council-cli-file-path` as
      `covered`. If the sessions alone do not surface it, the session reader
      gets the missing pairing rule plus a fixture case in 3.2's test. Nobody
      adds the line by hand, and it is never marked `gap:`.
      verify: `agent-config repo-knowledge score --holes tests/fixtures/repo-knowledge/holes-2026-11-21.json --json` -> /"agent-config\/council-cli-file-path":"covered"/

<!-- Release holds — none. resequenced: the refresh hook (Phase 5) lands only after
     the generator, its projection and its static-cost test (Phases 2-4), so no
     intermediate state injects unscoped or unbounded content; every earlier phase
     adds code no hook or host calls yet. -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Project knowledge is generated or refreshed by a command or hook from repo, sessions or telemetry; no hand-maintained or owner-written context file, and no human review gate before a generated file is used | owner rework of retro measure 7, 2026-11-21 | the owner reopens hand curation |
| D2 | contested-technical | council:2026-11-21 | Generation never builds a map or graph; it reads `agents/map/` only when present | both seats: graph auto-build not backed by the map bench (2.8 M vs 290 k tokens, same correctness) | the map bench decision rule of `road-to-a-map-that-holds-on-the-real-repo` 5.6 records a gain |
| D3 | reversible-technical | evidence | The stale check rides the session_start branch of `session_register_hook.ts`, no new hook concern | `session_register_hook.ts:942-949`: the retro probe rides that slot because the concern count is ratcheted | hook-bundle headroom admits a concern of its own |
| D4 | reversible-technical | agent | The sibling's P-3 / Stage D wait does not bind here: it governs map lanes and memory payloads, this file delivers repo-derived recipes through host path scoping | mechanism differs (map payload vs generated path-scoped files) | the generated files start carrying map payload |

## Blockers

### blocker: b-transcript-consent
- **Status:** open
- **Owner:** owner
- **Routed:** pending — authored inside a non-interactive workflow subagent that has no authority to start a council round; the next council pass routes it (privacy-floor row of `decision-revisit-gate` is expected to escalate)
- **Blocks:** Phase 5 — Automatic first generation and refresh (step 5.3 only)
- **Question:** may the automatic refresh read this machine's session transcripts without a per-run confirmation?
- **Class:** 2
- **Recommendation:** set `knowledge.generate.session_mining: on` in the user-global settings: traps and cross-repo ownership are mostly session-derived, and output stays redacted, counts and command shapes only.
- **If you do nothing:** the automatic refresh produces repo and telemetry knowledge only; session-derived traps appear only when someone runs `agent-config repo-knowledge generate --confirm-transcript-access`.
- **What to do:**
  1. Run `agent-config settings:set knowledge.generate.session_mining on --source manual` (writes the global file; `off` declines); reversible with the same command.
  2. Expected: the next session_start writes `agents/runtime/state/repo-knowledge/last.json` with `"layers":["repo","telemetry","session"]`.
- **Resolved when:** `agent-config settings:get knowledge.generate.session_mining` prints `on` or `off`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A secret reaches a generated file | product | `.env`, `.npmrc` registry tokens or a session line carrying a credential is rendered into a file that may be committed | Readers take key names only; session text goes through `mine_session` redaction; planted-token tests with a positive control | Phase 2 — Repo-inspection layer (no map, no graph) |
| 2 | Generated knowledge exists but never reaches the acting agent | product | Path loading misses the subagent, the gap the openai seat named | 4.3 measures it on a real host run; 4.4 wires the spawn slot if absent | Phase 4 — Delivery: path-triggered, measured at the subagent |
| 3 | Static context grows | implementation | A projection lands unscoped and every session pays for it | `audit_initial_context` before/after test with an unscoped positive control; 2,048 B cap per topic | Phase 4 — Delivery: path-triggered, measured at the subagent |
| 4 | Refresh costs session start | implementation | Generation on a large repo stalls the session_start slot | Detached single-flight, 30 s budget, outcome record; bundle check before and after | Phase 5 — Automatic first generation and refresh |
| 5 | Score passes on gap lines | implementation | Items marked `gap:` let the threshold read green while knowledge is missing | Threshold counts only `covered`; `gap:` counts as not covered; frozen before code in 1.1 | Phase 6 — Acceptance run on the seven repositories |
| 6 | A named acceptance item is satisfied by hand | product | Under pressure to turn 6.3 green, someone types the council trap into a generated file or into the generator's gap table | 2.4 overwrites hand edits and reports `hand-edited`; 6.3 requires `session:` evidence on the entry and forbids `gap:` for that item; the 3.2 fixture proves the derivation path | Phase 6 — Acceptance run on the seven repositories |

## Acceptance Criteria

- [ ] AC-1 — `repo-knowledge score` against the frozen holes fixture reports
      `silent: 0` and `covered_share` ≥ 0.67 across the seven repositories; every
      uncovered item carries a `gap:` reason.
- [ ] AC-2 — A shape fixture with no map and no generated files has all five topic
      files after one simulated session_start, and still has no `agents/map/`.
- [ ] AC-3 — A hand edit to a generated file is reported as `hand-edited` and gone
      after the next generation.
- [ ] AC-4 — No planted token value from `.env.example`, `.npmrc` or a fixture
      transcript appears in any generated file, while its key name does.
- [ ] AC-5 — Session-start bytes reported by `audit_initial_context` on a fixture
      are identical before and after generation.
- [ ] AC-6 — The subagent probe reads `present` on the Claude host.
- [ ] AC-7 — Every refresh run, including a skip, leaves an outcome with a reason in
      `agents/runtime/state/repo-knowledge/last.json`.
- [ ] AC-8 — The generated `known-traps` for agent-config carries the council
      CLI file-path trap with `session:` evidence, and the score reads the
      fixture item `agent-config/council-cli-file-path` as `covered` (6.3).
