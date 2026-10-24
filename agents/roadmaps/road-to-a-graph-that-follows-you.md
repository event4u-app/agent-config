---
complexity: structural
status: ready
execution:
  mode: autonomous
owner: maintainer
estate_offset_exempt: "Inbox round inbox-2026-10-ae, one topic folder (global graph + source lineage). grep -rlF -e 'refresh-tmp' -e 'graph_json' -e 'graphHome' -e 'estate index' -e 'lineage.jsonl' -e 'sources.jsonl' -e 'NATIVE_CACHE_REL' -e 'projects.json' over agents/roadmaps/*.md, later/ and stubs/ on 2026-10-24: no hit. road-to-code-graph-refresh-during-a-session owns the refresh coordinator, not the twin leak or the storage location."
relates:
  - slug: road-to-code-graph-refresh-during-a-session
    relation: disjoint
    note: >
      Both touch `runBudgetedBuild`. That roadmap owns WHEN a refresh runs (one
      coordinator, Windows spawning); this one owns WHAT a refresh leaves on disk
      and WHERE the graph lives. Phase 1 here changes the promotion tail only.
---
# Road to a graph that follows you

> **Source:** `agents/tmp.old/inbox-2026-10-ae/` — a transcript of two owner
> questions plus four supplied plans (two tree-verified against `main@850a21189`,
> two broader proposals). Re-verified against `main@a15a8bbe2f` (17.3.0 plus
> graph-providers phase 2) on 2026-10-24; every `file:line` below is from that
> tree.

## Goal

An agent installed globally answers code-graph questions from any folder: inside a
project that carries `agents/` exactly as today (shared through the repo, byte-identical),
inside a repository without `agents/` with **zero writes into that repository**, and from
outside any project out of a local, never-shared index of the projects the owner has
worked in. Alongside it, one sealed lineage ledger records where every harvested
mechanism came from — adopted, adapted, rejected, already present, missing — keyed by
stable source ids that reveal nothing without the owner's key, and a local delta watch
turns an upstream change on a pinned source into roadmap stubs, never into code.

## Context

The owner asked two things in one chat. First: should AC have a graph on the machine as
well as per project, because the agent is used everywhere and a project does not always
have an `agents/` folder — while the project level stays the way it is shared today.
Second: can our sources be drawn as a graph too — "that feature came from there" —
encrypted, so we can see durably what we have from where, what is still missing, and
plan AC improvements automatically when a source repository updates.

### Verified defects (the inverted harvest)

| # | Defect | Evidence at `a15a8bbe2f` | Verdict |
|---|---|---|---|
| D1 | A refresh leaves its SQLite twin behind. The child build writes `.<base>.refresh-tmp-*.json` and its twin `…refresh-tmp-*.sqlite3`; promotion renames only the JSON and the sidecar, `cleanupTemp` removes only those two. | `src/scripts/code_graph/cli.ts:654-662`, `:739`, `:795-797`; twin path `sqlite_store.ts:74-76` | still-true, **worse than drafted**: this checkout's state dir holds 11 orphans of ~166 MB each (≈ 1.8 GB), state dir 2.3 GB |
| D1b | The draft said the stale real twin serves old data. It does not: `loadSerializedFromTwin` and `openGraphIndex` reject a twin whose recorded `json_size`/`json_mtime_ms` no longer match. The real cost is that the indexed read path silently switches off after every refresh. | `sqlite_store.ts:198-200`, `:343` | never-true as drafted, corrected |
| D2 | The twin stores the whole graph a second time as `meta.graph_json`. | `sqlite_store.ts:123`, read back at `:203`, consumed by `query.ts:146` | still-true |
| D3 | `build` and `map` always write into `<root>/agents/`. | `detect.ts:230` (`NATIVE_CACHE_REL`), `map.ts:42` (`MAP_DIR_REL`), `map.ts:313`, `refresh_lock.ts:23` | still-true |
| D4 | MCP graph tools know only the server root. | `mcp_server/graph_tools.ts:69-91` (`noGraph`, `withGraph`) | still-true |
| L1 | All 18 idea-harvest rows are `opaque:` and carry no pin; the opaque form is accepted without a revision. | `lint_harvest_provenance.ts:89`; `provenance/harvests.jsonl` 18/18 `opaque:` | still-true |
| L2 | No stable source identity: `ENC1` is salted per call, `SourceCodebook` numbers `S1…` afresh each round. | `_lib/link_crypto.ts:108-114`; `network_sources.ts:209-226` | still-true |
| L3 | Only `adopt`/`adapt` may be recorded. | `schemas/provenance-harvest.schema.json:35-36` | still-true |
| L4 | Six provenance stores, no join between them. | `provenance/borrows.jsonl` (5), `provenance/harvests.jsonl` (18), `agents/settings/contexts/skills-provenance.yml` (9), corpus manifests, `ENC1:` links in roadmaps, `agents/.harvest-local/` | still-true |
| L5 | The one store with pins is read by no script, `last_verified` 2026-05-08/09. | `grep -rln skills-provenance src/scripts` → `_lib/link_crypto.ts` only | still-true |
| — | A user-global project list already exists (advisories `projects.json`). | `advisories.ts:87`, `:367-385` | still-true — one registry, not two |

## Phase 1 — Stop the twin leak

- [x] **1.1 Promote or remove the refresh twin.** In `runBudgetedBuild`, rename <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/cli.ts -->
      `sqliteTwinPath(tmpOut)` to `sqliteTwinPath(out)` together with the JSON and the
      sidecar, and make `cleanupTemp` remove the temp twin and its `.tmp-<pid>` file too.
      The renamed twin's recorded `json_size`/`json_mtime_ms` must match the promoted
      JSON — a rename preserves mtime, so assert it rather than assume it.
      verify: `npx vitest run tests/scripts/code_graph_refresh.test.ts` -> /passed/ with a new case — two budgeted
      refreshes leave exactly one `*.sqlite3` in the state dir and `openGraphIndex` opens it.
- [x] **1.2 Sweep orphans a crashed refresh left.** On the next refresh, delete every <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/cli.ts -->
      `.*.refresh-tmp-*` file in the state dir whose owning pid is not alive and whose
      mtime is older than the refresh lock's stale threshold, so a SIGKILLed child cannot
      leak forever.
      verify: a test seeds two orphans (one live-pid, one dead-pid-and-old) and asserts
      only the dead one is removed.
- [x] **1.3 Drop the duplicate graph blob.** Stop writing `meta.graph_json`; keep the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_graph_feeder_latency.ts -->
      row tables, counts and `source_checksum`. `loadSerializedFromTwin` and its caller in
      `query.ts:146` fall back to reading the canonical JSON, which is the same bytes.
      Bump `GRAPH_STORE_VERSION` so an old twin is rebuilt, not misread.
      verify: the code-graph test suite passes unchanged in its answers; a built twin for
      the fixture repo is smaller than before and has no `graph_json` key.

## Phase 2 — A graph home for folders without `agents/`

- [x] **2.1 Record the decision.** Write an ADR (via `adr-create`): the project graph <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      stays the only truth; the user-global layer is a *home* for graphs that have no
      project home plus a local *index*, never a merged graph; nothing in it leaves the
      machine; it is lazy per ADR-124; ADR-297's map location gains a fallback. The ADR
      also records the sealed-lineage decision of Phase 7-9.
      verify: `./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions --check` -> 0 and the ADR
      is listed.
- [x] **2.2 One `graphHome(root)` resolver.** A module under `src/scripts/code_graph/` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/graph_home.ts -->
      returning the state dir, map dir and lock dir for a root: `root/agents/` when that
      directory exists or a project install is present (today's paths, unchanged);
      otherwise `event4u_root()/runtime/graphs/` plus the repo id. It never creates
      `agents/`.
      verify: unit tests for both branches, run with `EVENT4U_CONFIG_HOME` pointed at a
      temp dir.
- [x] **2.3 Repo identity.** The repo id is 12 hex of an HMAC, keyed by a random <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/repo_identity.ts -->
      machine-local key created once under `runtime/projects/`, over the canonical origin
      URL: userinfo, tokens and query string removed, host lower-cased, default port, ssh
      and https forms and a trailing `.git` collapsed. No remote → the realpath. A git
      worktree keeps its parent's repo id plus an instance suffix, so writable caches
      never collide and estate queries count one project (council O2).
      verify: tests — https, ssh and `.git` forms give one id; a URL with a token gives
      the same id as without; a moved clone keeps its id; a worktree shares the repo id
      and differs in instance.
- [x] **2.4 Route every reader and writer through it.** `cacheFor` in `cli.ts:135`, <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/code_graph_refresh_hook.ts -->
      `map.ts:313`/`:325`, the refresh lock and marker in `refresh_lock.ts`, `detect.ts`
      and `mcp_server/graph_tools.ts` read their paths from `graphHome`.
      verify: `npx vitest run tests/scripts/code_graph/graph_home.test.ts` -> /passed/ — a case
      greps `src/scripts` for the three constants and finds them only in `graph_home.ts`
      and their definitions; a build in this repo yields
      byte-identical paths to today.
- [x] **2.5 Zero writes into a foreign repo.** End-to-end test: `git init` a fixture with <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      one source file and no `agents/`, run `code-graph build` and `code-graph map`, then
      assert `git status --porcelain` is empty and the graph sits under the temp home.
      verify: the new test passes; it fails when `graphHome` is short-circuited to the
      in-repo branch.

## Phase 3 — One project registry

- [x] **3.1 A shared registry module.** `src/scripts/_lib/project_registry.ts` owns <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/project_registry.ts -->
      `event4u_root()/runtime/projects/registry.json`, keyed by repo id:
      root, remote, fingerprint, last seen, graph home, graph commit, languages,
      providers, pinned. Writes are atomic.
      verify: unit tests for record, read, atomic write and a corrupt file read as empty.
- [x] **3.2 Advisories reads and writes through it.** `recordProjects`/`knownProjects` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/advisories.ts -->
      in `advisories.ts:367-385` become wrappers; the old `runtime/advisories/projects.json`
      is read once as a fallback and migrated.
      verify: the advisories tests pass unchanged; a fixture with only the old file yields
      the same `--all-projects` root list.
- [ ] **3.3 Registration by use, never by crawl.** A `code-graph build` or `refresh`
      records its root. `code-graph projects list|add|remove|prune` manage the list by
      hand. No code path walks `$HOME`.
      verify: tests for the four verbs; a test asserts the registry module never calls
      a recursive directory walk.

## Phase 4 — An estate index, not a merged graph

- [ ] **4.1 Opt in per machine.** `code-graph projects index on|off` stores the switch
      in the registry; off is the default, because the index carries client project
      paths. With it off, nothing below runs.
      verify: a test asserts that with the switch off a refresh writes no index file.
- [ ] **4.2 Packages and exports per project.** When a registered project's graph is
      refreshed and the switch is on, write its rows into
      `runtime/projects/index.sqlite3`: declared packages from the manifests the
      providers already recognise (`package.json`, `composer.json`, `pyproject.toml`,
      `requirements*.txt`, `go.mod`, `Cargo.toml`, `Gemfile`), the package names it
      publishes, and its top-level exported symbols only.
      verify: fixture repos for npm and composer produce the expected rows; a project's
      rows are replaced, not appended, on its next refresh.
- [ ] **4.3 Cross-project edges, honestly labelled.** `xedges` with `via` one of
      `package` (declared dependency on a package another registered project publishes),
      `unique-name` (exactly one exporting symbol estate-wide), `mention` (a registered
      project's name in code). Only `package` is a solid edge; the other two carry the
      graph's existing guess semantics.
      verify: fixtures — a real path dependency yields `package`; two projects exporting
      the same name yield no `unique-name` edge.
- [ ] **4.4 Size stays small.** The index stores packages and exports only, so it
      must stay under 2 % of the summed project graph JSON sizes.
      verify: `npx vitest run tests/scripts/code_graph/estate_index.test.ts` -> /passed/ — a case builds
      the three-project fixture estate, divides `index.sqlite3` bytes by the summed graph
      JSON bytes, and fails above 0.02.

## Phase 5 — Answering without a project

- [ ] **5.1 A `project` parameter on graph tools.** MCP graph tools and the CLI accept
      an optional project (repo id, registered name or path) and resolve it through the
      registry and `graphHome`. Default stays the server root.
      verify: a test under tests/scripts/mcp_server gains a case querying a second fixture project by
      id; every existing graph-tool test passes unchanged.
- [ ] **5.2 `noGraph` points at what exists.** In a root without a graph, the answer
      lists matching registered projects instead of only "run build".
      verify: a test with a registry of two projects asserts both appear.
- [ ] **5.3 Estate queries.** `code-graph estate where-used`, `projects-using`, and
      `advisory-impact` (advisory package × index × import edges), plus the matching MCP
      tool. They read the index only, never a project graph JSON.
      verify: a fixture estate of three projects answers "who uses vitest" with the right
      two; a spy asserts no graph JSON is opened.
- [ ] **5.4 Estate map page.** `code-graph map --estate` writes one page under the
      user-global home: projects as nodes, `package` edges solid, guesses dashed. Refused
      when the output path is inside a git work tree.
      verify: render check via `map_verify`; a test asserts the in-repo refusal.

## Phase 6 — Limits and the first measurement

- [ ] **6.1 Storage budget.** `code-graph projects` honours a budget (default 2048 MB,
      stored in the registry) and evicts the least-recently-used global-home graphs —
      a query updates recency, a registry scan does not — never a graph under a repo's
      own `agents/`, never a pinned one, never one whose refresh lock is held (council O4).
      verify: a test fills a temp home past a tiny budget and asserts the oldest unpinned,
      unlocked entry goes and a locked older one stays.
- [ ] **6.2 Stale roots are marked, never silently dropped.** A registered root missing
      for 30 days is flagged by `list` and removed only by `prune`.
      verify: a test with a back-dated `last_seen` and a deleted root.
- [ ] **6.3 Egress never reads the index.** A test greps the telemetry, council,
      self-repair release, advisories report and map export code paths for imports of the
      registry, the index and the local lineage ledger, and fails on a reader.
      verify: the test passes, and fails when a fixture import of the registry is added to
      one of those modules.
- [ ] **6.4 Measure.** Record disk per project before and after Phase 1, refresh time
      added by the index (target ≤ 3 %), `where-used` latency on the fixture estate
      (target < 200 ms), and zero writes into the foreign fixture, in an evidence file.
      verify: `agents/evidence/analysis/graph-home-measurement-2026-10.md` exists with an
      `evidence-type: analysis` marker and every number has its command.

## Phase 7 — A stable source identity

- [ ] **7.1 Keyed source ids.** `link_crypto source-id` returns `src_` plus 10 hex of
      `HMAC-SHA256(link_encryption_key, canonical identity)`. Canonicalization reuses
      `harvest_reference_tokens.canonicalize` so URL variants collapse. The recoverable
      `ENC1` token stays randomized. Without the key the command refuses rather than
      inventing a fresh identity — key loss fails closed (council note on O5).
      verify: tests — same URL twice gives one id; https and `.git` forms give one id;
      without the key the command exits non-zero; the id is not `sha256(url)`.
- [ ] **7.2 Rounds use the stable id.** `SourceCodebook` in `network_sources.ts:209`
      emits `src_…` codes when a key is available; the round's `intake.md` keeps the
      `ENC1` rows. Without a key it keeps today's `S1…` numbering, labelled per-round.
      verify: the network_sources tests pass; a new case asserts two codebooks with one
      key agree on an id.

## Phase 8 — Two ledgers: decisions tracked, sources local

Council decision O5/O6: anything that links a source to a mechanism stays on the
owner's machine; what the repository tracks is source-free.

- [ ] **8.1 The tracked decision ledger.** `provenance/mechanisms.jsonl`: mechanism id,
      verdict (`adopt | adapt | reject | already | gap | deferred`), realised in,
      roadmap, decided at, reason, reopen if. No source id, no pin, no locator. JSON
      schema under `src/scripts/schemas/` with positive and negative fixtures.
      verify: the schema tests pass and a fixture row carrying a `source_id` field is
      rejected.
- [ ] **8.2 Its linter.** `lint_harvest_provenance` also validates `mechanisms.jsonl`:
      `adopt|adapt` need existing `realised_in` paths, `reject` needs a reason,
      `gap|deferred` need a roadmap or `open`, and every harvest citation marker
      resolves against `harvests.jsonl` or `mechanisms.jsonl`.
      verify: the linter's tests cover each rule; `check_no_external_sources` stays green.
- [ ] **8.3 The local source ledger.** `event4u_root()/runtime/lineage/sources.jsonl`
      (source id, kind `repo | url | video | paper`, sealed identity, license, watch flag default off) and `edges.jsonl`
      (source id, mechanism id, sealed pin, sealed locator), with a validator run as
      `code-graph lineage check`, never in CI.
      verify: tests with `EVENT4U_CONFIG_HOME` on a temp dir; a test asserts no path
      under `runtime/lineage/` is ever written inside a git work tree.
- [ ] **8.4 Seed both from what exists.** The 18 `harvests.jsonl` rows yield 18
      `mechanisms.jsonl` rows (verdict and `stated_in` carried over); `harvests.jsonl`
      stays, so every citation keeps resolving. The 9 `skills-provenance.yml` entries are
      imported into the local ledger with their sealed pins; the tracked yml is untouched.
      Opaque harvest refs become local `pin: unknown` edges, never invented pins.
      verify: the tracked decision ledger has 18 rows that pass 8.2; `docs/THIRD-PARTY-NOTICES.md`
      is byte-identical.

## Phase 9 — Drawing the lineage and what is missing

- [ ] **9.1 Lineage queries.** `code-graph lineage of`, `gaps` and `rejected` answer
      from the tracked ledger and resolve `realised_in` through the graph, so a moved or
      deleted file shows as a broken edge; `lineage from` (source → mechanisms) needs the
      local ledger and the key.
      verify: fixture tests for each verb, including a deleted `realised_in` path and
      `from` refusing without a local ledger.
- [ ] **9.2 Gaps view.** `lineage gaps` = `gap` + `deferred` rows − `reject` rows
      without a matching `reopen_if`, each shown with the roadmap that owns it or `open`.
      verify: a fixture where a later `adopt` closes a gap shows it no longer.
- [ ] **9.3 Two map views.** The tracked map gains a lineage view of mechanisms by
      verdict only — no source ids, no per-source counts (council O6). `map --lineage
      --sources` renders the source view from the local ledger into the user-global home
      and is refused inside a git work tree.
      verify: the tracked view passes `check_no_external_sources` and contains no
      `src_`; a test asserts the in-repo refusal.
- [ ] **9.4 Backfill drafts, never rows.** `lineage backfill --draft` decrypts the tree's
      `ENC1` tokens locally into `agents/.harvest-local/`, assigns source ids and proposes
      draft rows only where a Provenance block names a mechanism and a verdict. It writes
      no ledger row; confirming drafts is the owner's step (stub below).
      verify: a fixture roadmap with one clear and one unclear Provenance block yields one
      draft and one "unclear" line; both ledgers are untouched.

## Phase 10 — The upstream delta watch, local and dry-run first

- [ ] **10.1 One watch run.** `code-graph lineage watch --dry-run` per source whose
      watch flag the owner switched on with `lineage watch enable` (off by default,
      council O7): `git ls-remote`; equal to the newest pin → stop; otherwise a shallow
      fetch, a diff restricted to the edges' locators plus a top-level listing diff,
      classified `reverify | drift | candidate | reopen | license-alert`.
      verify: a local fixture upstream with three commits (one touching a locator, one new
      module, one unrelated) reports exactly one `reverify` and one `candidate`; an
      unchanged source costs one `ls-remote`.
- [ ] **10.2 Output is stubs, never code.** A non-dry run writes its report to the
      user-global home and roadmap stubs under `agents/roadmaps/stubs/` naming mechanism
      ids and a fresh `ENC1` locator only — no source id — one report per run, grouped by
      mechanism rather than per commit. It implements and merges nothing, and refuses to
      run when `CI` is set.
      verify: the fixture run writes one stub that passes `check_no_external_sources` and
      contains no `src_`; a test with `CI=true` asserts the refusal.

## Not in scope — decided against, with reasons

| Proposal from the round | Why not |
|---|---|
| One merged machine-wide graph (the supplied broader plan's "machine graph", Source A's merged file) | Duplicates every project graph again (this repo's JSON alone is 85 MB); id prefixing breaks every tool contract; the drafting session measured 0 package edges between 13 local repos. Home + index answers the same questions. |
| Crawling `$HOME` for repositories | Privacy (client projects), cost, surprise. Registration by use or explicit `add` only. |
| A daemon or file watcher | ADR-124 keeps refresh lazy; the index rebuilds on a project's own refresh. The refresh coordinator belongs to `road-to-code-graph-refresh-during-a-session`. |
| Portable graph bundle export/import (`graphbundle`) | The owner's turn keeps sharing at project level "the way it is now" — `agents/map/` in the repo. Revisit if a team asks for a graph without committing it. |
| Multi-device / VPS sync | Paths differ per machine, the content is private, and no owner turn asked for it. |
| A separate SQLCipher vault for provenance | Per-field `ENC1` already seals identities and pins; a native cipher binding is a new dependency with packaging risk across every host for no stated need. Revisit if plaintext ids are ever needed at rest. |
| OS keychain for the link key | The key's home is `secrets.link_encryption_key`, shared by every `ENC1` token in the tree; moving it is its own change with its own threat model. |
| Federated OpenAPI / protobuf / IaC contract linkers | No registered estate carries one today; `package` edges cover the measured coupling. A stub can pick it up when a contract-linked pair exists. |
| Autonomous candidate-to-PR executor, relevance scoring engine | Every adoption is a re-derivation (`code-provenance`); the watch plans, the owner decides. |
| A watch in public CI with the key as a secret | Log leakage; `source-surface-sweep.yml` runs keyless by design. |
| A tracked `sources.jsonl` / `lineage.jsonl` with keyed ids (the drafted plan's Phase 2) | Council O5: ciphertext, keyed ids, relations and commit timestamps in public history stay correlatable permanently. The source side is local; the decision side is tracked. |
| A new top-level `agent-config graph` namespace | `code-graph` already carries every verb; a second namespace is a second set of registrations and docs for the same engine. New verbs go under `code-graph`. |
| Toolchain and device facts in a machine graph | No owner turn asked for them; the registry carries languages and providers per project, which is what the estate queries read. |
| A status vocabulary (`not-registered`, `not-authorized`, …) | The graph tools already return `status` and `staleness`; 5.2 widens the no-graph answer, which is the case the vocabulary was for. |
| Windows-path and network-mount fixtures | The supported-host matrix is the refresh roadmap's (its Windows step); this roadmap's paths go through `path` and `realpath` and inherit that work. |
| Watching articles, videos and papers | Sources of that kind are recorded (`kind`), not watched — there is no pin to compare, and re-fetching prose to diff it is noise without a locator. |
| An outcome ledger ("did the adoption measurably help") | A measurement per adoption needs a benchmark per mechanism, which does not exist; `reopen_if` on a rejection is the revisit path this roadmap can honour. |
| Generating `skills-provenance.yml` from the ledger | The yml is an existing tracked store with sealed pins; the local ledger imports it and leaves it alone rather than widening what the tree tracks. |

## Stubs this roadmap hands to elapsed time or the owner

- `agents/roadmaps/stubs/road-to-lineage-backfill-confirmation.md` — the owner confirms
  Phase 9.4 draft batches; trigger: 9.4 merged.
- `agents/roadmaps/stubs/road-to-a-weekly-lineage-watch.md` — schedule 10.1 locally and
  read its signal after four runs; trigger: 10.2 merged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| O1 | reversible-technical | council:graph-follows-you-closure | Estate index is off by default and switched on per machine (`projects index on`) | unanimous (2/2); the index holds absolute paths of client projects | 6.4 measured and the 6.3 egress test holds |
| O2 | reversible-technical | council:graph-follows-you-closure | Repo id = machine-local HMAC over the canonical, credential-stripped origin URL, realpath without a remote; worktrees keep the parent id plus an instance suffix | unanimous (2/2), amended — plain sha256 of a hosting URL is dictionary-guessable and can hash a token | ids must match across machines |
| O3 | reversible-technical | council:graph-follows-you-closure | JSON stays canonical; the twin drops `graph_json` and stays a disposable, rebuildable projection | unanimous (2/2); `query.ts:146` reads a blob equal to the JSON | JSON parse dominates a measured query |
| O4 | reversible-technical | council:graph-follows-you-closure | 2048 MB default, configurable; LRU eviction of global-home graphs only, skipping pinned and lock-held entries | unanimous (2/2), amended with eviction safety | a typical estate exceeds it on day one |
| O5 | contested-technical | council:graph-follows-you-closure | Source-to-mechanism links, pins and locators stay in a local ledger; the repo tracks a source-free decision ledger (`provenance/mechanisms.jsonl`) | both members chose local-only: encrypted ids, relations and timestamps in public history stay correlatable forever. Dissent on routing only — one member classed it owner-reserved; the chosen option is the stricter one, so it strengthens the confidentiality floor | the owner wants source lineage auditable in CI |
| O6 | contested-technical | council:graph-follows-you-closure | No tracked source view at all; the tracked lineage view shows mechanisms by verdict only | unanimous (2/2) — moot once O5 is local; a per-source list is more identifying than a count | O5 is reopened |
| O7 | reversible-technical | council:graph-follows-you-closure | Watch is off per source until the owner runs `lineage watch enable` | unanimous (2/2); a remote check is observable network activity and needs per-source consent | the weekly-watch stub shows enabled sources produce signal |
| A-2.1 | reversible-technical | agent | 2.1 verify names `--dir docs/decisions`: the generator defaults to `docs/adr/`, which does not exist here, and exits 2 for every argv; the CI step (`rule-backstops.yml`) runs the same command with `--dir docs/decisions` | `./scripts-run src/scripts/adr/regenerate_index --check` -> exit 2 `adr-dir not found: docs/adr` | the generator default moves to `docs/decisions` |
| A-2.4a | reversible-technical | agent | Hooks in the dispatch bundle (context nudge, turn-end feeder, session-start refresh) resolve project homes only (`projectHome`), and `auto-refresh on` refuses a root without one; CLI and MCP use the full `graphHome` | routing the hooks through `graphHome` measured the dispatch bundle at 1,555,029 B against a 1,551,000 B ceiling and the refresh chunk at 21,569 B against 15,400 B (`check_hook_bundle_composition`); project-only routing measures 1,550,405 B and 15,260 B | a raise of the bundle ceiling is ratified, or a foreign-repository user asks for session-start nudges |
| A-2.4b | reversible-technical | agent | Existing test fixtures that model a project gain an `agents/` directory instead of asserting the new user-global branch; the user-global branch is covered by the new graph_home and foreign-repository tests | the fixtures (map, refresh, refresh lock, consumer root, bench) are projects in intent; a bare temp dir is now a foreign root by definition (ADR-299) | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Path parity break | implementation | Routing every reader through `graphHome` changes where this repo's own graph lives, breaking the shared `agents/map/` | 2.4 asserts byte-identical paths for a root with `agents/`; 2.5 tests the other branch | Phase 2 — A graph home for folders without `agents/` |
| 2 | Index leaks client paths | product | The registry holds absolute paths of client projects; a later egress path reads it | 4.1 default off; 6.3 egress test fails on any reader | Phase 6 — Limits and the first measurement |
| 3 | Source fingerprinting | product | A stable id plus per-source counts lets a reader match sources across files | HMAC keyed ids (7.1); source links stay local and the tracked view carries no source id (O5, O6) | Phase 7 — A stable source identity |
| 4 | Fabricated provenance | implementation | Migration or backfill invents pins or verdicts to look complete | 8.3 marks `pin: unknown`; 9.4 writes drafts only | Phase 8 — Two ledgers: decisions tracked, sources local |
| 5 | Twin rename race | implementation | A concurrent reader opens the twin between JSON and twin rename and sees a mismatch | The size/mtime guard rejects a mismatched twin, falling back to JSON — a miss, never a wrong answer | Phase 1 — Stop the twin leak |

## Acceptance Criteria

- [ ] AC-1 — From a folder that is not a project, a global install answers "which of my
      projects use package X" from the index (owner turn 1: "not always in projects").
- [ ] AC-2 — A graph build in a repository without `agents/` leaves `git status` clean
      (owner turn 1: "not always an `agents/` folder").
- [ ] AC-3 — Inside a project with `agents/`, every graph path, map and tool answer is
      byte-identical to today, so sharing through the repo is unchanged (owner turn 1:
      "the project level, as now, to share it").
- [ ] AC-4 — A refresh leaves exactly one twin and no orphan in the state dir.
- [ ] AC-5 — No source identity or pin appears in plaintext in any tracked file;
      `check_no_external_sources` is green (owner turn 2: "of course encrypted").
- [ ] AC-6 — `lineage of` and `lineage gaps` answer from a tracked, source-free ledger
      that records rejections and gaps, not only adoptions, and `lineage from` answers
      the source side on the owner's machine only (owner turn 2: "what we have from
      where", "what is still missing").
- [ ] AC-7 — An upstream change on a pinned fixture source yields a roadmap stub and no
      code change (owner turn 2: "plan improvements automatically on upstream updates").
