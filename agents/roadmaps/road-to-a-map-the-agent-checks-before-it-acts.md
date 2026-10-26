---
complexity: structural
status: ready
tree_pin: fec571b6d0
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Operator-requested active roadmap (2026-10-26, invocation of /analyze:inbox on round-7c3e91: 'danach arbeite die roadmaps ab mit /roadmap:process-full … erstelle am ende einen pr und merge ihn'). One-in-one-out searched first: `grep -rlF -e 'schema' -e 'column' -e 'confirm' agents/roadmaps/*.md` over the five active roadmaps finds no owner of the knowledge map; road-to-a-graph-that-wins owns the comparator benchmark only. The run archives this file in the same PR when it closes, so the active count returns to 5 at merge."
estate_growth_exempt: "Active roadmaps 5 -> 6 while this PR is open, by the operator's explicit request to execute it in the same run; the file is archived in the same PR, so main's count does not change at merge. later/road-to-database-erd-landing and later/road-to-database-relational-modeling are folded here (Phase 0) instead of waking on a field deleted 2026-09-11."
relates:
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns the comparator benchmark on the two ADR-260 subject repositories. The task set T here is in-repo planted fixtures that measure this roadmap's lanes; nothing here edits that roadmap's corpus or its steps."
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Owns per-step ceremony depth from classify_change_risk. Step 3.4 here reads the same class for confirm depth in shadow and does not change its table."
---
# Road to a map the agent checks before it acts

> **Source:** `agents/tmp.old/round-7c3e91/` — one owner transcript (nine
> owner turns, 2026-10-26 01:38–02:53), five revisions of an externally drafted
> plan, two repo-native proposals (the operative one is v9.3, pinned at
> `main@20e790e6`), and a ten-page design handover for the map (the
> "Knowledge Map" design, React prototypes). Re-verified against
> `main@fec571b6d0`; code-graph files are unchanged between the two pins.
> Codenames S1–S48 for outside sources stay in the round's annex, not here.
>
> **The owner's demands, in order:** record everything about a project's
> databases — relations, keys, cascades, and what is missing where (turn 1);
> show it next to the code map, one place, one interface (turn 3); the project
> graph belongs there too (turn 5); a graph of external interfaces — type,
> endpoints, variables (turn 8); every graph in the same map folder, and **the
> graph is a source, not the truth** — check whether a field still exists, was
> removed, or was added, and update at the end of the work (turn 13); extend
> the local environment with Docker and ports, map infrastructure from HCL and
> workflows, review and production systems, a git-workflow graph (turn 16);
> learn from comparable projects (turns 23, 25). The invocation adds: build the
> new design, but the HTML is not always right — logo, icon and flyouts were
> already corrected on main.

## Goal

AC keeps **one** map of a project — code, data, external interfaces, runtime,
delivery — in **one folder**, `agents/map/`, rendered in **one interface**
built to the Knowledge Map design, and on the developer's machine a hub of all
projects. Every fact in it carries a witness (`file:line` plus a hash of what
was read there). Before the agent acts on a fact it confirms the witness
against the working tree; after it acts it re-reads what it touched and
updates the map. Counts are lower bounds. No code path connects to a
database, a cloud, a daemon or an external endpoint, and no `.env` value is
ever read. Finished means: the probes below produce the expected facts, the
planted task set exists with a recorded baseline, and every area of the design
renders from real facts or says why it has none.

## Context — what is true at `fec571b6d0`

| # | Finding | Evidence |
|---|---|---|
| C1 | A model named `User` is invisible to the data layer | `src/scripts/code_graph/providers/laravel.ts:91` (`MODEL_BASES` holds `'User'`), `:431`, `:455` |
| C2 | `Http::post()` resolves to an in-repo `Comment::post` when it is the only method of that name | `src/scripts/code_graph/build.ts:784-819`, `:962-965` |
| C3 | Three migration readers disagree; a `Schema::connection('tenant')` table is missed by the graph; drops and renames are not modelled; FK-index assumption is engine-blind | `src/scripts/_lib/persistence/detect_index_parity.ts:125-185`; `laravel.ts:370-386` |
| C4 | `table` nodes exist; `column`, FK relation and edge attributes do not | `src/scripts/code_graph/types.ts:39-55`, `:201-215` |
| C5 | A finished SchemaIR (4 adapters, differ, two renderers, 134 tests) exists only on the local branch `feat/schema-erd-diff` (`3996829e65`) | `git ls-remote origin feat/schema-erd-diff` is empty |
| C6 | Two DB parks wake on `ci_delivery.grace_ceiling`, deleted 2026-09-11 | `agents/roadmaps/later/road-to-database-erd-landing.md:12`, `:475`; `later/road-to-database-relational-modeling.md:13` |
| C7 | External services are no graph nodes; the only URL convention matches relative in-repo routes and is off by default | `src/scripts/code_graph/conventions_default.ts:55`, `:59` |
| C8 | Compose files, Dockerfiles and consumer workflows are already read — by the advisory inventory, not by the graph | `src/scripts/_lib/advisory_inventory.ts:294-345` |
| C9 | No reader for ports, HCL, Kubernetes, GitLab CI, contracts (OpenAPI/WSDL/SDL/proto) | grep over `src/` |
| C10 | The shipped rule treats a fresh index as sufficient; freshness is graph-wide | `src/rules/external-code-graph-interop.md:62-68`; `src/scripts/code_graph/detect.ts:225-331` |
| C11 | Graph artefacts sit in five places; a side-written map file is carried, never regenerated | `graph_home.ts:18-19`, `:39`; `estate_index.ts:9`; `estate_map.ts:27-29`; `map.ts:490-499` |
| C12 | One `git log` pass already reads churn and authors; no co-change is derived; renames are cut | `src/scripts/code_graph/map_answers.ts:305-346` |
| C13 | No decision node, no `governs`/`supersedes` relation; flows stop at request paths | `types.ts:39-55`; `map_model.ts:786-859` |
| C14 | The viewer on main is an earlier cut of the handed-over design (same tokens) | `src/scripts/code_graph/map_viewer/viewer.css:1-29`; commit `26384a45b6` |
| C15 | ADR-299's title says the project graph is "the only truth" — contradicts the owner's turn 13 | `docs/decisions/ADR-299-a-graph-home-beside-the-project-graph.md:33` |
| C16 | The owner's memory of an existing "local environment graph" is the ADR-299 project registry; it holds package and symbol names only | `src/scripts/code_graph/estate_index.ts:1-14` |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| DEC-1 | product-owned | owner | Map areas are the design's eight: Übersicht · Code · Data · Interfaces · Runtime · Delivery · Impact · Agent; Projects lives only in the hub. Runtime renders the design's Infrastruktur page (IaC, environments); Delivery renders Umgebung & CI/CD (local environment, compose, ports, pipelines). | The owner's design handover (round-7c3e91) names these pages; privacy floor `estate_map.ts:117-121` | the owner changes the handover |
| DEC-2 | product-owned | owner | Where the design disagrees with shipped decisions, main wins: traced AC logo and icon, flyouts pinned only at ≥ 1240 px with scrim and phone mode, Top-N listbox, back trail, no-data tags with reason, dashed guessed edges, system fonts (CSP), theme from `prefers-color-scheme`, EN/DE string tables, treemap by folder, `--alert` token, no `Global ↗` link carrying a home path. The wordmark becomes `KNOWLEDGE MAP`, a design change and not one of the local corrections. | Owner, invocation 2026-10-26: "nur weil es im html steht ist es nicht immer richtig … (Logo, icon, flyouts, etc.)" | the owner names another local correction |
| DEC-3 | product-owned | owner | An area with no facts is shown with "no data yet" and the reason, never hidden — replaces the proposal's "no empty tabs" rule. | Owner decision 2026-10-25, PR #2681, option 2 | the owner reverses #2681 |
| DEC-4 | reversible-technical | agent | One `index.html`, hash router, vanilla ES5 split into per-area source files joined before the CSP hash; no React, no CDN, no new runtime dependency. | ADR-297:70; CSP `map.ts:949-958` | the single file exceeds a measured render budget |
| DEC-5 | deterministic | agent | The design's sample values ("Beispieldaten · Fixture") are illustration; no sample value ships. | The design pages carry the chip themselves | never |
| DEC-6 | reversible-technical | agent | The local ERD code is folded into this branch from the local ref (own code, adapted to the new IR) instead of a separate backup push. | `git ls-remote origin feat/schema-erd-diff` is empty; a second branch push needs its own go-ahead | the fold loses a test the branch had |
| DEC-7 | product-owned | owner | The graph is an index, never the truth: a new ADR amends ADR-297/299 wording and fixes the one-folder layout. | Owner turn 13: "AC soll die Graphen als Quelle aber nicht als Wahrheit sehen … Alle Graphen sollten am Ende auch im selben map ordner" | never |
| DEC-8 | critical-technical | evidence | AC never connects to a database, cloud, Docker daemon, cluster or external endpoint and never reads `.env` values or Terraform state; observed state enters only as a user-produced file on the source ladder. | ADR-124:133 (no network in the build path); lethal-trifecta rule | ADR-124 is superseded |
| DEC-9 | reversible-technical | evidence | One reader per format: the advisory inventory's compose/Dockerfile/workflow reading becomes the shared reader the graph and the advisories use. | `src/scripts/_lib/advisory_inventory.ts:294-345` already reads them offline with file:line | the two consumers need incompatible shapes |
| DEC-10 | reversible-technical | agent | Drift classes are rules as data, advice by default; a class gates only after its planted-fixture precision is recorded. ID families `DR-` data, `IF-` interfaces, `RT-` runtime, `DL-` delivery. | v7 proposal W6.2 carried; ID collision in v9.3 | a class reaches its recorded precision bar |
| DEC-11 | reversible-technical | evidence | No new skill and no new MCP tool: procedures go into existing skill bodies; existing `graph_*` tools gain kind/relation filters and modes. | Probe P4 (a skill body is free, a catalogue line is not); MCP tool count at zero headroom | the catalogue budget gains headroom |
| DEC-12 | reversible-technical | agent | No LLM-written text in the fact graph; tours and pages are templates over facts. | Proposal K13 | a measured M2 gain from an annotation overlay |
| DEC-13 | deterministic | evidence | Code from audited outside projects is re-implemented, never copied. | code-provenance rule; one audited source has no LICENSE file | never |
| DEC-14 | reversible-technical | agent | Telemetry, SBOM, feature flags, CODEOWNERS, incidents, PII dimensions and Helm values, Pulumi, CloudFormation are out of scope here; each enters only with a measured M2 case. | Proposal P-3 base before breadth | a lane slice shows an M2 case one of them answers |
| DEC-15 | spend-exhaustion | evidence | Measurement uses an in-repo planted task set; the three-arm run stays inside the ADR-237 per-run budget and is published whatever it says. | ADR-237; proposal K9 | the budget cannot power the run |

## Phase 0 — Fold the parked work

- [ ] **0.1 Fold the local ERD branch.** Bring SchemaIR v1, its four adapters,
      the differ and the Mermaid renderer from `feat/schema-erd-diff` into
      `src/scripts/_lib/schema/`, with their tests, adapted to the IR shape of
      Phase 1. The branch's skill does not land (DEC-11).
      verify: the folded tests pass under vitest and `grep -rl erDiagram src`
      finds the renderer.
- [ ] **0.2 Close the dead parks.** `later/road-to-database-erd-landing.md` is
      folded here and archived with a pointer; `later/road-to-database-relational-modeling.md`
      gets a wake rule that can fire (this roadmap's archive), and its
      `grace_ceiling` lines become historical.
      verify: no non-historical `grace_ceiling` line remains under
      `agents/roadmaps/later/`.
- [ ] **0.3 Fix the skill/guideline contradiction.** The `database` skill's
      composite-index advice and the guideline's `foreignId()` claim agree and
      name the engine where it matters.
      verify: the two texts no longer contradict on column order or on FK
      indexing per engine.

## Phase 1 — Correct the base

- [ ] **1.1 `User` is a model.** A base class is recognised by the framework's
      own declaration, never by an app class's name.
      verify: a fixture with `class User extends Authenticatable` yields
      `persists` → `users` and its `relates` edges.
- [ ] **1.2 Facades are not in-repo methods.** A call whose receiver is a known
      static facade or SDK client never resolves to an in-repo method by name;
      it is held for the interface reader.
      verify: the P5 fixture has no `Comment::post` edge from the partner client.
- [ ] **1.3 One schema model per stack, by replay.** Migrations are replayed in
      order (create, alter, add/drop column/index/FK, rename, drop) per
      connection; conditional DDL is `uncertain`; completeness per connection
      is `complete | partial | unknown`. Laravel, raw SQL DDL and Prisma first;
      readers sit behind the provider registry. The index-parity linter and the
      graph read the same result.
      verify: P1/P2 fixtures — `invoices` on `tenant`, no dropped table, the
      dropped index no longer counted; a sabotage probe turns the suite red.
- [ ] **1.4 Columns, keys, actions.** `column` nodes; table→table `references`
      with on_delete/on_update; `relates` carries kind (1:1, 1:n, n:1, n:m,
      polymorphic) and key column; `SCHEMA_VERSION` bumped.
      verify: a graph query on `comments.post_id` reaches the relation and the
      controller that filters on it.
- [ ] **1.5 Correctness suite and recall ratchet.** Every defect above is a
      planted fixture; fixtures list must-exist and must-not-exist facts; a
      baseline file may only rise; every `graph_*` MCP tool has a test against
      the real SQLite twin.
      verify: the ratchet test fails when one must-exist fact is removed from
      a fixture's expected output.

## Phase 2 — One fact layer

- [ ] **2.1 Fact shape.** Every fact records owner file, witness (`file:line`,
      span hash), source rung (T1 code/migration · T2 committed dump/contract ·
      T3 user-produced snapshot · T4 framework oracle) and `resolved_via`, in
      the existing graph and its SQLite twin.
      verify: a round-trip test writes and reads every field through SQLite.
- [ ] **2.2 One vocabulary file.** Kinds and directional relations for all lanes
      (`table`/`column`, `service`, `operation`, `resource`, `environment`,
      `workflow`/`job`, `decision`; `references`, `reads`/`writes` at column
      level, `calls-out`, `configured-by`, `described-by`, `deploys-to`,
      `triggers`, `governs`, `supersedes`, `co-changes`), with a version stamp
      and a cap per lane; no kind outside the file.
      verify: a test fails on a kind used in code but absent from the file.
- [ ] **2.3 One drift engine.** Rules as data over the fact layer, one finding
      shape (both witnesses, engine, completeness, tier), waivers declared with
      a non-empty reason, every report printing its basis.
      verify: one rule file change adds a finding without engine code changes.
- [ ] **2.4 One query surface.** Existing verbs and `graph_*` tools gain kind and
      relation filters; answers are compact indented trees with relation labels,
      each item with witness and confirm state, lists with
      `returned/total/hasMore`, absence answers naming their population.
      verify: `graph_query` with a kind filter returns only that kind and its
      population line.
- [ ] **2.5 Old readers keep working.** The previous CLI and MCP output shapes
      stay readable for one release; the cache path reads a fallback.
      verify: the existing graph tool tests pass unchanged.

## Phase 3 — Verify before acting, update after

- [ ] **3.1 Witness, tombstone, shrink guard.** Deleting a source span writes a
      tombstone; a refresh that loses more than a set share of facts without
      matching deletions is refused; a scheduled full rebuild diffs against the
      incremental state.
      verify: deleting a migrated column yields a tombstone; a planted mass
      loss is refused.
- [ ] **3.2 Working-tree overlay.** Facts are owned by files; a changed file
      replaces exactly its facts in an overlay above the committed index.
      verify: an uncommitted new column shows as `added` before any rebuild.
- [ ] **3.3 `confirm`.** Re-reads only the witnesses of an answer through the
      SQLite index → `confirmed | moved | changed | gone`; p95 ≤ 50 ms for ≤ 20
      witnesses on this repository; never loads the JSON graph. CLI verb and a
      `graph_node` mode.
      verify: a latency test on this repository records p95 under the budget.
- [ ] **3.4 Depth by risk class, in shadow.** `classify_change_risk` decides
      confirm depth (R0 none, R1 witnesses, R2 + text cross-check, R3 + fan-out
      and drift re-run); recorded, not enforced.
      verify: a shadow record lists the class and the depth chosen per call.
- [ ] **3.5 Counts are lower bounds.** Every usage list is paired with a text
      search for the name: "known places N (+M only by text search)";
      differences are logged as reader gaps.
      verify: a planted dynamic usage appears in M, not in N.
- [ ] **3.6 Update after acting.** Touched files are re-read into the overlay,
      drift recomputed for touched facts only; a completion line names the
      verified sha and dirty flag.
      verify: after editing a fixture the map shows the new fact without a full
      rebuild.
- [ ] **3.7 Verified context pack.** From task text and working diff, seeds
      (ambiguous ones refused) are walked seed-first within a token budget,
      confirmed, and returned with `at=file:line` per item — a CLI verb and a
      `graph_query` mode; the pre-tool hook stays a state line (bundle budget).
      verify: a planted task's pack holds its affected set within the budget.
- [ ] **3.8 Amend the rule.** `external-code-graph-interop`: find with the map,
      confirm with the source, update after the change; its routing evals gain
      "fresh graph, missed dynamic usage".
      verify: the rule text and its eval fixture carry the three-step order.
- [x] **3.9 Record the principle.** A new ADR: the graph is an index, never the
      truth; one folder per home; amends ADR-297 and ADR-299 wording; quotes the
      owner's turn 13.
      verify: the ADR exists, links both, and passes the ADR evidence gate.

## Phase 4 — Lanes

- [ ] **4.1 Data.** Readers T1–T4 (migrations, committed dumps, user-produced
      schema-only snapshot, framework oracle output files); column-level
      `reads`/`writes` from code; drift DR-1…DR-13 (code relation without FK ·
      FK without code relation · model without table · missing target or pivot ·
      FK type ≠ key type · FK without leading index, engine-aware · SET NULL on
      NOT NULL · CASCADE from a soft-deleting parent · app delete hooks plus DB
      cascade · FK before its target table · intended ≠ actual · redundant index ·
      implied relation as suggestion only), with exemptions (polymorphic,
      cross-connection, no-FK mode, declared virtual); Mermaid per cluster; fix
      proposals only.
      verify: the P1 fixture yields DR-1 on `comments.post_id`, DR-3 on `Tag`,
      DR-4 on `post_tag`.
- [ ] **4.2 History.** Co-change pairs from the existing `git log` pass
      (window, size cut, minimum count and strength as data); `hidden
      dependency` = coupled with no static edge; renames followed for files the
      map shows.
      verify: this repository lists at least one hidden-dependency pair with
      both witnesses; a planted fixture pins the rule.
- [ ] **4.3 Decisions.** ADR files become `decision` nodes (status, date,
      supersedes/superseded-by with a direction test); `governs` only for a
      unique path-qualified mention.
      verify: a superseded ADR fixture produces the edge in the right direction.
- [ ] **4.4 Flows.** From declared entry points (routes, CLI commands, jobs,
      listeners, schedules) with depth, branch and size caps and overlap dedup,
      extending request paths into tables, operations and environments.
      verify: a job fixture reaches its table.
- [ ] **4.5 Review-risk verb.** Diff hunks → symbols → callers within two hops,
      entry points and flows hit, missing co-change partners, area crossings,
      columns/operations/pipelines touched — a transparent sum, each term shown.
      verify: a planted diff lists every term with its witness.
- [ ] **4.6 Delivery.** One workflow model for GitHub Actions and GitLab CI
      (jobs, `needs`, `uses`, `workflow_run`, environments, paths filters,
      permissions, action pinning) on the shared reader; branch → environment;
      build → image → deploy chain; review environments; drift DL-1…DL-5
      (unpinned action · write-all permissions · environment without protection
      reference · deploy job without a needs-chain from tests · paths filter
      that excludes the changed files of its own trigger).
      verify: a workflow fixture yields the job graph and one finding per class.
- [ ] **4.7 Runtime.** Compose services, images, published ports, networks,
      volumes, env **names**; Dockerfile base images and exposed ports;
      devcontainer; Make/Task targets; Terraform by line rules with a per-provider
      node-vs-edge mapping file and generic fallback; Kubernetes manifests with
      explicit-reference, label-selector and owner edges; configured vs resolved
      (from a user-produced `docker compose config` file); hostnames, IPs and
      account ids redacted in output; drift RT-1…RT-6 (port collision · service
      image engine ≠ data-lane engine · env name used in code but absent from
      compose/example · published DB port · `latest` tag · resource referenced
      but undeclared). The `planned` infrastructure row of the provider coverage
      catalog becomes `partial` with its stated limits.
      verify: a compose + Terraform fixture yields services, ports and resources,
      and the database image sets the data lane's engine.
- [ ] **4.8 Interfaces.** Call sites (HTTP clients, SOAP with WSDL, GraphQL
      documents, gRPC stubs, SDK constructors); contracts in the repo (OpenAPI,
      WSDL/XSD with entity expansion disabled, GraphQL SDL, `.proto`, request
      collections, `.http`); configuration names only; `service`/`operation`
      nodes with protocol and parameters; drift IF-1…IF-8 (call not in contract ·
      contract operation never called · parameter mismatch · literal base URL or
      credential in code · outbound call without timeout · user value into host
      or path → threat model · webhook without signature check → threat model ·
      one service via two config names).
      verify: the P5 fixture yields service `partner` bound to `PARTNER_URL`,
      the SOAP operation `GetStock`, and no `Comment::post` edge.
- [ ] **4.9 Hub facts.** Published host-port collisions across registered
      projects; shared images and shared external services; cross-project
      service map (HTTP client in one project matched to a route of another by
      normalised path, prefix aliases and verb; unique match only, otherwise an
      unmatched reason) — names and paths, hub only.
      verify: two fixture projects produce one matched call and one unmatched
      reason, and nothing of it reaches a repository map.

## Phase 5 — One folder, one interface

- [ ] **5.1 One layout.** `agents/map/` holds `index.html`, `MAP.md`,
      `manifest.json` (generation, sources, freshness per area), `code/`,
      `data/`, `interfaces/`, `runtime/`, `delivery/`, and `.build/` for graph,
      SQLite, overlay and tombstones (the only gitignored part); the hub mirrors
      it under the user-global home with `projects/`. The old cache path is read
      as a fallback for one release.
      verify: a fresh build writes only inside the two layouts.
- [ ] **5.2 Writer gate.** A check fails any code path that writes a graph, map
      or cache outside the two layouts.
      verify: the gate is red on a planted writer and green on the tree.
- [x] **5.3 The design shell.** Header with logo, `KNOWLEDGE MAP` wordmark, the
      eight-area nav, commit and freshness chips, search across every kind,
      Export, theme and language toggles; rails with pin/unpin as shipped;
      hash router; shared detail panel with witness and confirm state.
      verify: the render check passes at 1440, 375 and 320 px in both themes.
- [x] **5.4 Code area.** The Workbench refinements: languages stack, health
      points per part and the largest lever, empty-state lists, deselect,
      footer aggregation chip — keeping every shipped decision of DEC-2.
      verify: the render check passes and the 13 shipped decisions are unchanged.
- [x] **5.5 Overview area.** Map home: per-area freshness, coverage and trust
      states (fresh, stale, contradicted, unverifiable, incomplete), provenance
      labels, entry points into each area.
      verify: a fixture map shows each area's state with its reason.
- [ ] **5.6 Data area.** ERD (tables, columns, keys, actions; code ∣ intended ∣
      actual overlay), ORM relations, drift list with witnesses, model ↔ table
      ↔ request-path links.
      verify: the P1 fixture map shows the three drift findings with witnesses.
- [ ] **5.7 Interfaces area.** Services, operations with protocol filter,
      parameters and configuration names, callers linked to Code, contract
      drift.
      verify: the P5 fixture map shows `partner` and `GetStock` with callers.
- [ ] **5.8 Runtime and Delivery areas.** Infrastructure resources and
      environment comparison; local environment (services, ports), pipeline
      graph, build → image → deploy chain, drift.
      verify: the runtime and delivery fixtures render their facts.
- [ ] **5.9 Impact area.** Change preview from the working diff: affected code,
      columns, operations, pipelines, the review-risk terms, and the confirm
      state of each.
      verify: a planted diff renders its affected set.
- [ ] **5.10 Agent area.** Context pack, review risk, the verb list with what
      each answers; `explain` names the existing graph verb.
      verify: the area lists the verbs that exist and nothing that does not.
- [ ] **5.11 Hub with the same shell.** The estate map is rendered by the
      shared shell with a Projects area and per-project links; the separate
      estate renderer is retired; the work-tree refusal stays.
      verify: the hub renders and still refuses a git work tree.
- [ ] **5.12 Navigation from facts.** Overview → area → file drill-down with a
      breadcrumb, presets that only filter kinds, a freshness banner with reason,
      tours as templates over facts with input hashes, collapsed super-nodes
      above a measured node threshold.
      verify: a tour step turns stale when its input fact changes.

## Phase 6 — Measure

- [x] **6.1 Task set T.** 20–30 planted in-repo tasks across code, data,
      interfaces, runtime and delivery, each with its affected set and a hidden
      check.
      verify: every task's hidden check fails on the unmodified fixture.
- [ ] **6.2 Three-arm run.** Vanilla, AC without map facts, AC with map facts +
      confirm; M1 wrong changes, M2 dependency recall/precision, M3 cost per
      successful task (failed runs counted), inside the per-run budget; the
      result is published whatever it says.
      verify: the result file holds all three arms and the budget spent.

## Phase 7 — Docs follow code

- [ ] **7.1 Describe the surface.** README map section, `code-intelligence`,
      `database`, `openapi`, `docker`, `terraform`, `github-ci` skill bodies,
      CLI and MCP tool docs, CHANGELOG entry.
      verify: every new verb and mode is named in its doc.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Breadth on a shaky base | implementation | Lanes inherit the base defects and multiply them | Phase 1 lands first; the correctness suite runs in CI | Phase 1 — Correct the base |
| 2 | Verification makes AC slower | implementation | confirm loads the graph per edit | span reads through SQLite, p95 budget test, depth by class in shadow | Phase 3 — Verify before acting, update after |
| 3 | Seven lanes become seven systems | implementation | each lane grows its own store and drift pass | one fact shape, one vocabulary file, one drift engine | Phase 2 — One fact layer |
| 4 | A reader leaks secrets or client names | product | env values, hostnames or other projects reach a committed map | names only, redaction, hub-only projects, work-tree refusal kept | Phase 4 — Lanes |
| 5 | The design is copied where main was already right | product | logo, flyouts and no-data states regress | DEC-2 list checked in 5.4 | Phase 5 — One folder, one interface |
| 6 | The map grows the token bill | product | facts become standing payload | no standing payload; context pack under a budget; M3 measured | Phase 6 — Measure |

## Acceptance Criteria

- [ ] AC-1 — The P1, P2 and P5 fixtures produce the expected facts: `User`
      persists to `users`, `invoices` on `tenant`, no dropped table, DR-1 on
      `comments.post_id`, DR-3 on `Tag`, DR-4 on `post_tag`, service `partner`
      with `PARTNER_URL`, operation `GetStock`, no `Comment::post` edge.
- [ ] AC-2 — Deleting a migrated column without a rebuild yields `gone` with a
      tombstone, and an added column shows as `added`.
- [ ] AC-3 — `confirm` p95 ≤ 50 ms for ≤ 20 witnesses on this repository, with no
      full-graph load on its path.
- [ ] AC-4 — Every graph, map and cache sits in one of the two layouts; the writer
      gate is green on the tree and red on a planted writer.
- [ ] AC-5 — The map renders the eight areas from real facts or with "no data
      yet" and a reason, at three widths and both themes; the DEC-2 decisions
      are unchanged.
- [ ] AC-6 — No code path opens a network connection to a database, cloud,
      daemon or external endpoint, or reads a `.env` value.
- [ ] AC-7 — The recall ratchet runs in CI with must-exist and must-not-exist
      facts; every `graph_*` tool has a test against the real SQLite twin.
- [ ] AC-8 — Task set T exists with a recorded three-arm result.
- [ ] AC-9 — Gated catalogue delta ≤ 0 and MCP tool count unchanged.
