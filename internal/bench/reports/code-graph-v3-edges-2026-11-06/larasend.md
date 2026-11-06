# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/bench-subjects/larasend` · graph `<scratch>/edge-oracle/larasend.graph.json`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 8, name_lookup_multi 0, name_collision_edges 0.

## TypeScript / JavaScript — SCIP index `<scratch>/oracle-work/larasend/.oracle/index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `class-hierarchy` | 395 | 0 | 0 | — | 0 | 0 | — | 0 |
| `dynamic` | 441 | 0 | 0 | — | 0 | 0 | — | 0 |
| `import-specifier` | 2837 | 4 | 4 | 100.0 % | 0 | 0 | — | 4 |
| `name-lookup` | 27 | 0 | 0 | — | 0 | 0 | — | 0 |
| `orm-relation` | 64 | 0 | 0 | — | 0 | 0 | — | 0 |
| `path-alias` | 285 | 10 | 10 | 100.0 % | 10 | 10 | 100.0 % | 6 |
| `psr4` | 658 | 0 | 0 | — | 0 | 0 | — | 0 |
| `same-file` | 173 | 36 | 36 | 100.0 % | 36 | 15 | 41.7 % | 0 |
| `schema-call` | 82 | 0 | 0 | — | 0 | 0 | — | 0 |
| `test-import` | 200 | 0 | 0 | — | 0 | 0 | — | 0 |

Oracle: 36 documents, 40 cross-file pairs, 34 cross-file symbol pairs.
Recall (file): 25.0 % · recall (symbol): 20.6 %.

Excluded: unresolved_target 1890 · out_of_root 0 · outside_prefix 0 · not_reference_relation 2911 · outside_oracle_coverage 5112.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| namespace | 30 |
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
| `class-hierarchy` | 395 | 395 | 395 | 100.0 % | 395 | 394 | 99.7 % | 0 |
| `dynamic` | 441 | 441 | 351 | 79.6 % | 441 | 351 | 79.6 % | 181 |
| `import-specifier` | 326 | 326 | 326 | 100.0 % | 326 | 322 | 98.8 % | 130 |
| `name-lookup` | 25 | 21 | 21 | 100.0 % | 21 | 21 | 100.0 % | 20 |
| `psr4` | 658 | 643 | 643 | 100.0 % | 643 | 643 | 100.0 % | 544 |
| `same-file` | 37 | 1 | 1 | 100.0 % | 1 | 1 | 100.0 % | 0 |
| `test-import` | 200 | 199 | 199 | 100.0 % | 199 | 199 | 100.0 % | 199 |

Oracle: 218 documents, 622 cross-file pairs, 1048 cross-file symbol pairs.
Recall (file): 96.8 % · recall (symbol): 82.3 %.

Excluded: unresolved_target 1890 · out_of_root 0 · outside_prefix 0 · not_reference_relation 2911 · outside_oracle_coverage 56.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| method | 15 |
| class | 11 |
| interface | 9 |

- `app/Console/Commands/DoctorCommand.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Console/Commands/DoctorCommand.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/ActivityController.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Http/Controllers/ActivityController.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/DashboardActionController.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Http/Controllers/DashboardActionController.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Controllers/EmailMimeController.php` → `app/Models/User.php` (class)
- `app/Http/Controllers/EmailMimeController.php` → `app/Models/User.php` (method)
- `app/Http/Controllers/EmailPreviewController.php` → `app/Models/User.php` (class)
- `app/Http/Controllers/EmailPreviewController.php` → `app/Models/User.php` (method)
- `app/Http/Controllers/OnboardingController.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Http/Controllers/OnboardingController.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Http/Requests/StoreOnboardingRequest.php` → `app/Models/Workspace.php` (class)
- `app/Http/Requests/StoreOnboardingRequest.php` → `app/Models/Workspace.php` (method)
- `app/Jobs/RecoverStuckQueuedEmails.php` → `app/Jobs/SendQueuedEmail.php` (class)
- `app/Jobs/SendQueuedEmail.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Jobs/SendQueuedEmail.php` → `app/Services/Providers/EmailProvider.php` (method)
- `app/Jobs/SyncCloudflareSuppressions.php` → `app/Jobs/SyncCloudflareSourceSuppressions.php` (class)
- `app/Jobs/SyncStaleSourceQuotas.php` → `app/Services/Providers/EmailProvider.php` (interface)
- `app/Jobs/SyncStaleSourceQuotas.php` → `app/Services/Providers/EmailProvider.php` (method)
