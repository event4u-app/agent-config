# Command budget audit (6.0.0-B Phase 2 Step 4)

> Per-pack VISIBLE-command counts vs. the `size_class` budget (capability-packs.md). `visible` = visibility ∈ {visible, advanced}; `internal` / absent = uncapped. Citations = docs/ files referencing `/<name>`.
>
> **Signal note:** docs-citations is the load-bearing signal (rank candidates low→high). The git commit/idle columns are low-variance on this active repo and only weakly discriminating — do not hide a high-citation command on an idle-days reading alone.


## Summary

| Pack | size_class | budget | visible | internal | over? |
|---|---|--:|--:|--:|:--|
| `(unassigned)` | — | — | 0 | 13 | ok |
| `ai-video` | large | 8 | 0 | 10 | ok |
| `analysis-workbench` | medium | 5 | 1 | 8 | ok |
| `analytics` | small | 2 | 0 | 4 | ok |
| `brand` | medium | 5 | 0 | 6 | ok |
| `engineering-base` | core | 8 | 7 | 50 | ok |
| `fun` | small | 2 | 0 | 1 | ok |
| `git` | small | 2 | 2 | 2 | ok |
| `gtm-marketing` | medium | 5 | 0 | 10 | ok |
| `memory` | small | 2 | 1 | 8 | ok |
| `meta` | core | 8 | 6 | 54 | ok |
| `product-basic` | medium | 5 | 4 | 7 | ok |
| `product-discovery` | medium | 5 | 0 | 8 | ok |
| `product-reasoning` | medium | 5 | 1 | 10 | ok |

## Over-budget packs — decision signals (Phase 2 Step 5)

None — every pack is within its visible-command budget.

