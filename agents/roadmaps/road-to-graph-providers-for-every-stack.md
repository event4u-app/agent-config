---
complexity: structural
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap, no new blocker. It delivers the owner's 2026-10-23 rulings on the code graph: a framework-neutral core, a default for every project, and dedicated providers for the most common languages and frameworks."
estate_offset_exempt: "grep -rlF -e laravel_overlay -e buildLaravelOverlay -e overlay -e 'framework-neutral' over agents/roadmaps/*.md, later/ and stubs/ (2026-10-23): no roadmap owns a provider seam or framework coverage for the code graph. later/road-to-a-graph-that-wins owns depends_on and registered benchmarks, later/road-to-stacks-beyond-php owns skills per stack, not the graph. Archiving an unrelated file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: later/road-to-a-graph-that-wins
    relation: extends
    note: "Its Phase 2 owns registered real-repository measurement; the catalog status `verified` (6.1) is earned there. Its step 1.2 `depends_on` (manifests) stays there; the manifest entry mechanism in 3.3 emits entries, not dependency edges. No step of that roadmap is edited."
  - slug: later/road-to-stacks-beyond-php
    relation: disjoint
    note: "Owns per-stack skills under blocker b5; this roadmap adds no skill."
---
# Road to graph providers for every stack

> **Source:** `agents/tmp.old/inbox-2026-10-ac/` — one owner chat and three supplied plans
> (a reviewed overlay draft, revision 3, and two versions of a provider-architecture plan).
> Every tree fact below was re-verified at `main@4502d328f` on 2026-10-23. The external
> reference graph tool stays coded **S1** and the Laravel measurement subject **Fixture L**,
> as in `road-to-a-map-that-draws-itself`.

## Goal

The code graph's core names no framework. Everything a framework links by convention reaches
the graph through a registered provider that is selected by project markers, and a
framework-neutral default runs for every project whether or not a provider matches. Dedicated
providers exist for the most common frameworks on every language the engine parses, plus C#
and Ruby, each proven by a positive and a negative oracle. A catalog states for every
provider what it resolves and how far that is proven, so nothing reads as supported because
it is detected.

## The owner's rulings (2026-10-23), recorded as stated

1. *"Why `laravel_overlay.ts`? We want to support every language and framework. Why exactly
   Laravel? I suspect I don't like this."* (chat, first turn, quoted in English by the draft)
2. Option 1 chosen — a neutral interface plus registry, Laravel one entry — with S1 named as
   the project to orient on. (chat, second turn)
3. `wenn wir spezifische als verbesserung rein packen, dann sollten wir das auf jeden fall für die gängigsten sprachen und frameworks tun. einen default als fallback und dann wirklich für die gängigsten` <!-- md-language-check: ignore -->
   — *if we add specific ones as an improvement, then definitely for the most common
   languages and frameworks: a default as fallback, and then really for the most common
   ones.* (chat, third owner turn)

Ruling 3 is a **constraint**, not a step: it is carried by AC-3 and AC-4. It supersedes
decision E6 and kill-register entry K13 of `road-to-a-map-that-draws-itself` (see 0.1):
a fixture is now what proves a provider, not what permits one.

## Context — reproduced on this tree

| # | Finding | Evidence |
|---|---|---|
| C1 | The Laravel overlay is a fixed import and call: no interface, no registry, no detection. It runs on every project and is inert elsewhere only because nothing matches. | `src/scripts/code_graph/build.ts:20`, `:761` |
| C2 | The map's role rules know Laravel paths, so the core stays Laravel-shaped with C1 fixed. | `src/scripts/code_graph/map_model.ts:215` (`.blade.php`, `resources/views/`), `:219` (`routes/`, `public/index.php`, `artisan`) |
| C3 | Laravel names sit in the graph schema. | `types.ts:94` (`'eloquent-relation'`), `validate.ts:20`, `types.ts:32-36`, `:191`, `:193`, `:270` (`route_builder_call`), `map_model.ts:84` |
| C4 | The docs layer and the SCIP pass are hard-wired the same way, and their order matters: the overlay contests base edges it proves false, SCIP supersedes guesses it duplicates. | `build.ts:773-778`, `:780-790` |
| C5 | The neutrality lint walks `*.md` only, so none of C1–C4 could be caught. | `src/scripts/lint_framework_leakage.ts:565-575` |
| C6 | The trust filter is a denylist: any new `resolved_via` value is accepted as stated by default — backwards once more than one provider emits edges. | `types.ts:156-161`; readers `build.ts`, `verbs.ts`, `map_model.ts`, `scip_reader.ts` |
| C7 | Request paths attribute tables per controller **file**, not per route: `reach` adds every edge of the handler's file. | `map_model.ts:654-657` |
| C8 | Six languages are parsed (php, ts, js, python, go, java; vue via its script block); C#, Ruby, Kotlin and Rust grammars exist in the dev dependency but are not vendored. C# is 3,978,594 B, Ruby 2,106,447 B uncompressed. | `types.ts:336-343`; `src/vendor/grammars/README.md`; `node_modules/tree-sitter-wasms/out/` |

**Claimed, not reproduced here:** what S1 contains at its pin (framework-specific extractors
and a suffix-gated resolver registry, per the draft) — reading it needs network, outside this
run's bound. Nothing below depends on it: the design follows the owner's ruling, not S1's
content. Fixture L's 56.6 % → 11.3 % and 340/340 are re-measured in 0.2, not trusted.

## Phase 0 — Record and baseline

- [x] **0.1 ADR-298: the graph core is framework-neutral; providers sit behind a registry.**
      States the three rulings, the provider kinds (pass, convention provider, default),
      detection by project markers, the fixed relation vocabulary, the explicit trust
      allowlist, and the coverage rule. Reopens E6 and replaces K13 of
      `road-to-a-map-that-draws-itself` with its own `revisit-if` (a provider needs a hook
      the interface lacks; or a framework crosses the usage line in the next survey).
      verify: `./scripts-run src/scripts/adr_cite_check ADR-298` -> 0
- [x] **0.2 Baseline before any code moves.** Build the graph and the map on this repository,
      on Fixture L and on one synthetic non-PHP tree; record the checksums, Fixture L's
      unconnected-file share and route coverage in
      `agents/evidence/analysis/graph-providers-baseline-2026-10-23.md`.
      verify: the evidence file names three checksums and Fixture L's two readings.

## Phase 1 — The seam, byte-identical

- [x] **1.1 An ordered pass registry.** `code_graph/passes.ts` holds `GraphPass { id,
      applies(ctx), run(ctx) → { nodes, edges, contest?, stats } }`, registered in today's
      order: `convention-providers` → `docs` → `scip`. Passes receive read-only views;
      the orchestrator applies results. A throwing pass is recorded in the build result
      with its reason and the build continues.
      verify: a test registers a throwing pass and asserts the visible failure plus an
      otherwise identical graph.
- [x] **1.2 A convention-provider registry with marker detection.** `code_graph/providers/`
      with `index.ts` (registry) and `ConventionProvider { id, detect(probe), build(...),
      roleOf?(path), entryFiles?(files) }`. `ProjectProbe` reads manifests per package root
      (`composer.json`, `package.json`, `pyproject.toml`, `requirements*.txt`, `pom.xml`,
      `build.gradle*`, `go.mod`, `*.csproj`, `Gemfile`), so a monorepo activates providers
      per package and several at once.
      verify: a test with a two-package monorepo fixture activates one provider per package.
- [x] **1.3 Laravel moves behind the seam unchanged.** `laravel_overlay.ts` →
      `providers/laravel.ts`; `detect` = `laravel/framework` or an `illuminate/*` package in
      a `composer.json`, or an `artisan` file, per package root; a provider sees only the
      files under its roots. Logic unchanged; the overlay test's fixture gains the
      `laravel/framework` marker (`corrected-from-reproduction`: without a marker it no
      longer runs, which is the point). `build.ts` imports only `passes.ts`.
      verify: `grep -ciE 'laravel' src/scripts/code_graph/build.ts` -> /^0$/
- [x] **1.4 The map asks providers for roles.** `staticRole` keeps the neutral rules
      (docs, tests, migrations, translations, config, manifest entries) and asks the active
      providers' `roleOf` / `entryFiles` for the rest.
      verify: `grep -cE 'blade|resources/views|artisan' src/scripts/code_graph/map_model.ts` -> /^0$/
- [x] **1.5 Byte identity proven.** Graph and map bytes equal the 0.2 baseline on Fixture L
      and the synthetic tree; every existing code-graph test green. This repository's graph
      differs by its own new sources and by Laravel edges that fixture trees without a
      Laravel marker no longer get (`corrected-from-reproduction`: a byte-identical repository
      graph would mean detection by suffix still ran), counted in the evidence file.
      verify: the Fixture L and synthetic checksums match the evidence file.

## Phase 2 — Names, trust and provenance (schema 6)

- [ ] **2.1 Generic names.** `'eloquent-relation'` → `'orm-relation'`;
      `suppressed_edge_counts.route_builder_call` → `contested_by_provider: { <id>: n }`;
      comments in `types.ts` / `map_model.ts` drop framework names. Every provider edge
      carries `provider_id`. `SCHEMA_VERSION` 5 → 6; the sidecar refusal makes old caches
      rebuild.
      verify: `grep -rc 'eloquent-relation' src/scripts/code_graph/types.ts` -> /^0$/
- [ ] **2.2 Trust is an allowlist.** `STATED_RESOLVED_VIA` lists every stated mechanism
      explicitly; `isStatedResolution` reads it, so an unlisted value is a guess. All four
      readers switch; the foreign-graph test still refuses a foreign-only graph.
      verify: a test adds an unknown mechanism and asserts it is not stated.
- [ ] **2.3 The core stays neutral, enforced by a test.** `code_graph_core_neutral.test.ts`:
      the core files (`build`, `passes`, `map_model`, `map`, `types`, `validate`, `query`,
      `verbs`) contain no provider id from the registry and import providers only through
      `providers/index.ts`; every registered provider has an oracle test file.
      verify: `npx vitest run tests/scripts/code_graph_core_neutral.test.ts` -> 0
- [ ] **2.4 Request paths per handler (C7).** A route's tables come from the handler
      method's own edges and from models the handler body names, not from every edge of its
      file.
      verify: a two-route controller fixture where each action uses a different model shows
      one table per route.

## Phase 3 — The default, for every project, without a framework name

- [ ] **3.1 `conventions-default` pass, mechanism `literal-path`.** A string literal equal to
      a repo-relative path, or one relative to its file (with extension inference), links to
      that file — only when exactly one file matches. `resolved_via: 'literal-path'`,
      INFERRED, never over an import or provider edge for the same pair.
      verify: a fixture test asserts one edge for a unique literal path and none for a two-match literal.
- [ ] **3.2 Mechanism `literal-dotted`.** `a.b.c` or `a/b.ext` in a call argument links to
      `<root>/a/b/c.<ext>` where `<root>` already holds files of that extension, single
      match only. Covers template names across frameworks without naming one.
      verify: a fixture test resolves a dotted template name and refuses an ambiguous one.
- [ ] **3.3 Mechanism `manifest`.** Entry points from `package.json` (`main`, `bin`,
      `exports`), `composer.json` `bin`, `pyproject.toml` `[project.scripts]`, Maven / Gradle
      main class; they become map entries.
      verify: a fixture test turns `package.json` `bin` and `pyproject.toml` scripts into map entries.
- [ ] **3.4 Mechanism `fs-route`.** Page modules under `pages/`, `app/`, `routes/`,
      `src/routes/` become route nodes with paths derived from file paths, only when the
      directory holds page-shaped modules.
      verify: a fixture test derives route nodes from a `pages/` tree and none from a utility `routes/` folder.
- [ ] **3.5 Each mechanism measured and switchable.** Per-mechanism edge counts and a sampled
      precision on this repository and Fixture L go into the evidence file; a mechanism under
      the bar recorded there is off by default, not the pass.
      verify: the evidence file names a precision figure per mechanism.

## Phase 4 — Providers for the most common frameworks on parsed languages

Every provider lands with a synthetic fixture under `tests/fixtures/code-graph/<id>/`, a
positive and a negative oracle per relation it claims, and a catalog row (6.1). Relations are
the fixed vocabulary only: `routes-to`, `renders`, `includes`, `reads`, `migrates`,
`persists`, `relates`, plus `injects` (new, DI). A route handler is always attributed per
handler, never per file.

- [ ] **4.1 Shared extractors.** Five parameterised mechanisms in `providers/shared/`:
      attribute / decorator / annotation routes, call-form routes, file-system routes (on
      3.4), table mapping, template roots (on 3.2).
      verify: each shared extractor has a unit test with a positive and a negative case.
- [ ] **4.2 JavaScript / TypeScript:** React Router, Next.js (app and pages router, route
      handlers, layouts), Express, NestJS (controllers, providers → `injects`), Angular
      (route arrays, component templates), Vue Router / Nuxt, SvelteKit.
      verify: each named framework has a provider fixture test with positive and negative oracles.
- [ ] **4.3 Python:** FastAPI, Flask (decorator routes, Jinja templates), Django (`urls.py`
      → views, `render` templates, `Meta.db_table` / model tables, migrations), SQLAlchemy
      `__tablename__`.
      verify: each named framework has a provider fixture test with positive and negative oracles.
- [ ] **4.4 Java:** Spring Boot (`@*Mapping` routes, `@Entity` / `@Table`, repositories →
      entities, `@Autowired` → `injects`).
      verify: the Spring Boot fixture test passes its positive and negative oracles.
- [ ] **4.5 PHP:** Symfony (`#[Route]`, Twig render, Doctrine `#[ORM\Table]`), WordPress
      (`add_action` / `add_filter` → callback as a `HOOK <name>` route, `get_template_part`).
      verify: the Symfony and WordPress fixture tests pass their positive and negative oracles.
- [ ] **4.6 Go:** net/http, Gin, Echo, chi route registrations → handlers.
      verify: the Go router fixture test passes its positive and negative oracles.
- [ ] **4.7 TypeScript ORM:** TypeORM `@Entity`.
      verify: `npx vitest run tests/scripts/code_graph_providers` -> 0

## Phase 5 — C# and Ruby

- [ ] **5.1 Measure the payload first.** Packed tarball delta of vendoring the C# and Ruby
      grammars against `src/config/pack-size-budget.json`; record it. Over the regression
      line → council decision before 5.2, recorded in Decisions.
      verify: the evidence file records the packed delta and the budget line it was compared against.
- [ ] **5.2 C# extraction.** Vendor `tree-sitter-c_sharp.wasm` with its SHA-256 in the
      grammars README; an extractor for namespaces, classes, interfaces, methods, `using`,
      inheritance, calls, in the shape `extract_more.ts` emits.
      verify: a C# fixture produces class, method, import and call edges in the extractor test.
- [ ] **5.3 ASP.NET Core provider.** `[Http*]` / `[Route]` attributes and minimal-API
      `Map*` calls → handlers; EF Core `DbSet<T>` / `[Table]` → tables; Razor views rendered
      by name.
      verify: the ASP.NET Core fixture test passes its positive and negative oracles.
- [ ] **5.4 Ruby extraction and the Rails provider.** Vendor the Ruby grammar; extract
      classes, modules, methods, `require`, inheritance, calls; Rails `routes.rb`
      (`get`, `resources`) → controller actions, ActiveRecord models → tables, views.
      verify: the Rails fixture test passes its positive and negative oracles.

## Phase 6 — Catalog and transparency

- [ ] **6.1 Coverage catalog.** `providers/catalog.ts`: per provider id, language, detected
      markers, relations claimed, status `detected | partial | verified | deep`, fixture path,
      usage source and year. A provider with only synthetic oracles is `partial`; `verified`
      needs a registered real-repository reading. Languages and frameworks not covered appear
      with status `planned`.
      verify: the core-neutrality test asserts one catalog row per registered provider.
- [ ] **6.2 The map and MCP say which provider drew an edge.** `map.json` / `MAP.md` list the
      active providers with their catalog status; the viewer's node inspector names the
      provider of each convention edge; `graph_map_status` returns the provider list.
      verify: a map test asserts MAP.md lists the active providers of a Laravel fixture.
- [ ] **6.3 Docs follow the code.** The `code-intelligence` skill, `docs/maintainers/system-map.md`
      if it names the overlay, and the CHANGELOG describe providers, the default and the
      catalog.
      verify: `grep -c 'providers' src/skills/code-intelligence/SKILL.md` -> /[1-9]/

## Phase 7 — Readings and close

- [ ] **7.1 Parity on Fixture L.** Unconnected-file share and route coverage at least the 0.2
      baseline; the negative oracle (fluent route-builder calls never bind in-repo) holds.
      verify: the evidence file records both Fixture L readings at or above the 0.2 baseline.
- [ ] **7.2 Readings for the default and every provider fixture** recorded in the evidence
      file; this repository's graph changes only by the schema rename and default-pass
      edges, each counted.
      verify: the evidence file lists every catalog provider with its oracle result.

## Kill register

| # | Not doing | Why |
|---|---|---|
| K1 | Third-party providers loaded from a repository or a package | Supply-chain and sandbox cost with no demand; curated first-party registry only. |
| K2 | A provider SDK, learned provider routing, model-proposed convention rules | No consumer asks; a learned rule would be an untrusted edge source. |
| K3 | Source span and evidence hash on every edge | Source nodes already carry locations; the hash duplicates `source_checksum`. Provider id + mechanism are kept. |
| K4 | New query verbs (`why-edge`, `route-to-db`) and new MCP tools | `path` already answers route → table; MCP tool count is budgeted. |
| K5 | A per-provider scheduler, RSS budgeting, cross-session parse sharing | No measured contention; the cache key already covers schema and extractor. |
| K6 | Benchmarks on every PR and a comparison against S1 | `later/road-to-a-graph-that-wins` owns registered measurement. |
| K7 | Kotlin, Rust, C/C++, Swift, Dart, SQL, HTML/CSS, infrastructure and mobile frameworks, Prisma / Drizzle, and testing-framework providers now | Each grammar is a measured payload cost with no fixture yet; test edges are already derived by `test-import`. They stand in the catalog as `planned`. |
| K10 | Cross-OS path tests and hostile-filename map tests in this roadmap | Ids are POSIX-relative already (`build.ts` header) and the map's CSP and escaping shipped with `road-to-a-map-that-draws-itself`. |
| K8 | Removing Laravel knowledge or replacing it by a rule-free matcher | A string literal is not a route; route and ORM semantics need provider code (ruling 2 keeps Laravel as one entry). |
| K9 | A new CI gate script for neutrality | A vitest test in the existing suite is the same check without a gate registration (2.3). |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | product-owned | owner | Neutral seam + registry; Laravel becomes one provider | Ruling 2 | — |
| E2 | product-owned | owner | A default for every project plus dedicated providers for the most common frameworks; a fixture proves a provider, it does not trigger it | Ruling 3 | the owner narrows the coverage rule |
| E3 | reversible-technical | evidence | The list: every framework both supplied usage tables rank, on a parsed language or C# / Ruby | Both plans' tables agree on React, Next.js, Express, NestJS, Angular, Vue / Nuxt, FastAPI, Flask, Django, Spring Boot, ASP.NET Core, Laravel; survey years differ and are unverified here | a survey year moves a framework across the line |
| E4 | reversible-technical | evidence | Symfony is in (the draft's open E9) | Ruling 2 names it beside Laravel; it is the second PHP framework on the owner's stack and reuses the attribute-route extractor | — |
| E5 | reversible-technical | evidence | WordPress is in, its hooks modelled as `HOOK <name>` route nodes (the draft's open E10) | It is in the 2025 top 20 the draft used; PHP is parsed; hooks are the entry points it dispatches | hook nodes mislead the map |
| E6 | reversible-technical | agent | Detection by project markers per package root, never by file suffix | `.php` does not mean Laravel; monorepos mix stacks | a framework has no manifest marker |
| E7 | reversible-technical | agent | One PR for the whole roadmap; Phase 1 lands byte-identical before the schema bump inside it | Owner instruction 2026-10-23 (`/roadmap:process-full`, update the PR) | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Default pass adds wrong edges | implementation | A literal that happens to equal a path draws a false edge in every project | Single-match only, INFERRED, never over a stronger edge, per-mechanism precision with an off switch | Phase 3 — The default, for every project, without a framework name |
| 2 | Providers become badges | product | Many providers detected, few resolving anything, read as support | Oracle per relation, catalog status `partial` until a real reading | Phase 6 — Catalog and transparency |
| 3 | The seam silently changes Laravel output | implementation | Moving the overlay or the detection drops edges on a project without `artisan` | Byte identity on three trees before the schema bump | Phase 1 — The seam, byte-identical |
| 4 | Grammar payload breaks the pack budget | implementation | C# and Ruby add about 6 MB uncompressed | Measure first; council decision over the line | Phase 5 — C# and Ruby |
| 5 | Trust flip changes gate verdicts | implementation | An omitted mechanism in the allowlist turns stated edges into guesses | The allowlist enumerates every current stated value; existing verb tests unchanged | Phase 2 — Names, trust and provenance (schema 6) |

## Acceptance Criteria

- [ ] AC-1 — No file in the graph core names a framework or imports a provider directly; the
      neutrality test enforces it.
- [ ] AC-2 — Fixture L's unconnected-file share and route coverage are at least the 0.2
      baseline after the move.
- [ ] AC-3 — The default pass runs on every project and draws only single-match edges, each
      mechanism with a recorded precision.
- [ ] AC-4 — Every framework in E3 / E4 / E5 has a provider with positive and negative
      oracles green, and a catalog row with an honest status.
- [ ] AC-5 — An unknown `resolved_via` value is treated as a guess by every reader.
- [ ] AC-6 — A route's tables are those its own handler reaches.
