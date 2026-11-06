# Code-graph v3 — same-roots parity run against an external code-graph tool, 2026-11-06

Roadmap: `road-to-a-graph-that-wins` 2.8. The tool is the one the `inbox-2026-10-bb` round
compared; per `source-confidentiality` it is not named here. It ran on the maintainer's
machine at a pinned release, installed from its package registry into a local image and
run with `--network none` in code-only mode (no LLM, no API key in the environment). The
image recipe stays maintainer-side.

Same roots, same pins, same oracles as 2.6
(`internal/bench/reports/code-graph-v3-edges-2026-11-06.md`): this repository's
`src/scripts/` at `8206cc0274`, unopim at `56071226`, larasend at `da5c06c7`, scored against
the identical scip-typescript 0.6.1 indexes and Psalm 7.0.3 oracles. The native figures
below are the 2.6 figures, unchanged. Raw per-root output: `code-graph-v3-parity-2026-11-06/`.
External graph hashes (sha256 prefix): self `fa17f279`, unopim `27428043`, larasend `626e82e9`.

## How an external graph is scored

`internal/bench/code-graph/parity_graph_adapter.ts` turns the tool's node-link export into
the edge shape `edge_oracle.ts` reads (`tests/scripts/code_graph/parity_graph_adapter.test.ts`).

- **Mechanism.** The tool has no `resolved_via`. Each edge is keyed on the tool's own
  confidence tag joined to the relation family — `extracted:calls`, `inferred:imports`, … —
  so its stated/guessed split is read off its own claim, as the native split is.
- **Relations.** Folded onto the scored families: `calls`, `indirect_call` → calls;
  `imports`, `imports_from`, `re_exports`, `dynamic_import`, `includes` → imports;
  `references`, `references_constant`, `uses_static_prop` → references; `inherits`,
  `extends`, `implements`, `mixes_in` → inherits. Left out, as the native graph's are:
  containment (`contains`, `method`, `defines`, `declares`, `case_of`), documentation
  (`cites`, `rationale_for`) and framework bindings (`bound_to`, `uses_config`).
- **Symbols.** The tool's nodes carry a start line, not a range. Each endpoint is mapped onto
  the native node declared in the same file on the same line (the label decides between
  several), and the native nodes are carried over, so both graphs are scored against the
  same symbol ranges. An endpoint with no native declaration on its line falls back to its
  file — scored at file level, not at symbol level. Unmapped symbols: self 3,082,
  unopim 4,459, larasend 470. The tool's symbol-level recall is therefore a **lower bound**.
- **Unresolved.** A target with no file (an external module) becomes an unresolved target,
  excluded exactly as the native graph's `symbol:` targets are.

## Result

Precision is file / symbol, with scored edges in brackets. "Stated" is the native gate's
accepted mechanisms against the tool's `EXTRACTED`; "guess" is native `name-lookup` +
`dynamic` against the tool's `INFERRED`.

| Root | Lang | Tool stated | Native stated | Tool guess | Native guess | Recall file tool / native | Recall symbol tool / native |
|---|---|---|---|---|---|---|---|
| self `src/scripts/` | TS | 100.0 % / 98.9 % (44,054) | 100.0 % / 94.9 % (43,499) | 98.2 % / 97.6 % (1,399) | 19.0 % / 15.4 % (3,487) | 97.6 % / 96.9 % | 92.6 % / 90.6 % |
| unopim | TS/JS | 98.2 % / 88.3 % (1,960) | 95.7 % / 83.6 % (1,127) | 99.1 % / 99.1 % (112) | 100.0 % / 88.6 % (683) | 89.5 % / 93.9 % | 93.7 % / 79.6 % |
| unopim | PHP | 97.8 % / 97.3 % (12,461) | 100.0 % / 99.7 % (11,697) | 26.1 % / 26.0 % (3,117) | 45.8 % / 45.4 % (4,052) | 83.9 % / 85.8 % | 62.0 % / 69.2 % |
| larasend | TS | 100.0 % / 90.0 % (35) | 100.0 % / 54.3 % (50) | 100.0 % / 33.3 % (6) | — (0) | 27.5 % / 25.0 % | 20.6 % / 20.6 % |
| larasend | PHP | 99.5 % / 98.8 % (1,516) | 100.0 % / 99.7 % (1,564) | 98.2 % / 98.2 % (271) | 80.5 % / 80.5 % (462) | 83.1 % / 96.8 % | 68.0 % / 82.3 % |

Per relation family (raw files): the tool's weakest stated family is PHP `extracted:calls`
— 93.3 % file precision on unopim (3,923 scored), 98.8 % on larasend. Every other stated
family with more than ten scored edges reads ≥ 99.8 % except unopim TS `extracted:calls`
(95.2 %, 744).

## Reading

- **No side wins outright.** On PHP the native graph is ahead on every axis: stated
  precision (100.0 vs 97.8 / 99.5 %), file recall (85.8 vs 83.9 %; 96.8 vs 83.1 % on
  larasend) and symbol recall (69.2 vs 62.0 %; 82.3 vs 68.0 %), where the PSR-4 and
  test-import mechanisms do work the tool's call/import extraction does not.
- **On TypeScript the tool is ahead at symbol level.** Its stated symbol precision is higher
  on all three roots (98.9 vs 94.9 % on `src/scripts/`; 88.3 vs 83.6 % on unopim; 90.0 vs
  54.3 % on larasend's 35–50 edges), and its symbol recall is higher on unopim TS (93.7 vs
  79.6 %). File recall splits: ahead on `src/scripts/` (97.6 vs 96.9 %), behind on unopim
  (89.5 vs 93.9 %). The native gap sits in `same-file` (91.6 % symbol precision on
  `src/scripts/`) and is the oracle's, not the graph's: of its 2,212 unconfirmed edges, 2,012
  call a function nested inside another, which SCIP indexes only as a `local` symbol with no
  cross-node identity, and 158 land on a class the oracle names as its constructor — the two
  limits 2.6 names. 42 remain (39 top-level functions, 3 constants); without the two
  oracle-blind classes `same-file` reads 99.8 %. The tool has no node for the nested functions
  sampled (`splitClauses`'s `flush`, the `_parse` helpers' `emitError`), so such calls do not
  enter its scored set — the comparison favours it there by construction.
- **The guess tiers differ in kind.** The tool's `INFERRED` tier on TypeScript is nearly as
  precise as its stated tier (98.2 %), where the native guesses read 19.0 % — the native
  graph emits far more speculative edges and labels them as guesses. On unopim PHP the
  tool's `INFERRED` calls read 26.1 %, below the native guesses' 45.8 %. A consumer that
  keeps only stated edges sees comparable precision from both graphs.
- **larasend TS** is the indexer's Vue blind spot for both (2.6 § Oracle limits): 40 oracle
  pairs, 30 of them pointing at ambient `*.vue` declarations.

## Limits

- One release of the tool, one run per root; no repetition, because both extractors are
  deterministic on a fixed tree.
- Code-only mode. The tool's optional LLM extraction for documents was not run; it does not
  produce code edges the oracles could score.
- The adapter's relation folding is a judgement made before the run and stated above; the
  per-family raw tables let a reader re-fold.
- The symbol mapping favours neither side on ranges, but an endpoint the native graph never
  declared cannot be scored at symbol level, which can only lower the tool's symbol figures.
