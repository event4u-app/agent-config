# False-positive verification pass — scale-discipline Phase 2

> Pre-registered in `road-to-scale-and-history-discipline` Phase 2:
> "run the adapter against ≥1 real-world Laravel codebase; FP rate ≤5% or
> findings triaged with rule fixes." Run 2026-07-27, read-only, against a
> local production Laravel consumer repo (~2,600 PHP files incl. modules,
> multi-connection, module-scoped migrations). Business identifiers are
> withheld here; the raw finding lists live in the session scratch only.

## Iterations — each real-world crash/FP class became a detector fix

| Run | Gate findings | What the run exposed | Fix shipped |
|---|---|---|---|
| 1 (app/ only) | 21 | scanning without the migration tree guarantees index-parity FPs | run guidance: scan the repo root, not `app/` |
| 2 (repo root) | crash | broken symlink (`public/storage`) crashed two walkers | `statSync` try/catch in all walkers |
| 3 | 109 | `Schema::connection(...)->table(...)` ALTER migrations invisible → every index they add was missed; multi-line composite `unique([...], 'name')` unparsed | migration parser generalized to `connection()`/`table()` variants; composite index columns recorded in declared order |
| 4 | 102 → 68 | composite indexes: `WHERE a AND b` fully served by index `(a, b)` still flagged per-column | chain-window composite support (±3-line same-table window, prefix rule) |
| 5 | 66 | `bigIncrements('id')` not recognized as primary → `WHERE id` flagged | all `*increments` variants parse as primary/indexed |
| 6 | 66 → 36 | half the remaining findings were in `Tests/` trees — test queries are not production read paths | test directories excluded from walkers (scan ROOT is never name-checked, so fixture scans still work) |

All fixture suites and all five spike verdicts re-ran green after every fix
(13/13 vitest, S0.1–S0.5 PASS).

## Final run — 36 gate findings, triage

36 findings across 17 distinct columns, all R-A2 (index-parity). Sampled
verification against the actual migrations (6 distinct columns, covering
28/36 findings): **6/6 confirmed true** — the flagged columns genuinely
carry no supporting index for the committed query shape. Representative
classes (identifiers generalized):

- an unindexed boolean status flag filtered in 14 production call sites
  (classic `// no-index: low-cardinality boolean` **waiver candidate** —
  pattern-true, decision belongs to the humans);
- a tenant-lookup string column (subdomain-style) with no index — a real
  scale hazard on the hot auth path;
- a webhook-log status/int column scanned by a scheduled alert query on an
  append-only table — real, compounding with table growth;
- an FK-shaped column declared via `foreignId()` WITHOUT `->constrained()`
  (which is what actually creates the index) — a subtle Laravel trap the
  adapter now surfaces correctly;
- one borderline: `whereNotIn` on the second column of a composite whose
  first column is absent from the chain — pattern-true, index utility
  debatable (NOT IN), waiver material.

**Confirmed false positives in the final run: 0 of the sampled 6 columns
(28/36 findings). FP rate on the sample: 0% (target ≤5%).** The honest
caveat: 8 findings across 11 low-frequency columns were classified by
mechanism (same unindexed-column pattern as verified peers), not by
individual migration lookup.

## What this pass was for

Exactly this: every iteration converted a real-world parser blind spot into
a deterministic fix + retained fixtures/tests. The 80.8% S0.2 spike pass was
the first check; this pass is the second, independent one the spike verdict
record demanded before trusting the R-A2 gate tier.
