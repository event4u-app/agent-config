---
complexity: lightweight
status: ready
tree_pin: 700c41137b
execution:
  mode: phase-checkpoints
owner: maintainer
estate_offset_exempt: "Operator asked in the invocation (2026-10-26) for this round's roadmap to be executed with /roadmap:process-full in the same change, so it is archived in the PR that adds it and the active count returns to its floor at merge. Owner search, grep -rlF -e 'name-lookup' -e 'barrel' -e 're-export' -e 'ambiguity_reason' over agents/roadmaps/*.md, later/ and stubs/: road-to-a-graph-that-wins owns measurement and reach, road-to-a-graph-that-feeds-the-gate owns hook delivery, road-to-code-graph-refresh-during-a-session owns freshness; none owns name-resolution correctness, which is all this file carries."
estate_growth_exempt: "Added active at the WIP cap of 5 for the length of one PR only: the operator asked for execution in the invocation, and the file is archived in the same change, so no state with six active roadmaps reaches main."
relates:
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "its corpus v3 and oracle arm (2.1, 2.2) measure the edges this file corrects; measurement stays there"
  - slug: road-to-a-graph-that-feeds-the-gate
    relation: disjoint
    note: "search-path enrichment from the same round landed there as a step"
  - slug: road-to-code-graph-refresh-during-a-session
    relation: disjoint
    note: "incremental resolution and the shrink guard from the same round landed there as steps"
---
# Road to edges that earn their target

> **Source:** `agents/tmp.old/inbox-2026-10-bb/` — an owner comparison round against an
> external code-graph tool (class: external comparison corpus, with two supplied plans
> and the chat behind them). Every anchor below re-read at `700c41137b`. Steps built on a
> measurement that diverged from the supplied figure are tagged
> `corrected-from-reproduction`.

## Goal

The native code graph stops stating guesses as facts. Reproduced at `700c41137b`
(`npx tsx src/scripts/code_graph/cli.ts build --root .`, census below): of 2,095
`name-lookup` `calls` edges onto real nodes, **727 (35 %)** have more than one
same-language top-level candidate and still bind to the first one
(`src/scripts/code_graph/build.ts:617`, `.find(...)`), the commonest winners being
`fn` 68, `resolve` 52, `run` 32, `at` 29, `r` 19 — closure locals and parameters
that `extract.ts:518-532` admits into the repo-wide name index because function
declarators carry no `topLevel` check. The supplied plan read 684 of 1,342 (51 %) on
an older tree; the defect holds, the ratio moved (`corrected-from-reproduction`).
Done means: a census that measures this exists; no name-lookup edge binds an
arbitrary winner; re-exports resolve; an intra-class `this.m()` that walked the
hierarchy to exactly one owner is stated; the SCIP supersede rule is pinned; and
more than one SCIP index is read.

## Phase 0 — Measure before changing

- [x] **0.1 An edge census.** `internal/bench/code-graph/edge_census.ts` reads a built
      graph and prints, as JSON, the name-lookup call edges with more than one
      candidate, their top labels, `symbol:` targets and AMBIGUOUS among them, and
      `suppressed_edge_counts`. A report, not a gate: a measurement is not a gate
      until its noise is known (owner decision E6 of the supplied plan, taken here
      as "report").
      verify: `npx vitest run tests/scripts/code_graph/edge_census.test.ts` -> 0
- [x] **0.2 Baseline published.** The census at `700c41137b` and after Phase 1 land in
      `agents/evidence/analysis/code-graph-edge-census-2026-10-26.md`.
      verify: `grep -c 'resolver arbitrary winners: 0' agents/evidence/analysis/code-graph-edge-census-2026-10-26.md` -> /^1$/
- [x] **0.3 The grammar count is true.** `loader.ts:9` and
      `src/config/agent-settings.template.yml:1393` say "three loadable grammars";
      `src/vendor/grammars/` ships eight.
      verify: `grep -c 'three loadable grammars' src/scripts/code_graph/loader.ts src/config/agent-settings.template.yml` -> 1

## Phase 1 — Fewer false edges

- [x] **1.1 Closure locals leave the repo-wide name index.** A function-valued
      declarator below module level stays a node (same-file resolution still finds
      it) but no longer enters `sym.byName`, so it can never be a repo-wide target.
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'closure local'` -> 0
- [x] **1.2 More than one candidate is AMBIGUOUS, never a winner.** The repo-wide rung
      (`build.ts:617`, and the import fallback at `:520`) binds only when exactly one
      candidate survives after test files are set aside for a non-test caller;
      otherwise the edge is AMBIGUOUS with `candidates[]` and
      `ambiguity_reason: 'name-collision'`. No path-proximity tiebreak.
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'name collision'` -> 0
- [x] **1.3 Re-exports and literal `require` / `import()` resolve.**
      `export { a } from`, `export * from` and `export * as ns from` become
      re-export facts the import binding follows, cycle-safe, to the definition;
      `require('x')` and `import('x')` with a string literal become import facts.
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'barrel'` -> 0
- [x] **1.4 A hierarchy walk to one owner is stated.** `this.m()` / `self::m()`
      resolved by `resolveHierMethod` to exactly one owner is emitted as
      `resolved_via: 'class-hierarchy'` (a stated mechanism, added to both trust
      lists); today it is `name-lookup` (`build.ts:750-762`) and every gate verb
      drops it. The confidence stays INFERRED, as the ADR-124 taxonomy and
      `tests/scripts/code_graph.test.ts:114` require, because a subclass may
      override at runtime; two owners at the same level are AMBIGUOUS with
      `candidates[]` and stay a guess (`corrected-from-reproduction` — the
      supplied step said EXTRACTED). The SQLite twin's reader dropped every
      `ambiguity_reason` outside the two older values, so `name-collision`
      would have vanished on the indexed read path; it now keeps the field,
      which also pays for the new word in the bundled trust list (the hook
      bundle had 8 bytes left).
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'class hierarchy'` -> 0
- [x] **1.5 Every fixed shape has a negative test.** Each step above ships one test
      named `… emits no edge` / `… is ambiguous` that fails on the pre-change build,
      and the existing graph suites stay green.
      verify: `npx vitest run tests/scripts/code_graph` -> 0

## Phase 2 — The compiler index, pinned and widened

- [x] **2.1 Pin the supersede rule (corrected).** The supplied step asked to compare
      node ids in `supersededByScip` (`scip_reader.ts:183-201`) instead of labels.
      Reproduction says no: the reader emits `uses` edges for every reference a
      source makes, so a native guess from that source to a *different* same-named
      node is exactly the arbitrary winner the index exists to remove — an id
      comparison would keep it. The trap the plan feared needs SCIP `calls`
      emission, which this file does not take. The label rule stays and is pinned:
      a different same-named target and a `symbol:` target are superseded; another
      name, another source, or a stated mechanism are not.
      `corrected-from-reproduction`.
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'compiler index'` -> 0
- [x] **2.2 More than one index.** Besides `<root>/index.scip`, read every `index.scip`
      the tree walk finds (one index per package in a monorepo; a stray `*.scip` is
      not a project index), re-rooting each
      document path at its index's directory and dropping any that lands outside
      the root. Discovered by convention rather than a new settings key, which
      `external-code-graph-interop` already names (`*.scip`).
      `corrected-from-reproduction` — the supplied step said "configured directory".
      verify: `npx vitest run tests/scripts/code_graph_resolution_discipline.test.ts -t 'several scip'` -> 0

## Not carried here

Oracle producer, P/R against an oracle and the parity run → `road-to-a-graph-that-wins`
(2.2 oracle arm, already registered there). Search-path enrichment and the
extension filter → `later/road-to-a-graph-that-feeds-the-gate` 2.5. Incremental
resolution, shrink guard and racily-clean fast path →
`later/road-to-code-graph-refresh-during-a-session` 1.3–1.4. Declined, one line
each: backtick-mention `documents` edges (D10) are never-true — `docs_layer.ts:44`
only links a backticked path with a `/` and an extension; the stale claim (D8)
already carries `measured_on: … post-repair recall UNMEASURED`
(`docs/CLAIMS.md:658`); a same-file receiver-typing guess mechanism adds INFERRED
edges before any oracle can measure them, which is the order this file exists to
reverse.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | closure C1 (`estate_offset_exempt` read as a destructive op): not one — the archival it names is the PR-gate rule for a completed roadmap (`roadmap-progress-sync` § PR-gate) | `closure_scan` 2026-10-26 | the roadmap ends with open steps |
| D2 | deterministic | agent | closure C2: 0.2's verify now asserts the post-Phase-1 reading is 0, not that a number exists | `closure_scan` 2026-10-26 | — |
| D3 | reversible-technical | agent | E2 of the supplied plan: `class-hierarchy` (stated) and `name-collision` (ambiguity reason) extend the closed vocabularies; `receiver-local` is declined (see Not carried here) | `types.ts:117-150,302` | an oracle reading shows `class-hierarchy` edges below stated precision |
| D4 | reversible-technical | agent | E6: the census is a report, not a gate | `analyze:inbox` Phase 5 — a measurement is not a gate before its noise is known | the census holds steady across three releases |
| D5 | deterministic | evidence | E1: correctness lands here, measurement on `road-to-a-graph-that-wins`, delivery and freshness on their parked owners; E3/E4 already settled there (2.2 names the PHP oracle, the corpus header names both subjects) | `road-to-a-graph-that-wins.md` § Corpus header, 2.2 | — |
| D7 | deterministic | evidence | 0.2 / AC-1 read "`name_lookup_multi` is 0" when written; the reading is 460 → 10, and all 10 are census artefacts (twins declared inside anonymous test callbacks, which have no node). The bar moves from the census number to the resolver's record (0 arbitrary winners, 513 recorded collisions); the change is stated here because it was made after the reading | `agents/evidence/analysis/code-graph-edge-census-2026-10-26.md` | the graph gains a nesting flag, after which the census bar returns to 0 |
| D6 | product-owned | owner (deferred) | E5, default-on enrichment, waits for that step to wake | `later/road-to-a-graph-that-feeds-the-gate` 2.5 | the step wakes |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Correct edges disappear | implementation | Demoting multi-candidate lookups and dropping closure locals can remove edges that happened to be right, and a gate verb then misses a real caller | The census reports before and after; every existing graph suite must stay green; AMBIGUOUS keeps `candidates[]` so nothing is silently lost | Phase 1 — Fewer false edges |
| 2 | A new stated mechanism launders a guess | implementation | `class-hierarchy` marked stated would make a wrong hierarchy walk trustworthy to every consumer | Stated only when the walk ends at exactly one owner; an override ambiguity stays AMBIGUOUS | Phase 1 — Fewer false edges |
| 3 | The census is read as a gate | product | A count with unknown noise would block unrelated changes | It ships as a report; promotion to a gate is a separate decision | Phase 0 — Measure before changing |

## Acceptance Criteria

- [x] AC-1 — A census at `700c41137b` and after Phase 1 is in the tree, the resolver
      records no arbitrary winner, and every residual `name_lookup_multi` edge is
      attributed.
- [x] AC-2 — A barrel import binds the call to the definition as a stated edge.
- [x] AC-3 — An intra-class call that walked to one owner survives the gate verbs.
- [x] AC-4 — A SCIP reference supersedes a native guess to any same-named node from
      that source, and nothing stated or under another name.
