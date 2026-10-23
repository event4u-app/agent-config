# Orientation with and without the map — 2026-10-23

> Registered before the run in
> `internal/bench/code-graph/PREREGISTRATION-orientation-2026-10-23.md` (committed in the run's PR
> ahead of this report). Twelve runs: six questions × two arms, one fresh read-only subagent
> each, same model, same prompt apart from the one tool-scope sentence. Tool calls and tokens are
> the harness's own per-subagent counts.

## Verdict — TIE

| | Arm A — search only | Arm B — map first |
|---|---|---|
| Correct (key) | 6 / 6 | 6 / 6 |
| Median tool calls | 3.5 | 3 |
| Total tokens | 143,059 | 149,150 |

The bar for a win was equal correctness **and** median tool calls ≤ 0.8 × A's (≤ 2.8). B's median
of 3 misses it, so the registered outcome is a **tie**. Per the registration: the map stays on
demand, the `code-intelligence` skill keeps it as an optional first step, and the context hook
stays unchanged (roadmap step 5.4).

## Per question

| ID | A calls | B calls | A tokens | B tokens | A | B | Note |
|---|---|---|---|---|---|---|---|
| R1 council subsystem | 3 | 3 | 23,750 | 23,497 | 1 | 1 | B named the area page and its member count; A listed the directory |
| R2 deps of `query.ts` | 3 | 2 | 22,820 | 22,385 | 1 | 1 | both read the import lines |
| R3 most-imported `_lib` | 4 | 4 | 24,332 | 23,999 | 1 | 1 | B did not open the map at all — a counting question grep answers directly |
| L1 `GET /books` | 5 | 2 | 25,001 | 26,124 | 1 | 1 | B answered from MAP.md's request paths **without opening a file**; it stated the paths as expected rather than checked |
| L2 shelves controller | 3 | 3 | 23,115 | 25,225 | 1 | 1 | — |
| L3 `pages` table | 4 | 4 | 24,041 | 27,920 | 1 | 1 | B also found the inherited `$table = 'entities'` — see below |

## What the run found that the score does not show

- **The request-path question (L1) is where the map pays.** Five calls became two, and the
  answer came from one section of MAP.md. The other five questions were either answerable by one
  grep (R2, R3) or by one file once found (L2, L3), and there the map is an extra read.
- **A defect, found by arm B and fixed in the same PR.** Its answer to L3 noted that `Page`
  inherits `$table = 'entities'` from its abstract parent. The Laravel overlay read `$table` from
  the model's own file only and fell back to the naming convention, so it had drawn `Page → pages`,
  `Book → books` and `Chapter → chapters` — three wrong edges. The overlay now follows the
  inherited `$table`; a regression test pins it and was seen red against the old code.
- **The L3 key's premise was imprecise.** "Which model owns the `pages` table" assumed a table the
  application has since folded into `entities`. Both arms named `Page.php` and its relations, so
  the score stands as registered; the premise is recorded here rather than re-scored.

## Limits

Six questions, one run per arm, one model. This can show a large difference and cannot show a
small one, which is the stated reason a tie was the expected outcome below roughly a third fewer
calls. Not comparable to the graph-vs-grep retrieval reports.
