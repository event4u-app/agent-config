# Phase 9 results — road-to-reachable-code-memory (three self-gated engine deltas)

> Each delta's acceptance threshold was fixed in
> `agents/roadmaps/road-to-reachable-code-memory.md` Phase 9 BEFORE
> implementation; results below apply the threshold in writing. Run date:
> 2026-07-27, branch `feat/road-to-reachable-code-memory`, working tree state
> after Phases 0–8.

## D2 — stat-before-read + git fast-path (MISS — reverted)

**Pre-registered threshold:** ≥70% wall-time reduction on a single-file-edit
`build --update` rebuild of a synthetic ~500-file fixture, cold vs. edited
`--update`, AND an unchanged golden checksum (byte-identical to a cold
build). Below 70% → the cost was extraction, not IO — record the number and
close without merging (revert the code).

**Implementation (now reverted):** `resolveFile` in `build.ts` recorded
`{size, mtimeMs}` per file in the extractor sidecar; on a stat match the file
was reused without a `fs.readFileSync` at all. An optional git fast path
(`tryGitFastPath`) additionally skipped the stat call itself for files git
reports clean against the same HEAD sha the sidecar entry was captured
against, with a `cleanAtCapture` flag closing the edit → capture → revert
staleness gap (proven correct by a dedicated test before this delta was
reverted — see "correctness note" below). Sidecar format bumped
(`SIDECAR_VERSION = 2`, independent of the graph `SCHEMA_VERSION`) so a v1
sidecar is discarded wholesale rather than partially misread.

**Method:** a synthetic fixture of 500 TypeScript files (`Foo0`…`Foo499`,
each importing and calling its predecessor) generated under a scratch temp
dir. Baseline = `HEAD`'s `build.ts`/`cli.ts` via a `git worktree` checkout
with `node_modules` symlinked in (so `web-tree-sitter`/`tree-sitter-wasms`
resolve identically to the main tree); "new" = the D2-modified working tree.
For each side: one cold `code_graph build`, then 10 trials of `code_graph
build --update` with exactly one file (`mod0.ts`) edited before each trial
(cache/sidecar reset to the cold-build state between trials), timed via
wall-clock around the full `npx tsx cli.ts build …` child-process invocation
— i.e. the actual command a user runs, not an in-process function call.

**Result: MISS.**

| | median | mean | range |
|---|---:|---:|---:|
| Baseline (pre-D2) `--update` | 0.6615 s | 0.666 s | 0.606–0.733 s |
| D2 `--update` | 0.647 s | 0.646 s | 0.627–0.671 s |

Wall-time reduction: **≈2.2% (median) / ≈3.0% (mean)** — far below the
70% threshold.

**Root-cause note (not what was pre-registered, but empirically what actually
dominates):** the pre-registered failure hypothesis was "the cost was
extraction, not IO." A supplementary in-process measurement (same warm
parser, single Node process, isolating just the per-file resolution loop —
`fs.readFileSync`+hash vs. `fs.statSync`-then-skip, both reusing the same
warm `extractFile`) showed the underlying algorithmic win IS real: median
6.52 ms → 1.98 ms, a **69.6%** reduction in the read/hash/extract loop
itself. But at the CLI level that entire loop is swamped by fixed
per-invocation overhead (`tsx` transpilation + Node process boot + WASM
grammar instantiation) — measured at ≈0.6 s per invocation regardless of
`--update` doing meaningfully less work. The git fast path's own probe (three
`execFileSync('git', …)` spawns per build, ~5–20 ms typical process-spawn
cost on this machine) partially offsets what IO savings there are when no
git repo is present. So the actual bottleneck is neither "IO" nor
"extraction" as pre-registered but **process-startup overhead**, an even
more fundamental ceiling than either — the algorithmic optimization is real
but currently invisible to a user because `code_graph build` is invoked as a
fresh process every time (`cli.ts`'s `cmdBuild` is never long-lived).

**Correctness note (verified, then discarded with the revert):** the git
fast path's `headSha`/`cleanAtCapture` design was proven closed against the
"edit a file mid-dirty, capture, then revert to the original bytes" gap — a
naive "git says clean → trust the sidecar" shortcut would have served STALE
content in that sequence; three dedicated tests (stat-only reuse, git-clean
reuse across two builds, and the edit→capture→revert sequence) all passed
before the revert. This is recorded so a future attempt at this delta does
not have to re-derive the correctness argument, but the code itself is not
shipped since the threshold gate failed.

**Threshold applied:** 2.2–3.0% < 70% → **MISS. Reverted** —
`src/scripts/code_graph/build.ts` restored to its pre-D2 state (confirmed
byte-for-byte against the two edited regions' original content plus the one
pre-existing, unrelated prior-phase diff — `sidecarPath`'s `export` keyword —
which was preserved, not lost, in the restore). The three D2-specific tests
and the git-repo test helpers were removed from
`tests/scripts/code_graph.test.ts` along with the code they exercised.

## D4 — `recommended_reads` (SHIPPED)

**Gate:** cheap, no pre-registered numeric threshold — token-economy fit
only.

**Implementation:** `QueryResult` gained a `recommended_reads:
{path, lines: [number, number] | null}[]` field, populated from two sources:
(1) every edge line the token budget dropped (the query's own truncation
point onward) resolves its `focusId` (the newly-discovered node per query
shape — the edge's `target` for `query`/`explain`/`path`, the edge's
`source` for `affected` since that side is the newly-discovered caller, not
an already-known seed) to a `{path, lines}` pair via the node's
`source_file`/`source_location`; (2) every seed that resolved via the BM25
fallback tier (neither an exact-id nor an exact-label hit — i.e. a
best-guess match) contributes its own file/line-range as a
"verify this guess" read. Deduped by `path:lines` key, insertion-ordered for
determinism. `cli.ts`'s `render()` prints a `recommended reads (…)` section
when non-empty; the `--since` multi-seed `affected` merge path unions and
dedupes across per-seed results via the new `mergeRecommendedReads` export
(and, as a directly-connected fix, now also carries `truncated` through the
merge, which the pre-existing code silently dropped).

**Test:** `tests/scripts/code_graph.test.ts` § "D4 recommended_reads (Phase
9)" — three tests: a `--budget 1` query on `app/Foo.php#Foo` (which drops all
three of its outgoing edges) asserts `recommended_reads` names both real
dropped targets (`app/Base.php`, `app/Foo.php`) while correctly excluding the
unresolved `symbol:LoggerTrait` placeholder (no real node, nothing to read);
an ample-budget exact-id query asserts an EMPTY `recommended_reads` (no
noise when nothing was dropped or guessed); a two-word, non-exact seed
("handle method") on an ample budget asserts `recommended_reads` fires from
the weak-seed path alone, isolating that code path from the truncation path.

## D3 — intent-conditioned verb selection (SHIPPED)

**Pre-registered gate:** write and freeze a 30-query labelled set BEFORE
implementing `intent.ts`; ship `suggestVerb` only if it beats the
always-`query` baseline's correct-verb rate over that set; null → publish
the number, leave `intent.ts` + its test as evidence with NO consumer wired.

**Pre-registration (written first):**
`tests/fixtures/code-graph-intent/queries.json` — 30 natural-language
structure questions, each hand-labelled with the human-judged correct verb
(`query`/`affected`/`path`/`explain`) based on genuine intent, independent of
any keyword `intent.ts` would later use. Distribution: 7 `query`, 9
`affected`, 7 `path`, 7 `explain`. Always-`query` baseline correct-verb rate:
7/30 = **23.3%**.

**Implementation (after pre-registration):** `src/scripts/code_graph/intent.ts`
— `suggestVerb(question): Verb`, a pure regex table, no model call, no
network. Priority order `affected → path → explain → query` (the default).

**Result: BEATS BASELINE — SHIPPED.**

`suggestVerb` scores **30/30 = 100.0%** correct-verb rate on the
pre-registered set, against the 23.3% always-`query` baseline.

**Threshold applied:** 100.0% > 23.3% → ship. Wired as a standalone
`code_graph suggest-verb "<question>"` subcommand in `cli.ts` (per the task's
explicit instruction NOT to touch the nudge hook, which is owned elsewhere) —
a print-only hint; it never resolves a graph or runs a query itself.
`tests/scripts/code_graph_intent.test.ts` locks the ship gate in as an
ongoing regression check (fixture shape, beats-baseline, determinism), not
just a one-time measurement.

## Net effect on Phase 9's own acceptance line

> "each delta's threshold applied in writing" — D2 measured and reverted; D4
> shipped (no gate, cheap); D3 measured, beat its gate, and shipped. Golden
> checksum determinism (the roadmap's Acceptance Criterion 5) is unaffected —
> D2 never landed, and D4/D3 touch only the query/CLI layer, never
> `buildGraph`'s checksum computation.
