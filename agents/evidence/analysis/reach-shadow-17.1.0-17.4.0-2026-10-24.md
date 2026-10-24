<!-- evidence-type: analysis -->

# Reach check shadow window, 17.1.0 to main

road-to-a-tick-the-shipped-path-earns 3.3, 2026-10-24. The report-mode reach check
(`check_step_production_reach`, step 3.2) shipped in 17.1.0 and ran report-only in every
release through 17.4.0. This file is the shadow report that the enforcement flip cites.

Command, run once over the whole window against the checkout's
`src/config/production-entries.json`:

```
./scripts-run src/scripts/check_step_production_reach --base 17.1.0 --head origin/main
```

Range: `81949b9dba` (17.1.0) to `df10716455` (`origin/main`, which is 17.4.0 plus one merge).

## Counts

| Reading | Count |
|---|---|
| Steps newly ticked in the window | 150 |
| Hits | 3 |
| True positives (tested code that no entry reaches) | 1 |
| False positives | 2 |

## Hit list

| Roadmap step | Symbols reported unreached | Verdict | Why |
|---|---|---|---|
| `road-to-a-graph-that-follows-you` 1.3 | `src/scripts/bench_graph_feeder_latency.ts#bench` and 5 more | false positive | The step's receipt bound names a maintainer bench script, so the check takes the bench as the subject. The step's shipped change is the graph store and `query.ts`, which the step does not name by path. |
| `road-to-a-graph-that-follows-you` 7.2 | `src/scripts/network_sources.ts#SourceCodebook`, `cloneRepoSource`, `fetchUrlSource`, `quotedAnchor` | true positive | Production imports only `RESEARCH_BRIEF` from `network_sources.ts` (`analysis_prompts.ts`). No entry, command or skill names the script, so the codebook the step changed runs only in tests. |
| `road-to-a-graph-that-follows-you` 8.4 | `src/scripts/_lib/lineage_seed.ts#seedMechanismsFromHarvests` | false positive | A one-shot seed. What ships is the ledger it wrote (`provenance/mechanisms.jsonl`), and the step's verify reads that ledger, not the function. |

## Decision

Two of three hits are false positives, and both are the same kind: a step whose named
`src/` path is not where its shipped behaviour lives. They do not justify a global
exemption. The check now accepts a line of its own in one step block starting `reach exempt: <reason>`
(reason at least 12 characters; a bare marker is refused; the phrase in a sentence, in backticks
or in fenced code is not a marker), and the step is recorded as a declared exemption in
the gate ledger. All three hits are on an archived roadmap, and the enforcing check reads only
a change's new ticks, so none of them reds a later change.

The true positive (7.2) is reported here and not reopened: the roadmap is archived, and this
file does not re-audit the archived estate (kill register K1).
