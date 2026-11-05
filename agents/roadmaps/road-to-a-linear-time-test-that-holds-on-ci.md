---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "A red check seen on PR #2866 and on main that this change could not fix without weakening a test it did not write. Merging into road-to-a-graph-that-wins was rejected because the defect is in the design-pass linter's test, not the graph; parking it in later/ was rejected because it fails main today; archiving another roadmap was not available because none of the four active ones is complete."
---
# Road to a linear-time test that holds on CI

> **Source:** seen red on PR #2866 and on `main` (Tests run 42012179917), 2026-11-05.

## The defect

`tests/scripts/design_slop_css_blocks_linear.test.ts` § "cssBlocks is linear on a megabyte"
asserts one wall-clock run of `cssBlocks` on a 1 MB input against an absolute bound,
`hook-latency-budget.json` → `budgets_ms.any_hook_event.p95_ci` (250 ms). On shared
`ubuntu-latest` runners the single run lands just above it:

| Run | Shape | Measured |
|---|---|---|
| `main`, 42012179917 (shard 4/4) | opening braces only | 252.9 ms |
| PR #2866, 42019460409 (shard 4/4) | many small blocks, one per line | 281.4 ms |
| PR #2866, 42019460409 (shard 4/4) | opening braces only | 301.5 ms |

Locally the same file passes (8/8). The test is meant to catch a quadratic regression
(the regex it replaced), and one sample of absolute time against a p95 budget is the wrong
instrument for that: it fails on runner noise and would still pass a regression that
stays under 250 ms on a fast machine.

## Phase 1 — measure growth, not one sample

- [ ] **1.1 Replace the single absolute sample with a growth check** — time each shape at
      N and 4N (median of three runs each) and assert the ratio stays below a linear bound
      with headroom; keep an absolute ceiling far above the p95 budget only as a backstop.
      Not a loosened threshold: the assertion changes what it measures. Per
      `evaluator-independence` § Tests are evaluators, the new test is shown red against
      the removed quadratic regex before it lands, and an independent reviewer validates it.
- [ ] **1.2 Verify on CI** — the shard that ran it is green on three consecutive pushes.
