# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 8e85888f051f08850eef9bc066b5e7a124933c2d4ba88cfc8b2eaa3111c91840 | diff: fbadafa4874540c0192ede8cd7580fa503eae6dd | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: 7544d3ad143bbf2db19d34f8b9a6caf080003b21c31d5b531e6a9c9521320d50 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: fbadafa4874540c0192ede8cd7580fa503eae6dd
  scope_hash: 8e85888f051f08850eef9bc066b5e7a124933c2d4ba88cfc8b2eaa3111c91840
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: b411130143047cbc4b9812132d6e46daab63585705c4eaddad506212482b92b4
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T01:01:11Z
-->

Round 6. Round 5 (`round5-review.md`) was closed by this reviewer: each of its three
open rows (#6-#8) was re-verified against the code at `fbadafa48` and found fixed,
then archived per contract §2.7. Rows 2-4 below carry those verdicts; rows 1 and 5
are new (rows sorted by severity per §2.2). The prompt is recorded in `<slug>.review-input/prompt.md`, including the
caller's instructions verbatim; `prompt_hash` binds that file as committed.

Disclosure of method, because §5's tool allowlist was not held exactly: besides the
branch diff and branch-touched files, this review read the round-5 artefact (the
caller instructed it), `git log` of the branch range, the R2 contract and
dispatcher, and the non-branch modules the bench calls into
(`code_graph/query.ts` `loadGraph`, `code_graph/sqlite_store.ts`,
`hooks/turn_end_gate_hook.ts`, `_lib/graph_feeder_record.ts`). It ran
`tests/scripts/bench_graph_feeder_latency.test.ts` (8/8 green) and three scratch
probes outside the tree: `benchRepo` on a generated fixture with its SQLite twin
deleted; `loadGraph` over a scratch COPY of this repository's 59 MB
`code-graph-v1.json` (4 calls); and `readFileSync`+`JSON.parse` versus
`emitSqliteTwin` on that copy (3 calls). Same machine class as the page, one
sitting, not a published reading. Page arithmetic (ratios, 3 % of 30 s, p50/p95
gaps, factor 1.7) was re-derived and holds.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:142 | The page attributes the dominant ≈ 634 ms load term to "parsing the 59 MB JSON cache", and step 3.4's precondition builds its remedy on that ("cut the load term (a cached or incremental open)", page line 190-192, roadmap line 176). `loadGraph` (`code_graph/query.ts:128-200`) does more than parse: on every call without a valid SQLite twin it also attempts `emitSqliteTwin`, then validates and builds two edge maps and a lexical index. Probed on a scratch copy of this repository's graph: `readFileSync`+`JSON.parse` 76-104 ms; `emitSqliteTwin` 83-95 ms, returning `false` every time (no twin is ever written, so the attempt repeats on every stop; the main checkout's `agents/runtime/state/` likewise holds no `.sqlite3`); whole `loadGraph` 443-489 ms. Parsing is roughly a fifth of the load, a failed cache write roughly another fifth, and the rest is validation and index construction. A reader acting on step 3.4 would target JSON parsing or "add a cache", while a cache already exists and silently fails at this graph size; the generated fixture, whose twin does get written, prices a different load path than the real index. Restating the load term as measured, or marking the parse attribution as unmeasured and naming the failed twin emit, closes it. | open | |
| 2 | low | tests/scripts/bench_graph_feeder_latency.test.ts:24 | (round 5, #6) Nothing checked that the `without` arm's feeder stops at `absent`. | fixed | Verified at `fbadafa48`: `bench` records `graphStateWithout = graphState(withoutDir)` (src line 76-77, 234, 281), the same call the hook's feeder makes (`turn_end_gate_hook.ts:1314`); test line 25-26 asserts `absent`. (`72c585b49`) |
| 3 | low | agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md:164 | (round 5, #7) The STATE line presented 583 ms as the current real-repository p95. | fixed | Verified at `fbadafa48`: line 164-167 gives the 583-1,007 ms range over five readings and names each, matching page table line 118-122. (`f1e91459c`) |
| 4 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:139 | (round 5, #8) The one-off split was mapped to "the first reading", which read as table row 1. | fixed | Verified at `fbadafa48`: line 139-145 names the third row (p50 884 ms); 195 + 634 = 829 ms fits under it. (`fbadafa48`) |
| 5 | low | src/scripts/bench_graph_feeder_latency.ts:310 | `benchRepo` is documented "Writes nothing" (line 310), the header calls `--repo` "read-only" (line 40-41), and the page repeats it (line 60-61). `graphUntestedVerdict` → `loadGraph` calls `emitSqliteTwin` whenever no valid twin exists, which writes `agents/runtime/state/code-graph-v1.sqlite3` into the measured repository. Probed: a fixture with its twin deleted had `code-graph-v1.sqlite3` again after `benchRepo(..., runs: 2)`. On this repository the emit happens to fail, so the published readings wrote nothing, but on a consumer repository whose twin is missing or stale, `--repo` writes a file the docs say it never writes, and the unbilled warm-up round absorbs that write so billed rounds measure the twin-backed path rather than what the first stop pays. Narrowing the claim to "no feeder row written" and naming the twin side effect closes it. | open | |
