<!-- evidence-type: analysis -->
# Code-graph edge census — 2026-10-26

Roadmap: `road-to-edges-that-earn-their-target` (0.1, 0.2). Instrument:
`internal/bench/code-graph/edge_census.ts`. Both graphs built with
`npx tsx src/scripts/code_graph/cli.ts build --root .` on this repository, and
both read with the SAME census version (the one committed beside this page), so
the two columns are comparable. Wall-clock is irrelevant here; these are counts.

## Readings

| Metric | before (`700c41137b`) | after Phase 1 |
|---|---:|---:|
| `name_lookup_calls` — repo-wide name-lookup `calls` onto a real node | 2,095 | 899 |
| `name_lookup_multi` — of those, the census sees >1 candidate | 460 | 10 |
| `name_collision_edges` — the resolver recorded a collision as AMBIGUOUS | 0 | 513 |
| `symbol_targets` / AMBIGUOUS among them | 39,878 / 12,924 | 40,724 / 13,445 |
| `suppressed_edge_counts.dynamic_no_candidate` | 101,053 | 101,110 |
| edges by `class-hierarchy` (new stated mechanism) | 0 | 207 |

Top multi labels before: `resolve` 52, `run` 32, `write` 30, `at` 29, `git` 18,
`walk` 17, `key` 13, `read` 12.

## What the census can and cannot see

The first census draft counted constants and nested functions as candidates the
resolver never holds; its pre-change reading was 727 of 2,095, matching the
inbox round's shape (684 of 1,342 on an older tree). The committed version mirrors
the resolver: callable kinds only, test files out of a production caller's pool,
and a function inside another function's range out of every pool. Re-read with
it, the pre-change figure is 460.

**The 10 after Phase 1 are census artefacts, all inspected.** Each target is the
only top-level candidate the resolver held; each twin the census counts is a
function declared inside an anonymous `describe(…)` / `it(…)` callback in a test
file (`check_gate_coverage.test.ts#res` at 367:11, `consumer_impact.test.ts#c`
at 246:11, and so on). The graph emits no node for an anonymous callback, so its
range cannot be read off the node list, while the extractor knows the binding is
below module level and keeps it out of the name table (`FileExtract.nestedIds`).
The resolver's own record of arbitrary winners is therefore 0: every case with
more than one candidate it saw is one of the 513 `name-collision` edges.

`name_lookup_multi` stays a census of the graph's shape, not of the resolver's
choices, and over-reports exactly this nesting. Closing that gap needs a nesting
flag on the node, which is a schema change and not taken here.

after Phase 1: name_lookup_multi: 10, residue attributed in full (census cannot see nesting inside anonymous callbacks); resolver arbitrary winners: 0
