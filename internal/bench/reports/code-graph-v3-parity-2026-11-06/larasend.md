# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/bench-subjects/larasend` · graph `<scratch>/parity/larasend.adapted.json`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 0, name_lookup_multi 0, name_collision_edges 0.

## TypeScript / JavaScript — SCIP index `<scratch>/oracle-work/larasend/.oracle/index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `extracted:calls` | 861 | 12 | 12 | 100.0 % | 12 | 10 | 83.3 % | 1 |
| `extracted:imports` | 1556 | 22 | 22 | 100.0 % | 7 | 7 | 100.0 % | 11 |
| `extracted:inherits` | 21 | 0 | 0 | — | 0 | 0 | — | 0 |
| `extracted:uses` | 516 | 1 | 1 | 100.0 % | 1 | 1 | 100.0 % | 1 |
| `inferred:calls` | 305 | 6 | 6 | 100.0 % | 6 | 2 | 33.3 % | 0 |
| `inferred:uses` | 21 | 0 | 0 | — | 0 | 0 | — | 0 |

Oracle: 36 documents, 40 cross-file pairs, 34 cross-file symbol pairs.
Recall (file): 27.5 % · recall (symbol): 20.6 %.

Excluded: unresolved_target 1286 · out_of_root 0 · outside_prefix 0 · not_reference_relation 0 · outside_oracle_coverage 3239.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| namespace | 29 |
| term | 23 |

- `resources/js/app.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/app.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/alert/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/alert/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/avatar/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/avatar/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/badge/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/badge/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/breadcrumb/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/breadcrumb/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/button/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/button/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/card/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/card/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/checkbox/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/checkbox/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/collapsible/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/collapsible/index.ts` → `resources/js/types/vue-shims.d.ts` (term)
- `resources/js/components/ui/dialog/index.ts` → `resources/js/types/vue-shims.d.ts` (namespace)
- `resources/js/components/ui/dialog/index.ts` → `resources/js/types/vue-shims.d.ts` (term)

## PHP — Psalm references `<scratch>/edge-oracle/larasend.php-oracle.json`

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `extracted:calls` | 757 | 506 | 500 | 98.8 % | 506 | 489 | 96.6 % | 52 |
| `extracted:imports` | 500 | 485 | 485 | 100.0 % | 485 | 485 | 100.0 % | 485 |
| `extracted:inherits` | 21 | 21 | 21 | 100.0 % | 21 | 21 | 100.0 % | 21 |
| `extracted:uses` | 512 | 504 | 503 | 99.8 % | 504 | 503 | 99.8 % | 213 |
| `inferred:calls` | 291 | 271 | 266 | 98.2 % | 271 | 266 | 98.2 % | 91 |

Oracle: 218 documents, 622 cross-file pairs, 1048 cross-file symbol pairs.
Recall (file): 83.1 % · recall (symbol): 68.0 %.

Excluded: unresolved_target 1286 · out_of_root 0 · outside_prefix 0 · not_reference_relation 0 · outside_oracle_coverage 294.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| class | 89 |
| method | 44 |
| interface | 8 |

- `app/Actions/BuildProjectDashboard.php` → `app/Enums/SourceProvider.php` (method)
- `app/Actions/BuildProjectDashboard.php` → `app/Models/Workspace.php` (class)
- `app/Actions/BuildProjectDashboard.php` → `app/Models/Workspace.php` (method)
- `app/Console/Commands/DoctorCommand.php` → `app/Enums/SourceProvider.php` (method)
- `app/Console/Commands/DoctorCommand.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Console/Commands/DoctorCommand.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/ActivityController.php` → `app/Enums/SourceProvider.php` (method)
- `app/Http/Controllers/ActivityController.php` → `app/Models/Workspace.php` (class)
- `app/Http/Controllers/ActivityController.php` → `app/Models/Workspace.php` (method)
- `app/Http/Controllers/ActivityController.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Http/Controllers/ActivityController.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/DashboardActionController.php` → `app/Enums/SourceProvider.php` (method)
- `app/Http/Controllers/DashboardActionController.php` → `app/Models/Workspace.php` (class)
- `app/Http/Controllers/DashboardActionController.php` → `app/Models/Workspace.php` (method)
- `app/Http/Controllers/DashboardActionController.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Http/Controllers/DashboardActionController.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/EmailMimeController.php` → `app/Models/User.php` (class)
- `app/Http/Controllers/EmailMimeController.php` → `app/Models/User.php` (method)
- `app/Http/Controllers/EmailPreviewController.php` → `app/Models/User.php` (class)
- `app/Http/Controllers/EmailPreviewController.php` → `app/Models/User.php` (method)
