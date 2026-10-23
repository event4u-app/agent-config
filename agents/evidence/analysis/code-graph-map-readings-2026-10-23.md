<!-- evidence-type: analysis -->
# Code graph and map — cost readings and correctness oracles, 2026-10-23

> road-to-a-map-that-draws-itself 8.1 and 8.2. Wall-clock readings on one machine
> (Apple M5 Max, Darwin 25.6, arm64), taken with
> `internal/bench/code-graph/map_cost.ts` on the branch head of PR #2592. They vary by
> machine and are recorded, never promised.

## 8.1 — Cost readings

| Reading | This repository | Fixture L (MIT Laravel app) | Synthetic tree |
|---|---|---|---|
| Files indexed | 4,613 | 2,218 | 10,000 |
| Nodes / edges | 60,964 / 223,677 | 16,922 / 104,060 | 40,000 / 51,000 |
| Engine build, cold | 8.5 s | 2.4 s | 1.1 s |
| SQLite twin emission | 0.72 s | 0.33 s | 0.15 s |
| Map build (model, layout, four artefacts) | 5.3 s | 0.6 s | 2.5 s |
| `index.html` | 4.1 MB | 1.3 MB | 2.5 MB |
| Largest coupling area | 3.9 % | 19.0 % | 4.0 % |
| `query` path | index | index | index |
| `query` p50 / p95, in process, 40 seeds | 0.02 / 0.08 ms | 0.03 / 0.09 ms | 0.02 / 0.03 ms |

Read against the defects the roadmap started from:

- **D3/D4.** Before Phase 1 the twin was never written on a real repository (duplicate node ids),
  and when forced it took 27–31 s in autocommit mode. It is now written on every fixture, in under
  a second, and every query takes the index path. AC-2's bound (≤ 2 s here) holds at 0.72 s.
- **Map budget.** The goal names "under a minute on a 2,000-file repository"; Fixture L builds its
  map in 0.6 s on top of a 2.4 s engine build.
- **CLI wall time** is dominated by process start (tsx ≈ 0.25 s), not by the query, which the
  in-process reading isolates.
- This repository's figures include its 5,844 Markdown files (the docs layer, 6.3), which is why
  its node and edge counts exceed the source's earlier measurement of `src/` alone.

## 8.2 — Correctness oracles, one positive and one negative per relation

A missing edge is preferred to a wrong one; each relation added in Phases 1, 4 and 6 is pinned
by a fixture that must produce it and one that must not.

| Relation / mechanism | Positive (must link) | Negative (must not) | Test |
|---|---|---|---|
| Project root (1.1) | flagless build from a nested dir indexes the fixture | the package tree is never written | `code_graph_consumer_root.test.ts` |
| Unique ids (1.3) | `#Outcome@2`, getter/setter `@2`, nested `walk@2` | duplicate id rejected by `validateGraph` | `code_graph_unique_ids.test.ts` |
| Cache key (1.5) | same fingerprint reuses every extract | changed fingerprint re-extracts all | `code_graph_unique_ids.test.ts` |
| `routes-to` (4.1) | `use`-alias, sub-namespace alias, group prefix, resource | same-named `index` in another namespace; closure and string handlers get no target | `code_graph_provider_laravel.test.ts` |
| Fluent builder guard (4.4) | — | `->middleware()` never binds to an in-repo `middleware()` | `code_graph_provider_laravel.test.ts` |
| `renders` / `includes` (4.2) | `view()`, `@extends`, `@include`, `<x-…>` | a view name built at runtime | `code_graph_provider_laravel.test.ts` |
| `reads` (4.2) | `__('group.key')` to every locale file, `config('app.x')` | — (config with two candidate files is skipped by rule) | `code_graph_provider_laravel.test.ts` |
| `migrates` / `persists` / `relates` (4.3) | convention and `$table`, `hasMany` | — | `code_graph_provider_laravel.test.ts` |
| Python / Java / Go imports (6.1) | module-path resolution, Go package to every file | stdlib → `external:`; a Java suffix matching two files resolves to nothing; Go test files excluded | `code_graph_more_languages.test.ts` |
| Vue (6.1) | script-block import resolves | template markup never parsed as code; line numbers kept | `code_graph_more_languages.test.ts` |
| `compiler-index` (6.2) | a SCIP reference becomes an edge | the native dynamic guess it duplicates is dropped; a truncated index throws | `code_graph_scip.test.ts` |
| `documents` (6.3) | links and backticked paths | URLs, globs, missing files, escapes out of the root | `code_graph_docs_layer.test.ts` |

Each of these was seen red: the suites were run against the pre-change code (or with the
mechanism neutralised) and failed before the change made them pass.
