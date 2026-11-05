# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/self-2026-11-06` · graph `<scratch>/edge-oracle/self.graph.json` · prefix `src/scripts/`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 1062, name_lookup_multi 1, name_collision_edges 342.

## TypeScript / JavaScript — SCIP index `<scratch>/self-2026-11-06/.oracle-index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `class-hierarchy` | 116 | 116 | 116 | 100.0 % | 116 | 116 | 100.0 % | 0 |
| `dynamic` | 3391 | 3321 | 598 | 18.0 % | 3321 | 489 | 14.7 % | 166 |
| `import-specifier` | 26406 | 16751 | 16746 | 100.0 % | 16396 | 16396 | 100.0 % | 4507 |
| `name-lookup` | 1045 | 166 | 66 | 39.8 % | 166 | 49 | 29.5 % | 41 |
| `same-file` | 27296 | 26450 | 26448 | 100.0 % | 26450 | 24238 | 91.6 % | 0 |
| `test-import` | 182 | 182 | 182 | 100.0 % | 182 | 182 | 100.0 % | 66 |

Oracle: 2083 documents, 4667 cross-file pairs, 10682 cross-file symbol pairs.
Recall (file): 96.9 % · recall (symbol): 90.6 %.

Excluded: unresolved_target 34347 · out_of_root 0 · outside_prefix 25558 · not_reference_relation 39434 · outside_oracle_coverage 11450.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| term | 98 |
| namespace | 32 |
| method | 24 |
| type | 6 |
| meta | 1 |

- `src/scripts/_cli/cmd_conformance.ts` → `src/scripts/_cli/_doctor_emit.ts` (term)
- `src/scripts/_cli/cmd_uninstall.ts` → `src/scripts/_lib/skill_listing_record.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/assumptions.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/council.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/halt.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/header.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/inputs.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/memory.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/pack.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/provider.ts` (method)
- `src/scripts/_cli/explain_last/render.ts` → `src/scripts/_cli/explain_last/sections/route.ts` (method)
- `src/scripts/_lib/bench_artifact_selftest.ts` → `src/scripts/_lib/bench_artifact_svg_gate.ts` (term)
- `src/scripts/_lib/cold_return.ts` → `src/scripts/_lib/prompt_cache_reading.ts` (term)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (method)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (namespace)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (term)
- `src/scripts/_lib/council_settings_block.ts` → `src/scripts/ai_council/fallback_config.ts` (term)
- `src/scripts/_lib/council_settings_block.ts` → `src/scripts/ai_council/free_route.ts` (term)
- `src/scripts/_lib/delivery_arm_experiment.ts` → `src/scripts/_lib/router_match.ts` (type)
- `src/scripts/_lib/gate_collector_experimental.ts` → `src/scripts/code_graph/lanes/runtime/read_runtime.ts` (meta)

## PHP

Not measured: no Psalm oracle was given (`--php-oracle`).
