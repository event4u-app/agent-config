---
complexity: structural
status: ready
tree_pin: 92397d6368
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-map-the-agent-checks-before-it-acts
    relation: extends
    note: "archived; reopened by erratum (step 3.4) — steps H12–H20 of that file are reopened here, the archive is not unarchived"
  - slug: road-to-a-map-across-systems-branches-and-time
    relation: extends
    note: "archived; reopened by erratum (step 3.4) — its AC-6, AC-8, AC-10, AC-12 fixtures are reused by Phases 1 and 7"
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "owns the comparator benchmark corpus; Phase 5 reads it, never edits it"
  - slug: road-to-map-views-from-the-handover
    relation: disjoint
    note: "sibling from the same inbox round; owns the Systems and branch views that wait on Phases 2, 5 and 6 here"
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: "sibling from the same inbox round; owns the bug, knowledge-source, answer and feedback lanes"
estate_offset_exempt: "Added, not woken: the owner asked this turn (inbox round 2026-10-bf) to process these roadmaps. The owner search for an existing active owner of this work came back empty — the two map roadmaps it reopens are archived, so neither can absorb it. Active count goes 2 -> 5 with the two siblings from the same round, which is the WIP cap of the owner directive of 2026-10-24, and stops there."
estate_growth_exempt: "Growth in this change is the three roadmaps of inbox round 2026-10-bf, which the owner asked this turn to process: active_roadmaps 2 -> 5 (the WIP cap), and the two blockers of this file (b-map-remeasure-spend, b-map-remeasure-budget) raise open_blockers. No existing roadmap owns the work: the two map roadmaps are archived."
---
# Road to a map that holds on the real repo

> **Source:** `agents/tmp.old/inbox-2026-10-bf/` — an owner proposal (v6, four
> rounds) with an audit of the committed map, re-verified against the tree at
> `92397d6368`. This file carries the plan's Stages A–F; the views, bug,
> knowledge, answer and feedback stages went to the two sibling roadmaps in
> `relates:`. Step IDs keep the plan's stage letters in brackets for traceability.

## Context

The map exists and every lane the owner asked for is built. On fixtures it
mostly works. On this repository it does not hold: it reports test fixtures as
product findings, writes edges into nothing, cannot confirm a whole lane, stores
PR titles in a committed file, and is redrawn into a dirty working tree after
every commit. The one measurement that exists cannot say whether the map helps,
and both map roadmaps were archived anyway.

Corrections from the re-verification at `92397d6368`, applied below:

- The committed map was built at `2efd5be1` and is now **24** commits behind
  HEAD while it reads `fresh` (the plan said 22 at its own pin).
- The PR-title leak (H13) is **live**: `agents/map/code/map.json` carries at least
  37 squash subjects with `(#NNNN)`. Phase 1 fixes it before anything else.
- `code-graph scope`, `code-graph lint` and `code-graph verify --all` are **new**
  verbs; none exists in `cli.ts` or `verify_cli` today.
- Step 5.7 (D.7) is partly built: `--max-usd` exists at
  `bench_map_task_set.ts:308` and the report records `sweep_cap_usd`; only the
  value and its record are missing.
- The "audit fixture" the plan names does not exist in the tree; steps 1.3, 6.1
  and AC-8/AC-9 build it.
- The H11 citation drifted: `map_area_payloads.ts:586` is now the start of
  `systemsPayload`/`USED_BY_CAP`; the defect stands.
- The H5 file count (139) and the H9 node count (0 of 68,460) were not recounted;
  the code shapes behind both still hold.

## Goal

On a lane build of this repository in CI, the map states no fixture as product,
writes no dangling edge, confirms every lane at ≥ 0.99, keeps no commit subject
in a committed file, and leaves the working tree clean after a commit; a roadmap
step closes only on evidence; and the bench can tell a map gain from a null
under a rule written before the run.

## Principles

- **P-1 Source, not truth.** Every fact has a witness of a declared kind;
  `confirm` re-reads it; counts are lower bounds.
- **P-2 One place, one structure.**
- **P-3 Base before breadth.** No new lane and no agent-facing injection until
  Phases 2–5 are closed. New view surfaces (7.6) wait for Phases 2 and 5.
- **P-4 Prove it or say it did not help.** A null closes a measurement step only
  with an owner decision that names the consequence.
- **P-5 The real repository is the test.** Fixture-only green is not green.
- **P-6 Nothing asked is dropped.** Every owner ask is a step here, in a sibling,
  or a named kill.

## Defects

Paths: bare = `src/scripts/code_graph/`; `_lib/`, `hooks/`, `bench_*.ts`,
`step_receipt.ts`, `check_step_receipts.ts`, `roadmap_verify_share.ts`,
`install-hooks.sh` = `src/scripts/`; `area_*.js`, `areas_common.js` =
`src/scripts/code_graph/map_viewer/`.

### Scope and integrity

| ID | Defect | Witness |
|---|---|---|
| H1 | Eight separate scope predicates, no fact records the result; 3 of 22 providers consult the fixture predicate | `fixture_paths.ts:19`, `build.ts:1186`, `map_model.ts:335`, `lanes/systems/read_systems.ts:74`, `lanes/runtime/read_runtime.ts:26`, `domains.ts:46` |
| H2 | Data: fixture models kept, fixture migrations dropped → DR-3 fires on them; manifest says `empty` beside 36 facts, 18 findings | `providers/laravel.ts:460`, `drift_rules.ts`, `agents/map/manifest.json` |
| H3 | Systems: fixture lockfiles become workspaces (11 lockfiles, 50 of 66 findings on fixtures) | `lanes/systems/read_systems.ts:116-118` |
| H4 | Flows take every route; tours take the three largest flows and end at `workflows[0]` | `lanes/flows/flows.ts:69-73`, `map_area_payloads.ts:867-907` |
| H5 | `internal/bench/**` gets role `code`, bench migrations `migration` | `map_model.ts:335-362` |
| H6 | No endpoint contract: merge writes a missing target as `EXTRACTED`; `env:<NAME>` edges vs `env-var:…` nodes | `validate.ts:70-72`, `lanes/merge.ts:132`, `lanes/interfaces/index.ts:518,521` |
| H7 | Witness kind unrecorded; history witness is a sha prefix → 0 of 1,287 confirmable; edges have no confirm path | `lanes/history/history.ts:220-222`, `verify/witness_check.ts:5-9,95-111`, `confirm.ts:98` |
| H8 | Interfaces scanner matches `fetch` in comments and string literals | `_lib/read_surface_scan.ts:79,138`, `mcp_server/tools.ts:1442` |
| H9 | Core nodes carry no fact metadata | `types.ts:242-243` |

### Systems accuracy

| ID | Defect | Witness |
|---|---|---|
| H10 | Classmap-only packages and `use Foo;` without a backslash never bind → false "declared, no use found" | `lanes/systems/read_systems.ts:300-306`, `lanes/systems/lockfiles.ts:268-270` |
| H11 | Usage verdict is a boolean; per-workspace identity lost; payload holds the shortest path only | `systemsPayload` in `map_area_payloads.ts` |

### Ticked but thin

| ID | Defect | Witness |
|---|---|---|
| H12 | Domains only on tables and packages; rules outside the drift engine; pack resolver skips NOT_A_DOMAIN and ≥2 | `map_knowledge.ts:108-129`, `domains.ts:320-330` |
| H13 | Commit subjects (a squash subject is the PR title) in the committed map — **live** | `map_knowledge.ts:150` |
| H14 | Provenance timeline uses `git log --follow` | `provenance_verbs.ts:84` |
| H15 | Authors and last change read `--no-renames` | `map_answers.ts:330` |
| H16 | Branch gc only from `branches gc`; remote-tracking branches never expire; full manifests | `cli_knowledge.ts:89`, `branches.ts:412` |
| H17 | Parent recorded only by `branch_chain parent --set` offline; no parent SHA; `ownedBy` true for 0 own commits | `_lib/branch_parents.ts:62-71`, `_lib/branch_chain_status.ts:67-80` |
| H18 | Chain early warning compares file paths only | `_lib/branch_chain_status.ts:147-159` |
| H19 | `hiddenDependencies` has no production caller; flow lens hard-wired off | `area_code.js:1104` |
| H20 | Rebuild-diff scheduled nowhere, compares lane-free builds | `verify/rebuild_diff.ts:63-64` |
| H21 | The pack never reaches the agent through the hook (deferred to 5.6) | `hooks/code_graph_context_hook.ts` |

### Committed map lifecycle

| ID | Defect | Witness |
|---|---|---|
| H22 | Hooks redraw the tracked map in the background; no CI job draws or checks it | `install-hooks.sh:676-703` |
| H23 | ~18–19.6 MB of blob per touch; the archive procedure text-edits the generated map | `src/skills/roadmap-management/SKILL.md:62-64` |
| H24 | Freshness frozen at draw time; lane-less cache reused as `fresh`; title is the folder name | `map.ts:236-242,438` |

### Closing, testing, measurement

| ID | Defect | Witness |
|---|---|---|
| H25 | A receipt is the ceremony class of a path set; checker report-only in shadow | `step_receipt.ts:59-70`, `check_step_receipts.ts:236-244` |
| H26 | Measurement steps verify existence; archiving checks ticked boxes only | `roadmap_verify_share.ts:11-19` |
| H27 | The one real-repo lane test asserts ≥1 history relation | `tests/scripts/code_graph_lane_history.test.ts:179-190` |
| H28 | No trace; turns, models, subtype parsed and dropped | `bench_ab_task_runner.ts:230,408-409` |
| H29 | Arms conflate payload with map; `ac` uses user scope | `bench_map_task_set.ts:96-100` |
| H30 | 3–6-file task repos cannot show a map effect | `internal/bench/ab/map-task-set/**` |
| H31 | "Errored, check passed" counted as failure; M2 matches substrings | `bench_map_task_set.ts:204`, `_lib/bench_map_metrics.ts:229-232` |

H32–H34 (views) belong to `road-to-map-views-from-the-handover`.

## Phase 1 — Privacy hotfix: no PR title in a committed file

The leak is live, so this phase ships first and alone. It implements the
recommendation of decision O3 now; if the council chooses otherwise, step 1.1 is
a one-line revert.

- [x] **1.1 [F.2a] Drop subjects from the committed commit tuple.** `map_knowledge.ts:150` stores sha, date, author name, PR number and ticket keys only; subjects stay in `.build/`. verify: `npx vitest run tests/scripts/code_graph_provenance_privacy.test.ts` -> 0
- [x] **1.2 Redraw the committed map without subjects.** verify: `git grep -cE '\(#[0-9]{3,5}\)' -- agents/map/code/map.json` -> 1
- [x] **1.3 Build the audit fixture and its regression test.** A fixture repo with a squash commit `feat: status (#9)` and a migration rename (the second archived roadmap's AC-6 shape); the test asserts the subject appears nowhere under `agents/map/` outside `.build/`. verify: the test above fails when step 1.1 is reverted, and `npx vitest run tests/scripts/code_graph_provenance_privacy.test.ts` -> 0

## Phase 2 — One scope, one integrity contract [A]

Blocks every later phase.

- [x] **2.1 [A.1] One scope classifier.** New `code_graph/scope.ts` with values `product | test | fixture | bench | doc | vendored | generated`, defaults from today's union of predicates, overrides from a `scope:` section of `layers.yaml` read by the one reader that already serves `readLayerRules` and `readDomainRules`; replaces `fixture_paths.ts`, `isTestFile`, `isTestPath`, `isDevPath`, `RUNTIME_SKIP` and the five walk skip lists. New verb `code-graph scope <path>`. verify: `agent-config code-graph scope internal/bench/x.ts` -> /bench \(default rule bench\/\)/
  > note: verified through the worktree CLI (`./scripts-run src/scripts/code_graph/cli scope internal/bench/x.ts`); the installed `agent-config` picks the verb up on the next release. The `isDevPath` tooling half (scripts/, tools/, bin/, seeders) stays local: it is no scope.
- [ ] **2.2 [A.2] Scope on every fact.** Stamped on nodes at discovery and on lane facts in merge; drift, flows, tours, payloads and manifest filter in one place; fixtures are a counted toggle "+N in fixtures" (O5). verify: `agent-config code-graph build --lanes --check-fixture-findings` -> 0
- [ ] **2.3 [A.3] Lint: no path regex in `lanes/**` or `providers/**`.** Registered with its ratification artifact. verify: a planted regex makes `./scripts-run src/scripts/lint_code_graph_scope_regex` exit 1 naming `scope.ts`, and on the clean tree `./scripts-run src/scripts/lint_code_graph_scope_regex` -> 0
- [x] **2.4 [A.4] Endpoint contract.** Lane edges hit a node or carry `relation_state: unresolved` with a reason; merge refuses the rest; new verb `code-graph lint` runs nodes then edges and fails on dangling endpoints, duplicate ids, invalid spans. verify: `agent-config code-graph lint` -> 0
  > note: verified through the worktree CLI after a lane build (71,142 nodes, 261,975 edges, 0 problems). Deviation for council review: merge types an undeclared dangling lane edge `unresolved` with the reason "target … is not a node of this graph" instead of refusing it — the runtime and interfaces drift fixtures read 10 such edges (missing volumes, services, Terraform and k8s refs, contract files) that refusal would delete (Risk 2). Refusal still applies to an unknown source; `lint` still fails a planted dangling edge that carries no state.
- [ ] **2.5 [A.5] Witness kind.** `witness.kind ∈ {span, name, commit, file}` with a fixed hash form per kind; `confirm` per kind (a commit by object existence); edges get a confirm path; new `verify --all` prints the rate per lane. verify: `agent-config code-graph verify --all --min-rate 0.99` -> 0
- [x] **2.6 [A.6] Readers fixed at the cause.** Interfaces skips comments and string literals and uses the `env-var:` id scheme; a tour gets a delivery step only when a flow file lies on a workflow's paths; decisions `governs` only node paths, else unresolved. verify: `npx vitest run tests/scripts/code_graph_readers_at_cause.test.ts` -> 0
- [ ] **2.7 [A.7] Fact metadata on core nodes.** Owner file, `span` witness and rung T1 on file, class, method and route nodes; measure size first, budget ≤ 10 % on this repo, else only files carry witnesses. verify: the cost line exists in `agents/evidence/analysis/code-graph-core-fact-cost.md`, and `agent-config code-graph confirm file:src/scripts/code_graph/map.ts` -> /state:/
- [ ] **2.8 [A.8] The real repository in CI.** One job on PRs touching `src/scripts/code_graph/**` builds this repo with lanes and asserts 0 product-view fixture findings, 0 dangling lane edges, per-lane confirm ≥ 0.99, tours in product scope, no `empty` area with facts. New workflow, with ratification artifact. verify: `gh run list --workflow code-graph-real-repo.yml --limit 1 --json conclusion -q '.[0].conclusion'` -> /success/

## Phase 3 — Closing on evidence [B]

Gate changes; each needs council ratification. Step 3.2 conflicts with the
`roadmap_verify_share.ts` docstring ("a reader, not a gate"), so it goes through
the decision-revisit gate first.

- [ ] **3.1 [B.1] Receipt per step.** Computed from the commits that flipped that step (range, touched paths, verify output); the checker reads archived moves and content. verify: `npx vitest run tests/scripts/check_step_receipts.test.ts` -> 0
- [ ] **3.2 [B.2] Falsifiable verify at archive.** Every `verify:` names a command and an expected result; ratchet from the share at adoption (93/230 command, 6/230 expectation). verify: `./scripts-run src/scripts/archive_completed_roadmaps --dry-run --check-verify agents/roadmaps/archive/road-to-a-map-the-agent-checks-before-it-acts.md` -> 1
- [ ] **3.3 [B.3] Measurement steps need a threshold or an owner null record.** verify: a planted measurement step with neither makes `./scripts-run src/scripts/archive_completed_roadmaps --dry-run` refuse it, and the fixture test `npx vitest run tests/scripts/archive_measurement_threshold.test.ts` -> 0
- [x] **3.4 [B.4] Erratum on the two archived map roadmaps.** One appended section each listing the reopened steps (H12–H20) with this file's step IDs; H21 deferred to 5.6. verify: `grep -c '^## Erratum' agents/roadmaps/archive/road-to-a-map-the-agent-checks-before-it-acts.md` -> /^1$/

## Phase 4 — The committed map as a generated artifact [C]

- [x] **4.1 [C.1] Hooks never touch tracked files.** Background refresh in `install-hooks.sh:676-703` writes to `.build/` only. verify: after a commit with hooks installed, `git status --porcelain agents/map` -> /^$/
  > note: verified on the rendered hooks (`npx vitest run tests/scripts/code_graph_git_freshness.test.ts`, 13/13; red 5/13 before the edit) — reinstalling the shared `.git/hooks` was out of bounds for this lane. The consumer session concern (`hooks/code_graph_refresh_hook.ts`, `REFRESH_ARGS`) still passes `--map`; it is no git hook and stays as it is.
- [ ] **4.2 [C.2] Deterministic, sharded, diffable.** Sorted keys, pretty JSON, stable order, no volatile values; shards per area and per top-level directory for code; `linguist-generated` in `.gitattributes`; `index.html` committed or not per O1. verify: `npx vitest run tests/scripts/code_graph_map_determinism.test.ts` -> 0
- [ ] **4.3 [C.3] CI diff check.** CI redraws on PRs touching the tree and compares; outcome per O2. Workflow, with ratification artifact. verify: a fixture PR that changes a route without redrawing gets the configured outcome, and `npx vitest run tests/scripts/code_graph_map_diff_check.test.ts` -> 0
- [x] **4.4 [C.4] Honest freshness and name.** Page and MAP.md say "built at", then the build sha and date, and compute nothing about HEAD; title from `repo_identity.ts`, never the folder. verify: `grep -c 'built at' agents/map/MAP.md` -> /^[1-9]/
  > note: MAP.md now opens `# Map of agent-config` / `Map built at <sha> · <date>`. The page's own header (`area_agent.js`, `area_overview.js`, `areas_common.js` banner) still reads `meta.state`; it belongs to the views lane (`road-to-map-views-from-the-handover`).
- [x] **4.5 [C.5] Cache key includes the lane set** (`map.ts:236-242`). verify: `npx vitest run tests/scripts/code_graph_map_cache_lanes.test.ts` -> 0
- [ ] **4.6 [C.6] Procedures skip generated files.** The archive and rename procedures (`roadmap-management` SKILL, `archive_completed_roadmaps`) skip paths with the generated attribute. verify: after archiving a fixture roadmap, `git status --porcelain agents/map` -> /^$/

## Phase 5 — A measure that can answer [D]

Before any agent-facing addition.

- [ ] **5.1 [D.1] Trace capture.** `stream-json --verbose`; per trial: turns, wall time, models, subtype, tool calls by name, reads under `agents/map/**`, `code-graph` and `graph_*` runs, files read before the first edit, the tool/MCP list, AC version, payload hash; traces kept redacted beside the report. verify: `./scripts-run src/scripts/bench_map_task_set --dry-run --tasks 1 --check-trace-fields` -> 0
- [x] **5.2 [D.2] Grading fixed.** "Errored, check passed" is its own outcome; M2 matches on token boundaries. Re-scoring spends nothing. verify: `./scripts-run src/scripts/bench_map_task_set --rescore internal/bench/reports/map-task-set/2026-10-26T07-12-04Z-map-task-set.json` -> /ac-map delivery 2\/4/
  > note: re-scored 2026-10-27, no spend: vanilla 18 · ac 14 · ac-map 15 of 20 clean, ac-map 1 errored with its check passed; token-boundary M2 recall vanilla 0.825→0.805, ac 0.738, ac-map 0.743.
- [ ] **5.3 [D.3] Arms that separate payload from map.** Installed from the tree under test into the clone: vanilla; vanilla + map + note; AC lean; AC lean + map; AC full optional. verify: `./scripts-run src/scripts/bench_map_task_set --dry-run --print-arms` -> /5 arms/
- [ ] **5.4 [D.4] Coverage gate before spend.** Offline `pack`/`affected` per task must contain the planted affected set; covered and uncovered reported apart. verify: `./scripts-run src/scripts/bench_map_task_set --dry-run --coverage` -> /covered share/
- [~] **5.5 [D.5] Task set v2 on real repositories, then the paid runs.** Pinned SHAs (this repo plus pinned open repositories; the corpus of `road-to-a-graph-that-wins` is read, never edited), hundreds to thousands of files, traps a single grep cannot close, vanilla calibrated to 50–70 %, size from a power analysis (starting estimate ≈ 70 paired trials for a 15-point effect at 80 % power), ≥ 2 seeds, clean worktree per trial; pre-registration committed before the first paid run. Deferred on blocker `b-map-remeasure-spend`. verify: `git log --format=%H -1 -- agents/evidence/preregistration/map-remeasure-v2.md` names a commit older than the first paid report.
- [ ] **5.6 [D.6] Decision rule before the run.** Gain on covered tasks ≥ the minimum effect on M1 or M2 at ≤ the O4 margin on M3 → hook delivery of the pack (H21) is built behind the same gate; null → the map stays a human view and on-request tool, the hook stays state-only, the consequence recorded (O7). A null is an owner decision (P-4). verify: `grep -cE '^- \*\*Branch taken:\*\* (gain|null)' agents/evidence/decisions/map-remeasure-decision.md` -> /^1$/
- [~] **5.7 [D.7] Spend cap value and record.** `--max-usd` exists (`bench_map_task_set.ts:308`); only the value per run and its record are missing. Deferred on blocker `b-map-remeasure-budget` (owner-reserved O4). verify: a paid report whose `sweep_cap_usd` equals the value the owner set.

## Phase 6 — Systems that are right [E]

Before the Systems view of `road-to-map-views-from-the-handover`.

- [ ] **6.1 [E.1] Offline PHP binding.** Read `vendor/composer/autoload_{classmap,psr4,namespaces,files}.php` and `installed.json` as data, map files to packages by `install-path`, resolve `use` aliases including root-namespace names; without `vendor/`, fall back to lockfile PSR maps and state "binding partial". Extends the audit fixture from 1.3. verify: `npx vitest run tests/scripts/code_graph_systems_php_binding.test.ts` -> 0
- [ ] **6.2 [E.2] Verdict states.** `used`, `used-through <pkg>`, `unused-candidate`, `not-installed`, `virtual/meta`, `ignored (reason)`; SY-1 only on `unused-candidate` in product scope. verify: `npx vitest run tests/scripts/code_graph_systems_verdicts.test.ts` -> 0
- [ ] **6.3 [E.3] JS non-import uses as typed inputs.** Five plugins: package.json scripts, CI `run` steps, tsconfig, eslint, vite/vitest; extends the existing `nonImportUses`. verify: `npx vitest run tests/scripts/code_graph_systems_nonimport.test.ts` -> 0
- [ ] **6.4 [E.4] Per-workspace identity.** Package node = (ecosystem, name, version) with an importer table {lockfile, workspace, specifier, relation, scope}. verify: `npx vitest run tests/scripts/code_graph_systems_importers.test.ts` -> 0
- [ ] **6.5 [E.5] Why and who, precomputed and bounded.** Chains ≤ 20 per package with the spec at each hop, dependent counts, subtree size; payload growth linear in packages, budget measured then fixed. verify: `npx vitest run tests/scripts/code_graph_systems_why.test.ts -t express` -> 0
- [ ] **6.6 [E.6] Functions per file with counts.** verify: `npx vitest run tests/scripts/code_graph_systems_functions.test.ts` -> 0

## Phase 7 — Close what was ticked thin [F]

- [ ] **7.1 [F.1] Domains complete.** Routes get their handler's domain, tickets the domains they touched; domain rules move into the drift engine with `confirm`; the pack resolver uses the map's filters. verify: `npx vitest run tests/scripts/code_graph_domains.test.ts` -> 0
- [ ] **7.2 [F.2b] Provenance renames.** The timeline uses the history lane's rename pairs, not `--follow` (`provenance_verbs.ts:84`); authors and last change read renames (`map_answers.ts:330`). verify: in the audit fixture the migration timeline has no create commit, and `npx vitest run tests/scripts/code_graph_provenance_renames.test.ts` -> 0
- [ ] **7.3 [F.3] Branches clean themselves.** gc inside `refresh`, bounded in time; remote-tracking branches expire unless pinned; a manifest stores a delta against its parent's. verify: `npx vitest run tests/scripts/code_graph_branches_gc.test.ts` -> 0
- [ ] **7.4 [F.4] A chain that knows its parent.** post-checkout records the parent and its SHA from the reflog; merged parents detected offline and children re-parented with a report; "ours" needs ≥ 1 own commit or an author match; foreign branches frozen. Hook edit in `install-hooks.sh`. verify: `npx vitest run tests/scripts/branch_chain_parent.test.ts` -> 0
- [ ] **7.5 [F.5] Semantic early warning.** Overlap on tables, columns, packages, routes, not paths. verify: `npx vitest run tests/scripts/branch_chain_semantic_overlap.test.ts` -> 0
- [ ] **7.6 [F.6] Surface what is computed.** Hidden dependencies (after 2.5) in the Code rail, review-risk and a verb; the flow lens draws product-scope flows; decisions in the detail panel. Waits on Phases 2 and 5 (P-3). verify: `npx vitest run tests/scripts/code_graph_surface_computed.test.ts` -> 0
- [ ] **7.7 [F.7] Nightly rebuild-diff with lanes.** Workflow, with ratification artifact. verify: `gh workflow view code-graph-rebuild-diff.yml` -> 0

## Order

```
1 (privacy hotfix) ──► 2 (scope + integrity)
2 ──► 3, 4, 5, 6
5 ──► gain ──► hook delivery of the pack (H21)
  └─► null ──► recorded; the map stays a human view + on-request tool
6 ──► 7.1–7.5, 7.7
2 + 5 ──► 7.6
```

Phases 3 and 4 run beside 5 and 6; nothing in 5–7 waits for them, but no step of
this file archives before Phase 3 is in force.

## Kill register

| ID | Killed | Instead |
|---|---|---|
| K1 | Fixing H2–H5 one bug at a time | One scope model (2.1–2.3); the single bugs become 2.8 assertions |
| K2 | Re-running the same 20 fixture tasks with more seeds | Coverage gate and real repositories (5.4, 5.5) |
| K3 | Untracking the map by default | The owner asked for it in the repo; it becomes a generated artifact (Phase 4); untracking stays O1(c) |
| K4 | LFS for the map | Breaks offline clones; shards and a diff check instead |
| K5 | New lanes or hook injection before Phase 5 closes | P-3 |
| K6 | Running package managers, reflection or third-party code to bind symbols | Autoload maps read as data (6.1) |
| K7 | Registry metadata (outdated, maintainers, advisories) in the map | The stated gap and a pointer to `audit:deps` |
| K8 | A full 1,000+ node package graph or a treemap as the primary view | List + detail; focused graph |
| K9 | Branch names or dates in the committed map | A header chip states the snapshot (sibling views roadmap) |
| K10 | Archiving on "file exists" | 3.2, 3.3 |
| K11 | A second scope or path-classifier module | 2.3 lint |
| K12 | Treating "errored" as failure when the check passed | 5.2 |
| K13 | Owning the standing-payload size here | Measured as an arm (5.3); its reduction stays with the payload roadmaps |

## Decisions

Every row is **council-pending**: the decision column holds the plan's
recommendation as proposed, not a ruling. `council:pending` names no record yet;
the row closes when the council's record replaces it.

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| O1 | contested-technical | council:pending | Proposed (a): commit JSON shards + MAP.md + manifest; draw `index.html` locally on `open`. Options: (a); (b) also commit `index.html`; (c) commit nothing, CI artifact | `index.html` is 9,500,554 B of embedded copy of the shards (`git ls-tree -l`) | a consumer needs the page without a local draw |
| O2 | reversible-technical | council:pending | Proposed: tolerant on PRs (the map states "behind N"), strict on release cuts. Options: strict / tolerant | H22: no CI job draws or checks the map today | tolerant PRs leave the map more than one release behind |
| O3 | reversible-technical | council:pending | Proposed: no subjects; PR number and ticket keys only — implemented early by Phase 1, one-line revert. Options: none / only when no PR exists / all (today) | H13: ≥ 37 squash subjects with `(#NNNN)` in `agents/map/code/map.json` | a reader needs the subject and `.build/` cannot serve it |
| O5 | reversible-technical | council:pending | Proposed: fixtures hidden behind a counted toggle "+N in fixtures". Options: hidden with a counted toggle / shown greyed | H2/H3: 18 of 18 data and 50 of 66 systems findings sit on fixture paths | a product file is found misclassified as fixture |
| O7 | contested-technical | council:pending | Proposed: a null in 5.6 ends hook delivery only; agent-facing verbs stay on request. Options: hook delivery only / also agent-facing verbs | P-4; the three-arm reading (vanilla 18 · ac 14 · ac-map 15 of 20) cannot separate payload from map | a covered-task null also shows the verbs cost more than grep |

O4 (re-measure budget and the M3 margin for a gain) is owner-reserved spend and
sits in blocker `b-map-remeasure-budget`, not in this table.

## Blockers

### blocker: b-map-remeasure-spend

- **Status:** open
- **Owner:** the owner — paid bench runs on real repositories are spend above any delegated threshold.
- **Blocks:** 5.5, and through it 5.6 and AC-7.
- **Recommendation:** (a), once 5.1–5.4 are green and the pre-registration is committed; the dry run and the coverage gate show the cost before a cent is spent.
- **If you do nothing:** the map is never measured on a task large enough to show an effect, and hook delivery of the pack (H21) stays unbuilt by P-3.
- **What to do:** pick exactly one — (a) approve the paid runs of 5.5 under the cap set in `b-map-remeasure-budget`, run through the CLI first (`./scripts-run src/scripts/bench_map_task_set --tasks v2 --max-usd <cap>`), or (b) record a null-by-choice in `agents/evidence/decisions/map-remeasure-decision.md` so 5.6 takes the null branch without a run.
- **Resolved when:** either the first paid report of task set v2 exists under `internal/bench/reports/map-task-set/` with a commit newer than the pre-registration, or the decision file records the owner's null-by-choice with its consequence.

### blocker: b-map-remeasure-budget

- **Status:** open
- **Owner:** the owner — O4 is a spend cap and a cost margin, both owner-reserved.
- **Blocks:** 5.7, 5.5 (its paid half) and the gain threshold of 5.6.
- **Recommendation:** (a) — set the cap after the 5.4 dry run prints the covered share and a projected cost, so the number rests on a measurement.
- **If you do nothing:** 5.5 cannot start, and 5.6's gain branch has no M3 margin to test against.
- **What to do:** pick exactly one — (a) answer O4 in `agents/owner-questions.md` with a per-run USD cap and an M3 margin after the 5.4 dry run, or (b) answer it now with the fixture-sized reading (≈ $0.015 / $0.090 / $0.100 per vanilla / ac / ac-map run) scaled by the dry run's file count.
- **Resolved when:** `agents/owner-questions.md` carries an O4 answer naming a per-run cap and an M3 margin, and 5.7's `--max-usd` value equals that cap.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Scope hides product files | product | The scope model classifies a real product file as fixture or bench and its findings vanish from default views | Default rules + overrides + `code-graph scope` explanation; 2.8 asserts counts both ways; fixtures are a counted toggle, never dropped | Phase 2 — One scope, one integrity contract [A] |
| 2 | Contract refuses useful facts | implementation | The endpoint contract drops edges that were correct but whose target is not a node | Unresolved is a typed state with a reason, not a deletion | Phase 2 — One scope, one integrity contract [A] |
| 3 | Evidence gates slow every roadmap | product | Receipts and falsifiable-verify gates refuse archival across the estate | Ratchet from the share at adoption, applied to new and reopened steps first | Phase 3 — Closing on evidence [B] |
| 4 | Committed map keeps growing the pack | implementation | Each redraw adds megabytes of blob history | 4.1–4.3; O1(a) | Phase 4 — The committed map as a generated artifact [C] |
| 5 | The re-measure is null again | product | Task set v2 shows no map gain | That is an answer; 5.6 states what follows; the map stays useful to people | Phase 5 — A measure that can answer [D] |
| 6 | The re-measure costs more than it is worth | product | Real repositories multiply per-run cost | Coverage gate and dry run before spend; cap O4 | Phase 5 — A measure that can answer [D] |
| 7 | Systems redesigned on wrong data | product | The sibling Systems view is built before verdicts are right | Phase 6 before the sibling's view steps; its design reads Phase 6's payload | Phase 6 — Systems that are right [E] |
| 8 | Hotfix pre-empts the council on O3 | implementation | Phase 1 implements O3's recommendation before the council rules | 1.1 is a one-line revert; the regression test names the field, not the policy | Phase 1 — Privacy hotfix: no PR title in a committed file |

## Acceptance Criteria

All read on a lane build of this repository at the closing commit unless a
fixture is named.

- [ ] AC-1 — Default views show 0 findings in fixture scope; Data and Systems each count "+N in fixtures"; tours and flows start in product scope.
- [ ] AC-2 — 0 dangling lane edges; `code-graph lint` fails on a planted one.
- [ ] AC-3 — `code-graph verify --all` confirm rate ≥ 0.99 per lane on a fresh build, history included.
- [ ] AC-4 — The manifest has no area that is `empty` with facts or findings.
- [ ] AC-5 — A planted PR that ticks a step without its paths fails the receipt check; the archive gate refuses a roadmap with a non-falsifiable verify, or a measurement step without a threshold or decision.
- [ ] AC-6 — With hooks installed a commit leaves `agents/map` clean; a one-file change rewrites ≤ 3 shards; two draws are byte-identical; the page states build sha and repo name.
- [ ] AC-7 — The bench report carries trace fields per trial and a covered/uncovered split; the pre-registration predates the first paid run; the decision record exists, whatever the result.
- [ ] AC-8 — Audit fixture: classmap and root-namespace packages bind; an uninstalled package is `not-installed`; SY-1 appears only on `unused-candidate` in product scope.
- [ ] AC-9 — Audit fixture: no commit subject under `agents/map/` outside `.build/`; the migration timeline has no false rename.
- [ ] AC-10 — Fixture chain: the parent is recorded at `checkout -b`; a merged parent re-parents its children; a 0-commit branch is "not ours"; gc runs from `refresh`; two branches adding the same column warn on the column.
