# Code graph vs grep — pre-registered 2-arm benchmark (HONEST NULL)

Run 2026-07-28 · design + win threshold pre-registered in
[`internal/bench/code-graph/PREREGISTRATION.md`](../code-graph/PREREGISTRATION.md)
(ground truth hash-bound before the run) · runner
[`run_bench.ts`](../code-graph/run_bench.ts) · machine-readable rows in
[`code-graph-vs-grep.json`](code-graph-vs-grep.json). Deterministic: zero
model calls; re-runnable against local clones of the three target repos.

## Verdict — NULL, decisively

The pre-registered threshold required graph recall ≥ grep + 10 pp on the 15
graph-shaped questions, precision within 5 pp, and ≥ 90% of grep's recall on
the negative controls. Measured (18 questions, 3 real repos):

| Metric (mean) | grep | code graph |
|---|---|---|
| Graph-shaped recall | **0.797** | 0.365 |
| Graph-shaped precision | **0.670** | 0.413 |
| Negative-control recall | **0.833** | 0.111 |

Recall delta: **−43.2 pp** (needed ≥ +10). All three threshold conditions
failed. The graph lost on its OWN home turf (impact analysis, call paths,
refactor scope), not just on the grep-optimal controls.

## Why — two measured root causes (engine limits, not harness artifacts)

1. **TypeScript symbol extraction is structurally thin.** On the TS/TSX
   frontend repo the built graph carries 170 TS symbol nodes vs 13,428 PHP
   symbol nodes in the same-shaped sibling repo — `export const foo = (…) =>`
   arrow-function exports (the dominant modern TS style) produce no symbol
   node, so `affected`/`query` return "(no matching relations)" for most
   real frontend symbols. Six of seven repo-b questions scored 0.00/0.00
   for the graph arm.
2. **Where PHP symbols DO resolve, recall still trails grep** because the
   truth sets include string-keyed consumers (gate abilities, event
   subscriber arrays, config keys) that have no static edge — exactly the
   dynamic-dispatch reality the questions probed.

A third, adjacent finding (not part of the measurement): the
`agent-config code-graph` **dispatcher drops `--root`/`--graph` flags** — it
always builds/queries the package's own repo. Discovered during the dry run;
the benchmark bypasses it by invoking `src/scripts/code_graph/cli.ts`
directly. Filed as a defect observation in the run notes; any future engine
work fixes the dispatcher first.

Build cost (amortized context): repo-a 2.5 s · repo-b 6.9 s · repo-c 6.7 s.
Output-bytes per question favored the graph arm only because empty results
are small.

## Per-question rows

See `code-graph-vs-grep.json` → `rows[]` (question id, category, per-arm
precision/recall/wall-time/output-bytes; 18 rows). Repo paths and
missed/wrong file lists stay in the local gitignored detail file per the
pre-registration's publication policy.

## Consequence (bound by the pre-registration + roadmap Phase 2)

- `code_graph.enabled: false` stays **permanent**.
- Deprecation notice at the next major; removal the major after, unless
  external evidence (a consumer-filed case where the graph answered what
  grep could not) appears before then.
- The "product-unproven" reviewer flag closes — the engine now carries a
  measured, published null instead of an open question.
- Recorded extension (not run): an agent-in-the-loop replication could test
  composition effects a single-probe retrieval harness cannot; nothing in
  this null forbids a consumer from running one.
