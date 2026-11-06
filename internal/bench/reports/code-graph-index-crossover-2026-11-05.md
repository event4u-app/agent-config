# Code-graph index crossover — 2026-11-05

Road-to-a-graph-that-wins 4.6: replace the declared `INDEXED_READ_MIN_EDGES`
(50,000) with a measured crossover, or confirm it.

**Result: the crossover is ~10,000 edges. The threshold is now `10_000`.**

## Method

`internal/bench/code-graph/index_crossover.ts` writes synthetic graphs shaped
like this repository's own (274,338 edges / 73,307 nodes measured on the twin
of 2026-11-05: ~3.7 edges per node, ~20 % of nodes with a ~180-byte fact,
~50-character ids, mostly `calls` / `member` / `imports`), each with its SQLite
twin, and times two per-invocation costs on both paths. A CLI or MCP call
loads the graph afresh each time, so load cost is part of every answer:

- **query** — `loadGraph` + `affected` (depth 2) for 10 seeds + `close`
- **review-risk** — `loadRiskSource` + `reviewRisk` over a 5-file diff + `close`

The path is forced with `AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES` (`0` = index,
`Infinity` = JSON). Figures are medians of 5 runs (7 for the small sizes),
milliseconds, wall clock.

Machine: Apple M5 Max, darwin-arm64, Node v26.7.0, commit f8c5329d1e plus the
4.6 working tree.

```
npx tsx internal/bench/code-graph/index_crossover.ts --sizes 2500,5000,10000,25000,50000,100000,200000 --reps 5
npx tsx internal/bench/code-graph/index_crossover.ts --sizes 250,500,1000,2500 --reps 7
npx tsx internal/bench/code-graph/index_crossover.ts --sizes 1000 --reps 3 --real <copy of agents/map/.build/code-graph-v1.json>
```

## Readings

| edges | JSON bytes | query index | query JSON | review-risk index | review-risk JSON |
|---:|---:|---:|---:|---:|---:|
| 250 | — | 1 | 1 | 3 | 1 |
| 500 | — | 1 | 1 | 3 | 1 |
| 1,000 | — | 1 | 2 | 4 | 1 |
| 2,500 | 758,009 | 1 | 5–7 | 4–6 | 2–3 |
| 5,000 | 1,524,373 | 1 | 13 | 7 | 5 |
| 10,000 | 3,069,210 | 1 | 25 | 8 | 9 |
| 25,000 | 7,694,853 | 1 | 71 | 9 | 24 |
| 50,000 | 15,443,294 | 1 | 127 | 10 | 45 |
| 100,000 | 31,125,367 | 2 | 291 | 24 | 95 |
| 200,000 | 62,427,790 | 2 | 492 | 30 | 172 |
| **274,338 (this repository)** | 104,317,207 | 6 | 586 | 26 | 207 |

## Reading

- **query** crosses between 500 and 1,000 edges: below that both paths take
  about a millisecond, above it the parse grows linearly (~2.5 ms per 1k edges)
  while the index stays at 1–2 ms.
- **review-risk** crosses at ~10,000 edges (8 vs 9 ms). Below it the index is
  2–3 ms slower: it opens the database and runs its scoped reads (kind, file,
  fact owner, `co-changes`), which a small parsed graph answers from memory.
- One threshold governs both readers. The later crossover is taken, so neither
  is slower on the index than on the parse; at 10,000 edges the query path
  already saves ~24 ms per call.
- At the old 50k the parse cost 127 ms (query) and 45 ms (review-risk) against
  1 ms and 10 ms on the index: the declared threshold was conservative by a
  factor of five.

## Limits

- Synthetic shape, one machine. The real-repository row agrees with the
  synthetic trend at its size.
- Warm page cache on both paths; a cold disk would penalise the JSON's 100 MB
  read more than the index's few pages, which moves the crossover down, not up.
- Revisit if a reader is added whose index path does a whole-table read (the
  BM25 corpus in `lexicalCorpus` is one), since that shifts its crossover up.
