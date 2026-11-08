<!-- evidence-type: analysis -->

# Silent-catch reading on `unopim`, re-read: same 40 rows, same labels, 2026-11-08

Roadmap: `road-to-a-graph-that-wins` 6.2 and 6.3. Original run: `code-graph-detector-labels-2026-11-06.md`
(registration `internal/bench/code-graph/PREREGISTRATION-detector-labels-2026-11-06.md`).

**Method.** This run re-read the 40 sampled `unopim` silent-catch rows of the original run (`code-graph-detector-labels-2026-11-06/unopim.catch.jsonl`). It used the runner's `reread` command (`internal/bench/code-graph/detector_labels.ts`) at each row's own commit, with the graph as of `main` after 6.1 and the extractor side of 6.2: package route files, and views resolved by namespace with the entry path walking `renders` / `includes`.

**Labels.** The labels and their basis are unchanged. The runner keeps them, and a check over all 40 rows confirms they are byte-identical. No row was relabelled. The `unopim` checkout is the `event4u-app/unopim` fork; every row's commit resolves there.

Rows, readings and edges are in `code-graph-detector-labels-2026-11-08/unopim.catch.jsonl`, and the verdicts are in `report.json` beside it.

## Paired verdict

| Run | rows | graph answered | labelled | fire / quiet | verdict | wins / losses | p |
|---|---:|---:|---:|---|---|---|---:|
| 2026-11-06 (original) | 40 | 13 | 39 | 0 / 13 | regression | 2 / 11 | 0.0112 |
| 2026-11-08 (re-read) | 40 | 22 | 39 | 12 / 10 | no-change | 2 / 8 | 0.0547 |

The reading now fires: 11 of its 12 fires agree with a reachable label. The verdict moves from `regression` to `no-change` against the plain detector. That is not a `pass`: 8 rows the reader labelled reachable are still read `quiet`.

## Per construct

| Construct | rows | answered before | answered now | fire / quiet | still unanswered | labelled reachable |
|---|---:|---:|---:|---|---:|---:|
| Blade template (inline script) | 12 | 0 | 9 | 9 / 0 | 3 | 11 |
| PHP class | 12 | 12 | 12 | 3 / 9 | 0 | 11 |
| compiled bundle (`public/**/build`) | 12 | 0 | 0 | — | 12 | 2 |
| test code | 4 | 1 | 1 | 0 / 1 | 3 | 0 |

## Reading

- **Blade templates: the 6.2 extractor work landed.** Nine template catches are now read through `renders` / `includes` from a route, and all nine fire. Three remain unanswered: templates the graph does not state as rendered or included.
- **PHP classes: the remaining losses.** All 12 are answered, but 9 are read `quiet` where 11 are labelled reachable. The graph finds no entry path where an independent reader traced one. The edges recorded per row show where the walk stops, and this is the gap a further change would have to close.
- **Compiled bundles stay unanswered by design.** Built JavaScript under `public/**/build` has no indexed source declaration, and 2 of its 12 rows are labelled reachable.
- **Test code is out of scope.** Its 3 unanswered rows carry no reachable label.

## What this cannot show

This re-read covers one subject, 40 rows and one adjudicator's labels. The labels are predicate-conformance labels, not harm labels (registration, first section). As before, the graph-backed reading moves no detector's exit code.
