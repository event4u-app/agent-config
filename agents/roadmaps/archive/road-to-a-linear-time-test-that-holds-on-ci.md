---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []  # probe — agent-config roadmap:context (base 8206cc0274, 2026-11-06), scanned: 1280 roadmap file(s) across active/later/stubs/archive, 3 PRs, 1023 remote branch(es): no sibling roadmap, no file overlap.
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

- [x] **1.1 Replace the single absolute sample with a growth check** — <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      time each shape at
      N and 4N (median of three runs each) and assert the ratio stays below a linear bound
      with headroom; keep an absolute ceiling far above the p95 budget only as a backstop.
      Not a loosened threshold: the assertion changes what it measures. Per
      `evaluator-independence` § Tests are evaluators, the new test is shown red against
      the removed quadratic regex before it lands, and an independent reviewer validates it.
      > note: done 2026-11-05 — growth n/8 → n, fastest of three, bound 28 (measured: linear 11–13×, removed form 62–67×); a negative control rejects the removed form; the hook budget is held on the 100,000-character page. Reviewed by OpenAI, two rounds: `agents/evidence/reviews/2026-11-05-linear-time-test-growth.md`.
- [x] **1.2 Verify on CI** — <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> the shard that ran it is green on three consecutive pushes.
      > note: done 2026-11-08 — `tests/scripts/design_slop_css_blocks_linear.test.ts` ran and passed (10 tests, none skipped) in Node Tests (ubuntu-latest) on three consecutive `main` pushes: run 42458954244 (`ceea998a0`, job 128663963890), run 42463228045 (`12bd765ce`, job 128676917337), run 42466095446 (`1dc17f40a`, job 128685928895). Read from each job's log, not from the run's overall status.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The growth check stops catching a quadratic regression | implementation | A ratio bound loose enough to survive runner noise could also admit the regex the test exists to forbid | 1.1 shows the new test red against the removed quadratic implementation before it lands, and an independent reviewer validates it | Phase 1 — measure growth, not one sample |
| 2 | Weakening the test while calling it a fix | product | Raising the 250 ms bound would silence the red and remove the guard | The bound is not raised; the assertion changes what it measures, and the absolute ceiling stays as a backstop | Phase 1 — measure growth, not one sample |
