# Code-graph v3 — edge precision and recall per `resolved_via`, 2026-11-06

Roadmap: `road-to-a-graph-that-wins` 2.6. Instruments: `internal/bench/code-graph/edge_oracle.ts`
(scoring), `internal/bench/code-graph/php_edge_oracle.ts` (Psalm references for PHP). The
oracles are measuring instruments under `internal/bench/` only — never an arm, never a
provider (K1) — and every index came from the pinned oracle image
(`internal/bench/code-graph/oracle/`, `--network none`), never fetched at runtime (ADR-259).
Raw per-root output: `code-graph-v3-edges-2026-11-06/` beside this file.

## What was measured

| Root | Pin | TS/JS oracle | PHP oracle |
|---|---|---|---|
| this repository, `src/scripts/` | `8206cc0274` | scip-typescript 0.6.1 over `tsconfig.scripts.json` | — (no PHP) |
| unopim | `56071226` | scip-typescript 0.6.1, the 2.2 `allowJs` config | Psalm 7.0.3, 6,575 of 7,220 declarations mapped |
| larasend | `da5c06c7` | scip-typescript 0.6.1, the 2.2 `allowJs` config | Psalm 7.0.3, 713 of 802 declarations mapped |

Scored relations: `calls imports uses inherits references injects tests`. An edge is scored
only when both ends are inside the oracle's coverage; outside coverage is counted, never
read as refuted. File level: the oracle has a reference from the source file to the target
file (PHP: to the target's symbol). Symbol level: the reference lands on that node (PHP:
inside the source node's range). Graphs are the native build of this branch.

Input hashes (sha256): self index `0ca84897…`, unopim index `6aaa10a4…`, larasend index
`ae7e061a…`, unopim Psalm oracle `292c48b9…`, larasend Psalm oracle `b19de901…`; graphs
`9c9547ef…` (self), `b84b2f97…` (unopim), `c79660f6…` (larasend).

## Precision per mechanism — file level (symbol level in brackets)

Stated mechanisms (accepted by the gate verbs):

| `resolved_via` | `src/scripts/` (TS) | unopim TS | unopim PHP | larasend TS | larasend PHP |
|---|---|---|---|---|---|
| `import-specifier` | 100.0 % (100.0 %) · 16,751 | 100.0 % (100.0 %) · 446 | 100.0 % (98.5 %) · 458 | 100.0 % · 4 | 100.0 % (98.8 %) · 326 |
| `psr4` | — | — | 100.0 % (100.0 %) · 6,427 | — | 100.0 % (100.0 %) · 643 |
| `path-alias` | — | — | — | 100.0 % (100.0 %) · 10 | — |
| `test-import` | 100.0 % (100.0 %) · 182 | — | 100.0 % (100.0 %) · 2,035 | — | 100.0 % (100.0 %) · 199 |
| `class-hierarchy` | 100.0 % (100.0 %) · 116 | — | 99.9 % (99.0 %) · 2,766 | — | 100.0 % (99.7 %) · 395 |
| `same-file` | 100.0 % (91.6 %) · 26,450 | 92.8 % (83.3 %) · 681 | 100.0 % (100.0 %) · 11 | 100.0 % (41.7 %) · 36 | 100.0 % (100.0 %) · 1 |

Guess mechanisms (not accepted by the gate verbs — `NON_ACCEPTED_VIA`):

| `resolved_via` | `src/scripts/` (TS) | unopim TS | unopim PHP | larasend PHP |
|---|---|---|---|---|
| `name-lookup` | 39.8 % (29.5 %) · 166 | 100.0 % (89.0 %) · 680 | 98.5 % (97.7 %) · 265 | 100.0 % (100.0 %) · 21 |
| `dynamic` | 18.0 % (14.7 %) · 3,321 | 100.0 % (0.0 %) · 3 | 42.1 % (41.7 %) · 3,787 | 79.6 % (79.6 %) · 441 |

The number after `·` is the scored count. The split the acceptance policy draws holds on
every root: every stated mechanism is ≥ 99.9 % at file level wherever it scored more than
ten edges, except `same-file` on unopim's JavaScript (below); the guesses range from 14.7 %
to 100 % and are right to stay out of the gate.

## Recall — oracle cross-file pairs the graph has

| Root | file | symbol |
|---|---|---|
| `src/scripts/` | 96.9 % of 4,667 | 90.6 % of 10,682 |
| unopim TS | 93.9 % of 477 | 79.6 % of 607 |
| unopim PHP | 85.8 % of 6,460 | 69.2 % of 10,210 |
| larasend TS | 25.0 % of 40 | 20.6 % of 34 |
| larasend PHP | 96.8 % of 622 | 82.3 % of 1,048 |

## Two graph defects the oracle found — fixed in this change

1. **`parent::m()` resolved to the method it was written in.** `hierOwners` started its
   walk at the enclosing class, which declares `m` itself, so the call became a stated
   `class-hierarchy` self-edge — and where the parent lives in `vendor/`, the fallback
   candidate list still named the caller. Psalm refuted 8 such edges on larasend
   (`HandleInertiaRequests::share`, `ControlPasswordReset::__construct`, …). The walk now
   starts at the parents for `parent::` (and C# `base.`), and the caller is never its own
   candidate. larasend PHP `class-hierarchy`: 98.0 % → 100.0 % at file level; unopim
   carries 82 fewer `class-hierarchy` edges.
2. **A bare `f()` was bound to a same-file method.** PHP's `redirect()`, `current()`,
   `next()`, `view()` — global helpers — landed on a method of the same name in the class
   that called them. In PHP, TypeScript, JavaScript, Python and Go a bare call never reaches
   a method; free calls there now bind only to functions (Java, C# and Ruby call their own
   methods bare and keep the old rule). unopim PHP `same-file`: 18 edges removed, 55.2 % →
   100.0 % on what remains scored; unopim TS `same-file`: 18 edges removed.

A third defect sat in the shared SCIP reader, not in the graph: TypeScript ends a line at
U+2028, U+2029 and a lone CR, the native extractor at LF only, so in a file holding one of
them every later SCIP line pointed past its node. Four files in `src/` carry such a
character; a consumer's `index.scip` merged by `build.ts` was affected the same way.
`alignScipLines` now maps SCIP lines into the graph's numbering at every load site
(`build.ts`, `edge_oracle.ts`, `oracle_truth.ts`). `src/scripts/` `class-hierarchy` at
symbol level: 88.8 % → 100.0 %. Neither subject holds such a file, so the 2.2 truth is
unaffected.

Each fix landed test-first: `tests/scripts/code_graph_resolution_discipline.test.ts`
(§ parent::, § free call) and `tests/scripts/code_graph_scip.test.ts` (line alignment) were
run red against the unfixed code before the change.

## What the remaining misses are — oracle limits, named so they are not read as graph defects

- **`same-file` at symbol level on TypeScript (2,212 of 26,450 on `src/scripts/`).**
  Classified on the graph before the free-call fix (2,213 misses): 1,999 target a function
  declared inside another function — SCIP files those as `local` symbols, which carry no
  cross-node identity; 158 are `new C()` landing on the class in the graph and on
  `C::constructor` in SCIP (same call, two names); the remaining 56 were
  sampled (15): recursive self-calls, which `scipEdges` never emits, and functions declared
  inside an anonymous test callback. larasend's 21 are all of the first kind.
- **`same-file` on unopim JavaScript, file level (49 of 681).** Not classified; recorded as
  an open residual.
- **PHP global functions.** Psalm 7 records reference locations for methods and class-likes
  only — `addReferenceToFunctionLike` is never called for a function call — so a call to a
  Pest helper or a framework function cannot be confirmed. Function targets are outside the
  PHP oracle (36 larasend `same-file` edges, all Pest helpers), never counted as refuted.
- **larasend TS recall (25 %).** 30 of the 40 oracle pairs point at ambient declarations
  (`resources/js/types/vue-shims.d.ts`, `global.d.ts`): the indexer resolves `import X from
  './X.vue'` to the wildcard module declaration, the graph to the `.vue` file the oracle
  cannot index. It measures the oracle's Vue blind spot (also named in 2.2), not the graph.
- **unopim PHP recall (85.8 %).** The missing pairs are 699 class, 450 method, 127 interface
  and 3 trait targets; the top examples are `config/concord.php` naming providers by
  `X::class` in a config array and interface-typed calls through `Grammar`. Recorded, not
  classified further.
- **`src/scripts/` coverage.** `tsconfig.scripts.json` has no `allowJs`, so 871 of the 1,045
  `name-lookup` edges (sources in `.js` files) are outside the oracle.

## Not performed

The **same-roots parity run** against the external code-graph tool of round
`inbox-2026-10-bb`: the tool is not installed on the maintainer machine, and this runner
does not install external code (ADR-259). Step 2.6 stays open on that part alone.
