# Command budget audit (6.0.0-B Phase 2 Step 4)

> Per-pack VISIBLE-command counts vs. the `size_class` budget (capability-packs.md). `visible` = tier ∈ {0,1}; tier 2 / absent = internal (uncapped). Citations = docs/ files referencing `/<name>`.
>
> **Signal note:** docs-citations is the load-bearing signal (rank candidates low→high). The git commit/idle columns are low-variance on this active repo and only weakly discriminating — do not hide a high-citation command on an idle-days reading alone.


## Summary

| Pack | size_class | budget | visible | internal | over? |
|---|---|--:|--:|--:|:--|
| `ai-video` | large | 8 | 0 | 10 | ok |
| `engineering-base` | core | 8 | 8 | 37 | ok |
| `fun` | small | 2 | 0 | 1 | ok |
| `gtm-marketing` | medium | 5 | 0 | 9 | ok |
| `meta` | core | 8 | 8 | 60 | ok |
| `product-basic` | medium | 5 | 4 | 5 | ok |
| `product-discovery` | medium | 5 | 0 | 8 | ok |

## Over-budget packs — decision signals (Phase 2 Step 5)

None — every pack is within its visible-command budget.

