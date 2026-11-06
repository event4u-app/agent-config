# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/self-2026-11-06` · graph `<scratch>/parity/self.adapted.json` · prefix `src/scripts/`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 0, name_lookup_multi 0, name_collision_edges 0.

## TypeScript / JavaScript — SCIP index `<scratch>/self-2026-11-06/.oracle-index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `extracted:calls` | 30334 | 28694 | 28693 | 100.0 % | 28561 | 28256 | 98.9 % | 3301 |
| `extracted:imports` | 15026 | 14336 | 14333 | 100.0 % | 9596 | 9488 | 98.9 % | 4554 |
| `extracted:inherits` | 122 | 120 | 120 | 100.0 % | 106 | 106 | 100.0 % | 24 |
| `extracted:references` | 913 | 904 | 904 | 100.0 % | 891 | 891 | 100.0 % | 531 |
| `inferred:calls` | 1432 | 1399 | 1374 | 98.2 % | 1104 | 1078 | 97.6 % | 194 |
| `inferred:imports` | 3 | 0 | 0 | — | 0 | 0 | — | 0 |
| `inferred:references` | 12 | 0 | 0 | — | 0 | 0 | — | 0 |

Oracle: 2083 documents, 4667 cross-file pairs, 10682 cross-file symbol pairs.
Recall (file): 97.6 % · recall (symbol): 92.6 %.

Excluded: unresolved_target 5708 · out_of_root 0 · outside_prefix 15491 · not_reference_relation 0 · outside_oracle_coverage 2389.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| term | 97 |
| method | 24 |
| namespace | 7 |
| other | 1 |
| meta | 1 |

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
- `src/scripts/_lib/chat_history_redact.ts` → `src/scripts/_lib/egress_token.ts` (other)
- `src/scripts/_lib/cold_return.ts` → `src/scripts/_lib/prompt_cache_reading.ts` (term)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (method)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (namespace)
- `src/scripts/_lib/collector_store.ts` → `src/scripts/_lib/node_sqlite.d.ts` (term)
- `src/scripts/_lib/council_settings_block.ts` → `src/scripts/ai_council/fallback_config.ts` (term)
- `src/scripts/_lib/council_settings_block.ts` → `src/scripts/ai_council/free_route.ts` (term)
- `src/scripts/_lib/gate_collector_experimental.ts` → `src/scripts/code_graph/lanes/runtime/read_runtime.ts` (meta)
- `src/scripts/_lib/graph_detector_edges.ts` → `src/scripts/code_graph/lanes/lane_fact.ts` (term)
- `src/scripts/_lib/memory_fts_index.ts` → `src/scripts/_lib/node_sqlite.d.ts` (method)

## PHP

Not measured: no Psalm oracle was given (`--php-oracle`).
