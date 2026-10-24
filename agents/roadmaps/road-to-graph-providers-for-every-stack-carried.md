---
complexity: lightweight
execution:
  mode: phase-checkpoints
owner: maintainer
parent_roadmap: road-to-graph-providers-for-every-stack
estate_offset_exempt: "Carried from road-to-graph-providers-for-every-stack step 5.4 in the same change, per the AI council 2026-10-23 round 2 (two seats, convergent: Ruby and Rails go to a named follow-up). grep -rlF -e 'Ruby' -e 'rails' over agents/roadmaps/*.md, later/ and stubs/: no roadmap owns a Ruby grammar or a Rails provider."
relates:
  - slug: road-to-graph-providers-for-every-stack
    relation: extends
    note: "Its step 5.4, carried verbatim; the provider seam, kit and catalog it relies on shipped there."
---
# Road to graph providers for every stack — carried

> **Source:** `agents/tmp.old/inbox-2026-10-ac/` via `road-to-graph-providers-for-every-stack`
> step 5.4, carried on 2026-10-23 because vendoring the Ruby grammar crosses the built
> pack-size regression line (blocker below).

## Goal

A Ruby on Rails project gets the same treatment the parent roadmap gave the most common
frameworks: Ruby is a parsed language, and a Rails provider draws routes, model tables,
model relations and rendered views, proven by positive and negative oracles and listed in
the coverage catalog as `partial`. Phase 2 carries the accuracy residue the 2026-10-24
review of PR #2603 measured on real projects and that the PR did not close.

## Phase 1 — Ruby and Rails

- [ ] **1.1 Vendor the Ruby grammar and extract Ruby.** `tree-sitter-ruby.wasm` with its
      SHA-256 in the grammars README and a packed-binary manifest row; `ruby` language,
      `.rb` extension; extraction of classes, modules, `def`, `require` / `require_relative`
      imports, `<` inheritance and calls, in the shape `extract_more.ts` emits.
      verify: a Ruby fixture produces class, method, import and call edges in the extractor test.
- [ ] **1.2 The Rails provider.** `config/routes.rb` `get '/x', to: 'users#index'` and
      `resources :users` (the actions the controller defines) → controller actions;
      `class User < ApplicationRecord` → `table:users` (`self.table_name` wins); `has_many` /
      `belongs_to` / `has_one` → `relates`; an action renders
      `app/views/<controller>/<action>.html.erb` when it exists. Catalog row `partial`.
      verify: the Rails fixture test passes its positive and negative oracles.

## Phase 2 — Accuracy residue from the PR #2603 review

Measured on real clones on 2026-10-24; Flask blueprints across files and tsconfig
`baseUrl` imports were fixed in that PR, these four were not.

- [ ] **2.1 Django `include()` prefixes.** A route in an included `urls.py` carries the
      path of the `path("prefix/", include(...))` that includes it (djangoproject.com:
      59 of 70 routes resolved, every included route without its prefix).
      verify: a Django fixture with a nested `include()` shows the joined route path in the provider test.
- [ ] **2.2 C# files join the graph.** `using` directives and namespace-qualified names
      bind to the declaring file (eShopOnWeb: 64.5 % of C# files without an edge).
      verify: a C# fixture with two namespaces produces cross-file import and call edges in the extractor test.
- [ ] **2.3 Request paths reach tables through services and repositories.** A route
      whose handler calls a service or repository that persists a model reaches that
      model's table (BookStack, djangoproject.com: 0 tables on request paths).
      verify: a fixture with handler → service → repository → model shows the table on the request path.
- [ ] **2.4 `routes/web.php` joins the communities it routes to.** On BookStack it forms
      a community of its own instead of sitting with the controllers it routes to.
      verify: the map test over a Laravel fixture puts the route file in a controller's community.

## Blockers

### blocker: built-pack-budget-for-grammars
- **Status:** open
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned
- **Routed:** AI council 2026-10-23, two rounds. Round 2 converged on recording a new built measurement for C# and carrying Ruby here; the re-anchor itself is owner-reserved under the 2026-10-17 precedent recorded in `src/config/pack-size-budget.json` (the agent proposing a reset is the one it unblocks).
- **Blocks:** steps 1.1, 1.2
- **Question:** The built tarball is gated at the newest recorded figure plus 10 %. Ruby adds about 0.17 MB packed. May the built figure be re-anchored to admit it, and on which criterion?
- **Recommendation:** (a), once the C# re-anchor of PR #2603 has been decided, so this addition is itemised on its own.
- **If you do nothing:** Rails stays `planned` in the catalog; Rails projects get the framework-neutral default only.
- **What to do:** pick exactly one — (a) re-anchor the built figure with a dated measurement that itemises the Ruby grammar; or (b) admit Ruby only after an equal payload reduction elsewhere; or (c) leave Rails to the default.
- **Resolved when:** the chosen option is recorded in this entry or in `src/config/pack-size-budget.json`, and Status reads resolved.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The budget re-anchor becomes routine | product | Each grammar re-anchors the line and the gate stops constraining payload | The blocker asks for an itemised, owner-decided measurement per addition | Phase 1 — Ruby and Rails |

## Acceptance Criteria

- [ ] AC-1 — Ruby files produce nodes and edges, and a Rails fixture's routes, tables,
      relations and views resolve with positive and negative oracles green.
- [ ] AC-2 — The four Phase-2 residues each have a fixture oracle that was seen red
      before its fix and is green after.
