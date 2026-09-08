---
adr: 259
status: accepted
date: 2026-09-07
decision: code-graph-parsers-ship-with-the-package
supersedes: ADR-246
superseded_by: —
phase: road-to-a-graph-that-is-shipped · Phase 0.1
type: structural
reopen_policy: owner
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - package.json
    - docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md
    - src/agent-src/templates/agent-settings.md
    - src/scripts/mcp_server/consumer_tool_catalog.json
    - src/scripts/code_graph/query.ts
    - src/scripts/code_graph/sqlite_store.ts
    - internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md
review_trigger: >-
  Reopen only on an owner ruling. Explicitly NOT a trigger: a benchmark result in either
  direction. ADR-246 made delivery conditional on a measurement; this record separates the
  two — governance decides how safely the graph is delivered, never whether. The
  measurement question lives in later/road-to-a-graph-that-wins.md and its own
  registration.
---

# ADR-259 — The code-graph parsers ship with the package

## Status

Accepted, owner-directed, 2026-09-07. Supersedes ADR-246
(`code-graph-parsers-stay-devdependencies`, 2026-08-26) in full.

## Context

ADR-246 kept `web-tree-sitter` and `tree-sitter-wasms` as devDependencies on two grounds:
a consumer cost of ≈51 MB, and the absence of a measured case in which the graph beats
grep. Both grounds were re-examined on 2026-09-06/07 and re-measured at
`0918def55` (v14.20.0) before this record was written.

**On the size ground.** The 51 MB figure is the whole grammar pack: `node_modules/tree-sitter-wasms/out/`
holds 36 `.wasm` files, 51,765,657 bytes apparent / 49 MiB on disk. The thirteen grammars
the target stack needs — php, typescript, tsx, javascript, vue, json, html, css, yaml, go,
java, python, bash — measure **8,896 KB (8.69 MiB, 9,085,798 bytes apparent)** together;
the `web-tree-sitter` runtime is 380 KB. ADR-246 itself records at its own evidence line
that the 51 MB was the figure carried over from `docs/MIGRATION.md` and was "not
re-measured here", so the decision rests on a pack-wide number that no default set ever
required.

**On the measurement ground.** ADR-246's first reopen trigger asks for "a CONSUMER case the
graph answers and disciplined grep cannot — stated by a consumer, not inferred from the
engine's capability". No consumer has ever received the engine, so that case cannot arise:

- the only always-on surface is a PreToolUse nudge that ships **default-off**
  (`hooks.code_graph.enabled: false`) and is described in the settings table as
  "deprecated — honest null 2026-07-28", requiring a manual install of the ABI-locked
  parser pair (`src/agent-src/templates/agent-settings.md:632`);
- the MCP server carries **31 tools and none of them is a graph tool**
  (`src/scripts/mcp_server/consumer_tool_catalog.json`);
- in-tree importers of the engine outside its own directory number **three**, two of which
  are the benchmark harness and that same nudge (`src/scripts/_lib/bench_ab_complexity.ts:64-65`,
  `src/scripts/hooks/code_graph_nudge_hook.ts:25`, `src/scripts/hooks/concern_registry.ts:61`).

A reopen trigger that requires the thing it prevents is not a trigger. ADR-246's *second*
trigger — a retrieval measurement beating grep — was independently evaluated on 2026-08-28
and again on 2026-09-04 and **did not fire**: zero of four classes met the +10 pp bar, every
class tied, `path-between` grep recall 0.917 against graph 1.000 for a delta of +8.3 pp
(`internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83`). This
record does not dispute that result and does not rest on it. It separates the two
questions instead.

The owner's standing direction (2026-08-27, 2026-09-04, restated 2026-09-07) is that
runtime and code intelligence are infrastructure whose *safety* governance ensures, not
whose *existence* it withholds.

## Decision

1. `web-tree-sitter` and `tree-sitter-wasms` move to `dependencies`. The published package
   carries the thirteen-grammar default set (8.69 MiB, listed in `package.json` `files`).
2. The remaining grammars ship as a companion package `@event4u/agent-config-grammars`,
   resolved by the package manager under the lockfile. **No grammar is ever fetched at
   runtime.**
3. `check_dependency_floors` gains the two entries; `docs/MIGRATION.md` states the install
   delta in bytes, re-measured rather than carried over.
4. Delivery and measurement are decoupled: no default, wording or routing claim changes
   under this record. In particular `src/skills/code-intelligence/SKILL.md:164` ("No class
   is graph-first") is not touched. Those change only through the registration and result
   recorded by `later/road-to-a-graph-that-wins.md`.

## Consequences

- ADR-246's consumer-case trigger becomes reachable for the first time. Its
  extraction-quality exclusion is unaffected and still stands.
- The estate's runtime-absence and zero-network claims are unaffected: parsing is local,
  and the companion package is a package-manager resolution, not a network call.
- Governance-only work on the graph — further benchmarks against this repository's own
  source — is not scheduled before Phase 4 of the parent roadmap has landed.
- The 8.69 MiB is a real consumer cost paid before any measured retrieval win. That is the
  trade this record makes deliberately, and the parent roadmap's Risk Register ranks it
  first.

## Amendment — 2026-09-07 · vendored-wired-set

**What changed:** Decision points 1 and 2 named a delivery mechanism that does
not do what this record's own Context argues for. The amendment replaces the
mechanism and keeps the decision. Delivery still happens; it happens by
vendoring three grammars rather than by depending on thirty-six and shipping a
companion package for the rest.

**Authority.** Owner standing direction for the `road-to-a-graph-that-is-shipped`
execution run (2026-09-07): amending a recorded ADR is authorized where it
blocks the graph, and the amendment is recorded in the same change rather than
the step descoped. `reopen_policy: owner` is satisfied by that direction, not
bypassed. The decision — parsers reach consumers — is untouched; only the
mechanism moves, and it moves to a strictly smaller one.

**Why the original mechanism could not be built as written.** Points 1 and 2 are
mutually inconsistent, and each half fails on its own measurement:

1. *"move to `dependencies`"* and *"the published package carries the
   thirteen-grammar default set, listed in `package.json` `files`"* are two
   different mechanisms. A dependency's files live in the consumer's
   `node_modules` and are never in this package's `files[]`. Only vendoring puts
   named grammars in `files[]`.
2. Depending on `tree-sitter-wasms` delivers **all 36** grammars (51,765,657 B
   apparent, 49 MiB on disk) — the outcome this record's own Alternatives
   section rejects by name. It would also leave the companion package with
   nothing to carry.
3. Vendoring the 13-grammar set measures **1,016,804 B compressed**, which puts
   the unbuilt tarball at ≈10.84 MB against `budgets.packed_size_mb.max = 9.1`
   in `src/config/pack-size-budget.json` — a maintainer-owned ratchet this run
   is not authorized to raise.
4. Ten of those thirteen grammars cannot be loaded at all. `GRAMMAR_WASM` in
   `src/scripts/code_graph/types.ts` has exactly three entries — php,
   typescript, javascript. Shipping the other ten is payload with no reader,
   which is precisely the shape the parent roadmap's Risk Register ranks first.

**Amended decision.**

1. `web-tree-sitter@0.24.7` moves to `dependencies`. (Unchanged.)
2. The **three loadable grammars** — php, typescript (which also serves `.tsx`),
   javascript — are vendored at `src/vendor/grammars/` and listed in
   `package.json` `files`. Measured cost: 3,802,618 B on disk, **+373,922 B
   compressed** on the tarball (9,821,600 → 10,195,522 B).
3. `tree-sitter-wasms` **stays a devDependency**. It is the source the vendored
   copies are refreshed from and the ABI smoke test's fixture — not a runtime
   dependency. The loader prefers the vendored set and falls back to this pack,
   so this repository's dev flow and any consumer holding the full pack are
   unchanged.
4. The companion package `@event4u/agent-config-grammars` is **not built**. It
   existed to carry the 23 grammars the 13-set left behind; with the wired set
   at three and the remaining 33 unloadable, it would ship grammars no code path
   can reach. Wiring a fourth language is `later/road-to-a-graph-that-wins.md`'s
   work, gated on a fixture per language (Kill register K6), and whichever
   mechanism delivers that grammar is a decision for that roadmap.

**What is NOT amended.** The Context, the Consequences, the Alternatives, and
the decoupling of delivery from measurement all stand. `enabled: false` remains
the default, `src/skills/code-intelligence/SKILL.md:164` is untouched, and no
routing or wording claim changes. Kill register K1 (no runtime grammar fetch) is
satisfied more strictly than before: the grammars are in the tarball, so there
is no registry resolution step for them at all.

**Consequence this amendment adds.** The consumer cost falls from the 8.69 MiB
this record accepted to 3.63 MiB on disk / 0.357 MiB compressed. The trade the
record made deliberately is therefore smaller than the one it recorded, in the
same direction.

## Alternatives

- Keep devDependencies and document a manual install — rejected: it is the state that
  produced zero consumer importers in six weeks, and it is the state that makes ADR-246's
  own reopen trigger unreachable.
- Fetch grammars on first use — rejected: a network fetch at first use is a supply-chain
  surface the spawn-hardening floor exists to avoid.
- Ship all 36 grammars — rejected on the measured 49 MiB; the companion package carries
  them for the consumers who need them.
- Wait for a benchmark win — rejected as circular, per the Context.

## Evidence

| Claim | Basis |
|---|---|
| Parsers are devDependencies | `package.json:115` (`tree-sitter-wasms: "0.1.13"`), `:120` (`web-tree-sitter: "0.24.7"`) |
| 13 grammars = 8.69 MiB; whole pack = 49 MiB / 36 files | `du -ck` over the named files under `node_modules/tree-sitter-wasms/out/` at `tree-sitter-wasms@0.1.13` |
| ADR-246's 51 MB is the pack figure, not re-measured | `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md` evidence line |
| No consumer surface | `src/agent-src/templates/agent-settings.md:632` (default-off, deprecated); `consumer_tool_catalog.json` (31 tools, zero graph tools); 3 external importers by grep |
| Benchmark trigger evaluated, not fired | `internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83` |
