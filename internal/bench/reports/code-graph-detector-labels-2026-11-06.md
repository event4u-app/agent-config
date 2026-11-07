# Graph-backed detectors — labelled rows and paired verdicts, 2026-11-06

Roadmap: `road-to-a-graph-that-wins` AC-3. Registration:
`internal/bench/code-graph/PREREGISTRATION-detector-labels-2026-11-06.md` (council-reviewed).
Runner: `internal/bench/code-graph/detector_labels.ts`. Rows, readings, recorded edges and
labels: `code-graph-detector-labels-2026-11-06/`.

**Result: both detectors now carry paired verdicts on labelled rows, and they point in
opposite directions on PHP.** The deleted-test reading agrees with its oracle predicate on
every labelled row it answered (`pass`, 6 / 0, p 0.016). The silent-catch reading loses to the
plain detector (`regression`, 2 / 11, p 0.011): it never fired, while an independent reader
found a route path for 24 of 40 sampled catches.

The labels are predicate-conformance labels, not harm labels (registration, first section): a
`pass` here licenses no suppression, a `regression` changes no exit code — the graph-backed
readings never moved the detectors' exit codes and still do not.

## Verdicts

| Detector · subject | rows | graph answered | labelled | fire / quiet | verdict | wins / losses | p |
|---|---:|---:|---:|---|---|---|---:|
| silent-catch · self | 20 | 15 | 0 | 0 / 15 | underpowered | 0 / 0 | 1.0000 |
| silent-catch · unopim | 40 | 13 | 39 | 0 / 13 | regression | 2 / 11 | 0.0112 |
| test-file-deleted · self | 2 | 2 | 2 | 2 / 0 | underpowered | 0 / 0 | 1.0000 |
| test-file-deleted · unopim | 21 | 17 | 17 | 10 / 7 | pass | 6 / 0 | 0.0156 |

Rows the graph did not answer and unlabelled rows stay out of a verdict. The `self` silent-catch
rows are domain controls (this repository has no HTTP entry points): no label, no verdict — the
graph answered `quiet` on all 15 it could read.

## Reading

- **Deleted tests (PHP, 21 rows).** 16 both answered and labelled at the parent commit: 10 `fire`
  where Psalm confirms the test's subject is referenced elsewhere, 6 `quiet` where it is not,
  no disagreement; 5 rows had no answer or no label (the test outside the analysed set, or no
  indexed test file). The two TypeScript rows both `fire`; one label
  disagrees, which a sign test over one row cannot weigh.
- **Silent catches (PHP, 40 sampled).** The reading answered 13 and fired on none. The reader
  labelled 24 reachable, 15 not, 1 unknown. Two gaps account for what could be traced: routes a
  package registers from its own files (`Routes/admin.php`, loaded by a service provider) are
  not read, so a catch one call below such a route has no entry point; and 27 of 40 catches sit
  where no indexed declaration encloses the line, so the reading cannot start. Both are carried
  in Phase 6 of `road-to-a-graph-that-wins`.
- **The disagreement the council recorded on `underpowered`** (registration § Council revisions)
  turned out moot for PHP: both PHP verdicts are decisive.

## Limits

- The silent-catch label is a model's reading of the code — independent of the graph, not of
  model error; its reply and path are stored per row (`label_basis`).
- Small n: 21 deletions; 40 sampled catches.
- PHP tests outside Psalm's analysed set yield no label (never a negative one).
