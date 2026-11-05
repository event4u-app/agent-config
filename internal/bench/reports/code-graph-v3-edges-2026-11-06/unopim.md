# Edge precision and recall against a compiler-grade oracle

Root `<scratch>/bench-subjects/unopim` · graph `<scratch>/edge-oracle/unopim.graph.json`.
The oracle is a measuring instrument under `internal/bench/`, never an arm or a provider (K1);
its indexes were produced by indexers the maintainer installed, never fetched (ADR-259).
Scored relations: `calls`, `imports`, `uses`, `inherits`, `references`, `injects`, `tests`.
Census (same graph): name_lookup_calls 1192, name_lookup_multi 2, name_collision_edges 87.

## TypeScript / JavaScript — SCIP index `<scratch>/oracle-work/unopim/.oracle/index.scip` (supplied with --scip)

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `class-hierarchy` | 2796 | 0 | 0 | — | 0 | 0 | — | 0 |
| `dynamic` | 3826 | 3 | 3 | 100.0 % | 3 | 0 | 0.0 % | 0 |
| `import-specifier` | 10395 | 446 | 446 | 100.0 % | 14 | 14 | 100.0 % | 438 |
| `name-lookup` | 1392 | 680 | 680 | 100.0 % | 680 | 605 | 89.0 % | 199 |
| `psr4` | 6703 | 0 | 0 | — | 0 | 0 | — | 0 |
| `same-file` | 1329 | 681 | 632 | 92.8 % | 681 | 567 | 83.3 % | 0 |
| `test-import` | 2164 | 0 | 0 | — | 0 | 0 | — | 0 |

Oracle: 235 documents, 477 cross-file pairs, 607 cross-file symbol pairs.
Recall (file): 93.9 % · recall (symbol): 79.6 %.

Excluded: unresolved_target 22222 · out_of_root 0 · outside_prefix 0 · not_reference_relation 11324 · outside_oracle_coverage 26795.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| meta | 28 |
| term | 10 |
| namespace | 1 |

- `resources/js/app.js` → `resources/js/bootstrap.js` (namespace)
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
- `tests/e2e-pw/payloads/media.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)
- `tests/e2e-pw/payloads/media.payloads.js` → `tests/e2e-pw/utils/api/config.js` (term)
- `tests/e2e-pw/payloads/products.payloads.js` → `tests/e2e-pw/utils/api/config.js` (meta)

## PHP — Psalm references `<scratch>/edge-oracle/unopim.php-oracle.json`

| `resolved_via` | graph edges | scored | confirmed (file) | precision (file) | symbol-scored | confirmed (symbol) | precision (symbol) | oracle pairs covered |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `class-hierarchy` | 2796 | 2766 | 2762 | 99.9 % | 2766 | 2739 | 99.0 % | 126 |
| `dynamic` | 3814 | 3787 | 1596 | 42.1 % | 3787 | 1580 | 41.7 % | 807 |
| `import-specifier` | 458 | 458 | 458 | 100.0 % | 458 | 451 | 98.5 % | 241 |
| `name-lookup` | 684 | 265 | 261 | 98.5 % | 265 | 259 | 97.7 % | 200 |
| `psr4` | 6703 | 6427 | 6426 | 100.0 % | 6427 | 6426 | 100.0 % | 5195 |
| `same-file` | 636 | 11 | 11 | 100.0 % | 11 | 11 | 100.0 % | 0 |
| `test-import` | 2164 | 2035 | 2035 | 100.0 % | 2035 | 2035 | 100.0 % | 2035 |

Oracle: 2788 documents, 6460 cross-file pairs, 10210 cross-file symbol pairs.
Recall (file): 85.8 % · recall (symbol): 69.2 %.

Excluded: unresolved_target 22222 · out_of_root 0 · outside_prefix 0 · not_reference_relation 11324 · outside_oracle_coverage 1506.

### Oracle pairs the graph lacks, by kind

| kind | missing |
|---|---:|
| class | 699 |
| method | 450 |
| interface | 127 |
| trait | 3 |

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
