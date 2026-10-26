---
complexity: structural
status: ready
tree_pin: dd8ff75c76
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Operator-requested active roadmap (2026-10-26, invocation of /analyze:inbox on inbox-2026-10-ba: 'danach arbeite die roadmaps ab mit /roadmap:process-full … erstelle am ende einen pr und merge ihn'). Owner search first: `grep -rlF -e 'lockfile' -e 'branch manifest' -e 'domains:' -e 'introduced_by' -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs` over the whole roadmap tree finds no owner of a systems, provenance, domain or branch lane; the predecessor that owned the map, road-to-a-map-the-agent-checks-before-it-acts, is archived. The run archives this file in the same PR when it closes, so the active count returns to 4 at merge."
estate_growth_exempt: "Active roadmaps 4 -> 5 while this PR is open, by the operator's explicit request to execute it in the same run; archived in the same PR, so main's count does not change at merge."
relates:
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Owns classify_change_risk's table. Domain crossings here are shown as a review-risk term and never edit that table."
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns the comparator benchmark. The fixtures here measure this roadmap's lanes and touch none of that corpus."
---
# Road to a map across systems, branches and time

> **Source:** `agents/tmp.old/inbox-2026-10-ba/` — one owner transcript (three
> owner turns, 2026-10-26), two revisions of an externally drafted plan (v6
> systems and branches, v7 domains), and one repo-native proposal (v12) whose
> rounds 1–3 already shipped as the archived predecessor
> `road-to-a-map-the-agent-checks-before-it-acts`. Only rounds 4–6 are new
> here. Re-verified against `main@dd8ff75c76`.
>
> **The owner's demands, in order:** (turn 1) a graph of the systems
> themselves — which project uses which runtime, framework and package in which
> version, why a package is installed, where and how much of it the code uses,
> what removing it would take; every fact branch-dependent, stale branches
> cleaning themselves up; and the branch chain kept current — `subdev-123`
> checks `dev-123`, which first checks `main`, so nobody develops for weeks
> against an old base. (turn 2) remember which tickets (Linear, Jira and the
> like) built which endpoints and classes — when, why, with which commit and
> PR. (turn 3) record domains in the code graph and show them. The invocation
> adds: commit the uncommitted `agents/map/` from `main`.

## Goal

The map answers four new questions from files and the local git history
alone, each answer carrying its witness: **what runs** (runtimes, frameworks,
packages, why each is installed, where and how much of it is used, what its
removal touches), **since when and for what** (the commit, PR and ticket keys
that introduced and last changed a file, table, column, route or symbol, and
the reverse — what a ticket built), **which business boundary** (declared
domains on every element, with the boundary rules checked), and **on which
branch** (facts per branch without a second graph, self-expiring, and a
parent chain that is checked top-down and brought current where the branches
are the developer's own). Nothing reaches a network for the map; ticket text
is never stored. The committed `agents/map/` contains no gitignored path and
no absolute local path.

## Context — what is true at `dd8ff75c76`

| # | Finding | Evidence |
|---|---|---|
| C1 | File discovery ignores `.gitignore`: the uncommitted map indexes 1,660 ignored files, 1,343 of them under `agents/tmp.old/`, and one import specifier is an absolute path with the user's home directory | `src/scripts/code_graph/build.ts:108-150`; `agents/map/code/map.json` → `model.files[4044].externals` |
| C2 | An offline package inventory exists (npm v2/v3 and Composer locks, manifests, version files, images, CI) with `file:line`, but no edges between packages; yarn, pnpm and bun locks are listed as unsupported | `src/scripts/_lib/advisory_inventory.ts:61-121`, `:326-337` |
| C3 | JS/TS imports of packages bind to `external:<spec>#<name>`; an unresolved PHP `use` of a vendor class leaves no edge at all | `src/scripts/code_graph/build.ts:497-524`, `:556-562` |
| C4 | The history lane reads one bounded `git log` for co-change only; no element carries a commit, PR or ticket | `src/scripts/code_graph/lanes/history/history.ts:113-200` |
| C5 | One ticket grammar exists and is used only to write commits and branches | `src/scripts/_lib/git_convention_grammar.ts:10-62` |
| C6 | `layers.yaml` is a declared grouping with globs, `allow` and a breach count; there is no business axis | `src/scripts/code_graph/map_answers.ts:385-410`, `:448-463` |
| C7 | The graph is one per checkout; no fact knows its branch | `src/scripts/code_graph/graph_home.ts`, `graph_budget.ts` |
| C8 | Freshness asks the remote and resolves the PR base; sync merges the base on request, never resolves conflicts; neither knows a parent chain | `src/scripts/check_branch_freshness.ts:1-60`; `src/scripts/sync_pr_branch.ts:1-40` |
| C9 | `git.update_strategy` is a class-C setting; a key that chooses a mutating git operation is class C by the contract | `docs/contracts/settings-classes.md:535` |

## Decisions

| # | Decision | Alternatives | Reason | Revisit if |
|---|---|---|---|---|
| D1 | One new lane `systems` (kinds `package`, `runtime`; relations `requires`, `declares`) reusing the inventory's readers; no second inventory | extend the advisory module only | the map needs nodes and edges, the advisory needs entries; the lane maps entries into facts and adds the edges | a third consumer of lockfiles appears |
| D2 | Why-installed, usage share and removal plan are **verbs** on the existing `code-graph` CLI, not MCP tools and not skills | new MCP tools; a skill | MCP tool count and the gated catalogue stay unchanged (predecessor AC-9) | a host cannot run the CLI |
| D3 | Usage share only when the package's files are installed; else `surface unknown`. Shown with call sites and the flows that reach them | estimate from docs | a guessed percentage is a false fact (K22) | — |
| D4 | Provenance stays inside the history lane as `history:`-prefixed annotations; precomputed for files, tables and columns; routes and symbols get `last_changed` from one blame per owner file and `introduced` from a bounded line-range history, the rest on demand with a cache | a commit graph as nodes | facts on existing elements (K26) | builds exceed the budget on a large history |
| D5 | Ticket and PR text is fetched only at query time by the user's own tools and never written under `agents/map/`; the map stores keys, numbers, dates and author **names** | caching text in the map | K27, K29; privacy | — |
| D6 | Domains are declared in a `domains:` section of the existing `layers.yaml`, read by the same reader; no rename to `boundaries.yaml` | separate `domains.yaml`; rename with a read-both window | one reader and one file; a rename buys nothing measured (owner decision E25 resolved toward the single file) | the file needs a second hand-written section |
| D7 | A file gets at most one **declared** domain; a file matched by two domain globs is a finding. Routes, tables, packages and tickets may touch several domains — that is information | M:N on files (v7) | a file in two declared domains has no defined owner; the aggregation already gives M:N where it is real | a fixture shows a legitimate shared file the rule misreads |
| D8 | Inferred domains are proposals only: shown in the Domain lens with `source: inferred`, never a breach, never in the context pack | auto-adopt | K30; an inferred boundary would generate false breaches | — |
| D9 | Domain crossings enter review risk as a visible term; `classify_change_risk` is not edited | raise its class | that table is owned by `road-to-a-step-that-costs-what-it-changes` | that roadmap asks for the signal |
| D10 | Branch facts are content-addressed: a fact blob is keyed by reader version, path and git blob hash; a branch manifest maps path → blob hash. Read with `git ls-tree` / `git cat-file`, never a checkout | a graph per branch | K20; two branches differing in three files cost three files | storage per branch is not proportional on the fixture |
| D11 | Branch cache clean-up drops a manifest when the local ref is gone or it was unseen for 30 days; the default branch, `release/*` and branches with a remote-tracking ref are pinned; offline never counts as gone; git refs are never deleted | delete on remote absence | E18; v6 retention rules | the owner wants a different window |
| D12 | The chain cascade has **no new setting**: it merges a parent into a branch only when every commit on that branch since its parent is authored by the current git user, only with a clean tree, only by merge (never rebase), in a temporary worktree for branches not checked out — and never pushes. Any other branch gets a report, and its children are not integrated past it (K23) | `git.cascade: auto/ask/report` (E19) | a key choosing a mutating git operation is class C (C9); the Hard Floor keeps every push behind this-turn confirmation, so `auto` could only ever mean a local merge — which is what this does without a key | the owner wants pushes automated |
| D13 | A branch's parent is resolved: open PR base (the freshness gate's resolver) → `branch.<name>.agentConfigParent` in local git config → unknown, reported with the command to record it | merge-base heuristics | merge-base does not name a parent (v6 § 7) | — |
| D14 | The chain check runs inside the existing detached code-graph refresh (session start) and as a warning line of the pre-push freshness gate; no new hook concern | a new session-start concern | the hook bundle has no headroom; the refresh already runs detached | a host has no refresh |
| D16 | Closure pass: the `typed-op` hits on `merge`/`push` in the estate notes, step 2.1, step 5.4 and AC-6 name git history formats or the operator's own instruction, not an operation this roadmap performs; the only mutating git operation it performs is D12's local merge, which the owner asked for in turn 1, and it never pushes | ask the owner per hit | the owner's own words decide it (turn 1) | the cascade gains a push |
| D15 | The map discovery uses `git ls-files --cached --others --exclude-standard` inside a git work tree and falls back to the walk outside one | a hand-written gitignore matcher | git is the authority on what it ignores | — |

## Phase 0 — A map that can be committed

- [x] **0.1 Discovery honours `.gitignore`.** Inside a git work tree the file
      walk keeps only paths `git ls-files -co --exclude-standard` lists (one
      call, NUL-separated); outside one, the walk is unchanged. Untracked,
      unignored files stay in (the working-tree overlay depends on them).
      verify: a test with an ignored directory and an untracked file shows the
      first absent and the second present.
- [x] **0.2 No absolute specifier leaves the build.** An import specifier that
      is an absolute path becomes `external:<absolute>` — the build is pure and
      has no root to make it relative against, and a name on one machine's disk
      is no package anyway.
      verify: a test with an absolute import finds no `/` at the start of any
      external in the map model.
- [ ] **0.3 Commit the map.** Rebuild `agents/map/`, assert no listed path is
      ignored and no `/Users/` or `/home/` string remains, and commit it.
      verify: `git check-ignore` over the map's file list prints nothing.

## Phase 1 — Systems: what runs and why

- [x] **1.1 Package graph from lockfiles.** npm v2/v3 (`dependencies`,
      `optionalDependencies`, `peerDependencies`, dev flag), Composer
      (`require`, `require-dev`), pnpm (`importers`, `packages`/`snapshots`),
      yarn v1 and berry, `bun.lock`; `bun.lockb` and npm v1 are skipped with a
      reason. Facts `package:<eco>:<name>@<version>`; `requires` between
      packages; `declares` from the manifest that roots a package, with scope.
      verify: fixtures for each lockfile give the expected edges.
- [x] **1.2 Runtimes and frameworks.** One `runtime` fact per runtime with
      every witness side by side (declared, lockfile platform, image, CI,
      version file), never merged; a framework is a package flagged from a
      fixed list with its locked version.
      verify: a fixture with Dockerfile PHP 8.2 and `composer.json` `^8.3`
      yields both witnesses and one disagreement finding.
- [x] **1.3 Why installed.** `code-graph why <package>` lists every path from a
      root declaration to the package, shortest first, bounded, offline.
      verify: the fixture answers a transitive package with its two paths.
- [x] **1.4 Where used.** JS through `external:`; PHP through each locked
      package's `autoload` prefixes matched against the file's `use` names;
      non-import uses from manifest scripts, CI `run` lines naming a package
      binary, tool-config files and framework auto-discovery
      (`extra.laravel.providers`).
      verify: a package used only in a CI step is not reported unused.
- [x] **1.5 How much is used.** `code-graph usage <package>`: with the package
      installed, distinct used names ÷ public surface (JS type declarations or
      exports, PHP public classes under its autoload roots), with call sites
      and the flows reaching them; without, `surface unknown`.
      verify: installed and not-installed fixtures give a share and
      `surface unknown`.
- [x] **1.6 Removal plan.** `code-graph remove-plan <package>`: call sites,
      config and script references, dependents that require it, packages that
      would leave with it — a proposal with witnesses, never a verdict.
      verify: the fixture lists the orphaned transitive package.
- [x] **1.7 Systems drift rules.** Used but undeclared, declared but unused
      (after non-import uses), dev package in production code, runtime
      witnesses that disagree, one package in two majors across workspaces —
      as data in the one drift engine.
      verify: each rule has a red and a green fixture.
- [x] **1.8 Systems area and hub matrix.** A Systems area (runtimes →
      frameworks → packages → paths and call sites) and, in the hub, a version
      matrix across projects from name + version facts.
      verify: the map renders the area from the fixture; the hub test shows two
      projects' versions of one package.

## Phase 2 — Provenance: since when and for what

- [x] **2.1 One extended history pass.** The pass reads sha, date, author
      name, subject and body, follows renames, attributes commits to PRs
      (first-parent merges `Merge pull request #N`, squash `(#N)`, GitLab
      `See merge request !N`) and extracts ticket keys with the existing
      grammar from branch name, subject and body. Files get
      `history:introduced_*`, `history:last_*` and `history:changes`.
      verify: the AC-6 fixture.
- [x] **2.2 Elements.** Tables and columns take the introduction of the
      migration that created them; routes take `introduced` and `last_changed`
      from a bounded line-range history of their declaring line (a count
      budget, so a redraw writes the same bytes; the rest is named as a gap);
      symbols are read on demand by `code-graph provenance`.
      verify: the fixture's route reports its PR and ticket.
- [x] **2.3 `code-graph provenance`.** For an element: introduced, last
      changed, tickets, PRs, a timeline (on demand, cached by blob hash and
      span under `.build/`). For a ticket key or `#N`: what it introduced and
      what it touched.
      verify: searching the fixture's ticket lists the route, the table and the
      controller.
- [x] **2.4 History in the map.** Every detail panel gets a History section;
      the shared search finds ticket keys and `#N`.
      verify: a viewer test opens a route and reads its ticket.
- [x] **2.5 Feeds.** The context pack carries "introduced for KEY, PR #N" for
      an item; review risk lists the tickets whose code a diff touches.
      verify: a pack test shows the provenance line.

## Phase 3 — Domains: which business boundary

- [ ] **3.1 Declared domains.** `domains: [{name, paths, owner?, parent?, public?}]`
      and `domain_allow:` in `layers.yaml`, same reader and glob engine; plus
      structure the code declares (`app/Domain/<X>`, `src/Domain/<X>`,
      `Modules/<X>`, workspace packages), each with its witness, used only
      when no `domains:` section exists. A domain without `owner` takes the
      `CODEOWNERS` owner of its paths when one rule covers them all.
      verify: a fixture file gets its domain; a file in two globs is one
      finding.
- [ ] **3.2 Attached, not duplicated.** Domain on files and, through them, on
      routes (handler), tables (writers), packages (call sites), tickets
      (touched files).
      verify: the fixture's table reports both writing domains.
- [ ] **3.3 Boundary rules.** Cross-domain edge not allowed; a table written
      by more than one domain; reaching a non-public file of another domain;
      cycles between domains — each with both witnesses.
      verify: AC-8 fixture.
- [ ] **3.4 Inferred proposals.** Without a declaration, proposals from areas
      and co-change, labelled `inferred`, with a ready snippet; never a breach.
      verify: AC-9 fixture.
- [ ] **3.5 Domain lens and overview.** A Domain lens beside Area and Layer,
      a domain overview with breaches, a domain chip and a search filter; the
      hub links projects only by a name declared in both.
      verify: the map test reads the lens and the overview.
- [ ] **3.6 Feeds.** The context pack names each item's domain and the
      boundaries a change crosses; review risk shows crossings as a term.
      verify: a review-risk test on a cross-domain diff.

## Phase 4 — Every fact knows its branches

- [ ] **4.1 Branch manifests.** `git ls-tree -r` per indexed branch into
      `.build/branches/`; fact blobs for the file-local readers — packages,
      migrations, and the per-file code extract (symbols, routes) — keyed by
      reader version, path and blob hash, read with `git cat-file`.
      verify: two fixture branches differing in three files add three blobs.
- [ ] **4.2 Which branches.** The current branch, its parent chain, branches
      checked out in the last window (reflog), and any branch named on request.
      verify: a fixture chain is indexed without a checkout.
- [ ] **4.3 Branch queries.** `--branch` on the systems verbs, `code-graph
      branches`, `code-graph on-branches <fact>` and `code-graph branch-diff A B`
      (manifest diff → fact diff).
      verify: `tests/scripts/code_graph/branches.test.ts` answers a column and a
      package version per branch with no checkout.
- [ ] **4.4 Clean-up by itself.** D11 rules; unreferenced blobs swept in the
      same pass; never a git ref.
      verify: an expired fixture branch disappears with its blobs; a pinned one
      stays.
- [ ] **4.5 Branches in the map.** A branch panel: indexed branches, their
      parent, and the package and column differences from the current branch.
      verify: the map test reads a difference.

## Phase 5 — Keep the branch chain current

- [ ] **5.1 Lineage.** D13; `branch_chain parent --set <branch>` records it.
      verify: a three-level fixture resolves its chain.
- [ ] **5.2 Read-only check.** `branch_chain status`: top-down, each level
      against its parent, remote SHAs when reachable and `unverified` offline.
      verify: `tests/scripts/branch_chain.test.ts` reports the lagging level and
      `unverified` with no remote.
- [ ] **5.3 Cascade.** `branch_chain sync` per D12: root first, own branches
      merged, foreign ones reported, no integration past a lagging foreign
      parent, no push, conflicts stop and name their paths.
      verify: `tests/scripts/branch_chain.test.ts` integrates an owned parent
      first, reports a foreign one, and leaves every remote ref unchanged.
- [ ] **5.4 Early warning.** Files, tables, columns, packages and routes
      changed both by the parent since the merge base and by this branch.
      verify: the fixture warns on the shared column.
- [ ] **5.5 Wiring.** D14: the detached refresh writes the chain status beside
      the map and the map shows it; the pre-push freshness gate prints one
      warning line when a parent lags.
      verify: the refresh test writes the status file.

## Phase 6 — Measure

- [ ] **6.1 Fixtures as the acceptance set.** One fixture repository per lane
      (systems, provenance, domains, branches, chain) built in a temp dir by
      the tests, so every criterion below runs in CI.
      verify: the five suites pass.
- [ ] **6.2 Cost.** Build time and storage on this repository with and without
      the new lanes, and storage per extra branch; recorded in the evidence
      file, positive or not.
      verify: the evidence file exists with both readings.

## Phase 7 — Docs follow code

- [ ] **7.1 Describe the surface.** README map section, `code-intelligence`,
      the CLI help, and `MAP.md`'s area list name the new verbs and areas.
      verify: the help test lists every new verb.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Build time | implementation | Five new readers and a full history pass make every map build slower | Time budgets per reader, bounded passes, cost recorded in 6.2 | Phase 6 — Measure |
| 2 | False "unused" | product | A package used only dynamically is reported removable | Non-import uses first; removal is a proposal; usage without installed files is `surface unknown` | Phase 1 — Systems: what runs and why |
| 3 | Cascade damage | implementation | An automatic merge lands in someone's branch or loses work | Own-branch test by author, clean tree only, merge only, temporary worktree, no push, conflicts stop | Phase 5 — Keep the branch chain current |
| 4 | Leaks through the committed map | product | Ignored files, local paths or ticket text reach a public tree | 0.1–0.3 guards; D5 | Phase 0 — A map that can be committed |
| 5 | Domain noise | product | Inferred domains read as rules and flood breaches | D8 | Phase 3 — Domains: which business boundary |

## Acceptance Criteria

- [ ] AC-1 — The committed `agents/map/` lists no gitignored path and contains
      no absolute home path.
- [ ] AC-2 — For a fixture with npm and Composer locks, `why` returns every
      path to a root declaration, and a PHP `use` of a vendor class binds to
      its package through `autoload`.
- [ ] AC-3 — A package used only in a CI step or a tool config is not reported
      unused; a share is shown only with the package installed.
- [ ] AC-4 — Runtime witnesses that disagree are shown side by side with one
      finding, never one merged number.
- [ ] AC-5 — Each systems drift rule has a red and a green fixture.
- [ ] AC-6 — In a fixture with branch `ABC-12-orders`, a merge commit for PR
      #7 and a squash commit `feat: status (#9)`, the route reports ABC-12 /
      PR #7 with date and commit, the column reports PR #9, and `ABC-12` lists
      the route, the table and the controller.
- [ ] AC-7 — No ticket text and no e-mail address appears under `agents/map/`.
- [ ] AC-8 — With `domains: Orders, Billing` and `domain_allow: {Billing:
      [Orders]}`, an Orders → Billing call is one breach with both witnesses; a
      table written from both domains is one finding; files outside every glob
      show as no domain.
- [ ] AC-9 — Without a declaration, proposals appear only in the Domain lens
      with `source: inferred` and never as a breach or in the context pack.
- [ ] AC-10 — Two branches differing in three files add three fact blobs;
      an expired branch disappears with its unreferenced blobs; a pinned one
      stays; no git ref is deleted.
- [ ] AC-11 — "On which branches does column C exist" and a package version
      per branch are answered from manifests without a checkout.
- [ ] AC-12 — In a chain main → p → c with p behind main: p owned → p is
      integrated first, then c; p foreign → c gets a report and no direct
      integration of main; nothing is pushed.
- [ ] AC-13 — Gated catalogue delta ≤ 0 and MCP tool count unchanged.
