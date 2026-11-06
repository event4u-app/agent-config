---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-graph-that-wins
    relation: extends
    note: "Its AC-3 labelled rows found the graph-backed silent-catch reading losing to the plain detector on PHP (2 / 11, p 0.011); this file carries the two reach gaps behind that."
---
# Road to catch reachability on PHP

> **Source:** `internal/bench/reports/code-graph-detector-labels-2026-11-06.md` (AC-3 of
> `road-to-a-graph-that-wins`). On `unopim`, the graph-backed silent-catch reading never
> fired in 40 sampled catches; an independent reader found a route path for 24 of them. Two
> gaps account for the misses the run could name.

## Phase 1 — the two gaps

- [ ] **1.1 Package route files.** A Laravel package registers routes from its own files
      (`Routes/admin.php`, loaded by a service provider's `loadRoutesFrom`); the route lane
      reads none of them, so a controller action reached only through a package route has no
      entry point. Example from the run: `POST catalog/passports/reinstate/{publication}` →
      `PublicationController::reinstate` (unopim, `ProductPassport`).
      verify: a fixture package whose provider calls `loadRoutesFrom(__DIR__.'/../Routes/admin.php')`
      yields a route node with a stated `routes-to` edge to its action, and
      `entryPathReading` fires on a catch inside that action.
- [ ] **1.2 Catches with no enclosing indexed symbol.** 27 of the 40 sampled catches sit where
      no indexed declaration encloses the line, so the reading returns no answer. Measure which
      constructs these are (closures, arrow functions, class constants, Blade-compiled code) and
      index the enclosing one where the extractor can.
      verify: the 27 rows of `code-graph-detector-labels-2026-11-06/unopim.catch.jsonl` re-read
      after the change, with the share still unanswered reported per construct.
- [ ] **1.3 Re-read the labelled rows.** Recompute the graph-backed silent-catch reading on the
      same 40 rows with the same labels (no relabelling) and publish the paired verdict beside
      the original.
      verify: `tsx internal/bench/code-graph/detector_labels.ts report` over the re-read rows,
      committed as a new dated report.
