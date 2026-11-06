# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/bench-subjects/unopim` · graph `<scratch>/parity/unopim.adapted.json`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 0, name_lookup_multi 0, name_collision_edges 0.

## TypeScript / JavaScript — SCIP index `<scratch>/oracle-work/unopim/.oracle/index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `extracted:calls` | 8254 | 744 | 708 | 95.2 % | 744 | 657 | 88.3 % | 95 |
| `extracted:imports` | 6957 | 1216 | 1216 | 100.0 % | 646 | 571 | 88.4 % | 427 |
| `extracted:inherits` | 617 | 0 | 0 | — | 0 | 0 | — | 0 |
| `extracted:uses` | 2878 | 0 | 0 | — | 0 | 0 | — | 0 |
| `inferred:calls` | 3923 | 112 | 111 | 99.1 % | 112 | 111 | 99.1 % | 0 |
| `inferred:uses` | 20 | 0 | 0 | — | 0 | 0 | — | 0 |

Oracle: 235 documents, 477 cross-file pairs, 607 cross-file symbol pairs.
Recall (file): 89.5 % · recall (symbol): 93.7 %.

Excluded: unresolved_target 6979 · out_of_root 0 · outside_prefix 0 · not_reference_relation 0 · outside_oracle_coverage 20577.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| meta | 29 |
| namespace | 14 |
| term | 10 |
| method | 8 |

- `tests/e2e-pw/fixtures/index.js` → `tests/e2e-pw/fixtures/api-fixtures.js` (namespace)
- `tests/e2e-pw/fixtures/index.js` → `tests/e2e-pw/fixtures/test-data.js` (namespace)
- `tests/e2e-pw/payloads/attribute-families.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/attribute-families.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/attribute-groups.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/attribute-groups.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/attribute-options.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/attribute-options.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/attributes.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/attributes.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/categories.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/categories.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/category-field-options.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/category-field-options.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/category-fields.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/category-fields.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/configurable-products.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/configurable-products.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/index.js` → `tests/e2e-pw/payloads/attribute-families.payloads.js` (namespace)
- `tests/e2e-pw/payloads/index.js` → `tests/e2e-pw/payloads/attribute-groups.payloads.js` (namespace)

## PHP — Psalm references `<scratch>/edge-oracle/unopim.php-oracle.json`

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `extracted:calls` | 7483 | 3923 | 3660 | 93.3 % | 3923 | 3598 | 91.7 % | 629 |
| `extracted:imports` | 5680 | 5235 | 5229 | 99.9 % | 5230 | 5229 | 100.0 % | 5229 |
| `extracted:inherits` | 617 | 617 | 617 | 100.0 % | 617 | 617 | 100.0 % | 613 |
| `extracted:uses` | 2870 | 2686 | 2683 | 99.9 % | 2686 | 2678 | 99.7 % | 1476 |
| `inferred:calls` | 3758 | 3117 | 813 | 26.1 % | 3117 | 811 | 26.0 % | 396 |

Oracle: 2788 documents, 6460 cross-file pairs, 10210 cross-file symbol pairs.
Recall (file): 83.9 % · recall (symbol): 62.0 %.

Excluded: unresolved_target 6979 · out_of_root 0 · outside_prefix 0 · not_reference_relation 0 · outside_oracle_coverage 4830.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| class | 778 |
| method | 620 |
| interface | 126 |
| trait | 41 |

- `config/concord.php` → `packages/Webkul/AiAgent/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Attribute/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Category/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Core/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/DataTransfer/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/HistoryControl/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/MagicAI/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Measurement/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Notification/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Product/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/ProductPassport/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Publication/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/Resource/src/Providers/ModuleServiceProvider.php` (class)
- `config/concord.php` → `packages/Webkul/User/src/Providers/ModuleServiceProvider.php` (class)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (interface)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (method)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeFamilyDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (interface)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeFamilyDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (method)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeGroupDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (interface)
- `packages/Webkul/Admin/src/DataGrids/Catalog/AttributeGroupDataGrid.php` → `packages/Webkul/Core/src/Contracts/Database/Grammar.php` (method)
