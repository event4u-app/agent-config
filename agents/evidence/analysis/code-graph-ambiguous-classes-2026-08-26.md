<!-- evidence-type: analysis -->

# The AMBIGUOUS edge population, classified — 2026-08-26

> `road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh` Phase 1.1. The
> roadmap opened with the finding that 42.9 % of this graph's edges carry
> `AMBIGUOUS` **with no recorded cause**, so "resolve the largest class" was not
> a question the artifact could answer.
>
> Reproduce with `./agent-config code-graph build --root .` and read
> `agents/runtime/state/code-graph-v1.json`; the classification is now a field on
> the edge (`ambiguity_reason`) rather than something a bespoke script has to
> re-derive.

## The build

```
2953 files · 23101 nodes · 157231 edges
languages: javascript, php, typescript · grammar ABI 14
EXTRACTED 89452 · INFERRED 186 · AMBIGUOUS 67593
```

`67593 / 157231` = **43.0 %**, which confirms the roadmap's figure at a
different HEAD.

## The classification

Two axes, and both come from the extractor's own branch structure rather than
from a guess about the data.

| cause | in-repo candidate? | edges | share of AMBIGUOUS |
|---|---|---:|---:|
| `receiver-unknown` | none | **58,612** | 86.7 % |
| `receiver-unknown` | one or more | 8,960 | 13.3 % |
| `hierarchy-unresolved` | one or more | 12 | 0.02 % |
| `hierarchy-unresolved` | none | 9 | 0.01 % |

`receiver-unknown` is a dynamic (`$obj->m()`) or unresolved scoped (`C::m()`)
call. `hierarchy-unresolved` is a `this`/`self`/`static`/`parent` call inside a
class whose hierarchy does not contain the method — the base class is outside the
repository. **The hierarchy class is 21 edges and can be ignored.**

## What the largest class actually is — and it is not a defect

The 58,612 no-candidate edges name **1,301 distinct target names**, and **zero**
of them resolve to a node id in this graph. The top of the distribution settles
the question by itself:

| edges | target |
|---:|---|
| 5,843 | `join` |
| 3,205 | `push` |
| 2,328 | `slice` |
| 2,192 | `map` |
| 1,752 | `readFileSync` |
| 1,568 | `filter` |
| 1,531 | `trim` |
| 1,485 | `split` |
| 1,424 | `isArray` |
| 1,317 | `sort` |
| 1,240 | `toBe` |
| 1,199 | `writeFileSync` |

These are `Array.prototype`, `String.prototype`, `node:fs`, `JSON`, `node:path`
and vitest matchers. **No type inference over this repository could resolve
them, because the definitions are not in this repository.** An extractor that
reported them as EXTRACTED would be inventing edges.

So the honest reading of the headline number inverts: the 43 % is not 43 % of
the graph being broken. It is the extractor declining to claim a target it
cannot know, on calls into libraries — which is what the confidence taxonomy is
for.

**The finding that IS worth recording:** 37 % of all edges in this graph point at
a `symbol:<name>` that will never exist as a node. Whether such an edge should be
emitted at all is a design question about graph noise, not a resolution question,
and it is out of scope here — recorded so it is not mistaken for the same
problem.

## What Phase 1.2 fixed instead

The 8,960 with-candidate edges are where the false positives live, and the cause
is not the ambiguity — it is the **arbitrary winner**. The rule was
`candidates[0] ?? symbol:<name>`, so the first alphabetical same-named method
became the edge's `target`. The concentration is visible:

| edges | target the extractor chose |
|---:|---|
| 1,707 | `src/scripts/_lib/gate_ledger.ts#GateLedger::resolve` |
| 1,623 | `internal/bench/provenance/samples/seeded/seed-10-ts-rename-only.ts#RecentUseCache::write` |
| 1,129 | `src/cli/python/workspace_analytics.ts#_PyJsonParser::parse` |
| 1,103 | `internal/bench/provenance/samples/independent/ind-02-ts.ts#BoundedCache::has` |
| 573 | `internal/bench/provenance/samples/seeded/seed-02-ts-verbatim.ts#LruCache::get` |
| 414 | `internal/bench/provenance/samples/seeded/seed-02-ts-verbatim.ts#LruCache::set` |

Every generic `.resolve(...)` in the tree was pointed at one gate ledger method,
and every `.set(...)` at a cache class in a bench fixture. **The roadmap's named
worked example is in that last row**: `discoverTurboGenerators --calls-->
LruCache::set`, across three files.

`ambiguousTarget` now keeps a target only when there is exactly **one**
candidate — a real resolution — and points at the unresolved symbol when there
are several, with `candidates` carrying every option. Nothing is lost; the list
was already emitted, and the taxonomy's own acceptance rule already said the
edge is correct when the true target is *among* the candidates, which is a
statement that no single one of them is the answer.

Measured after the change: 4,818 edges had more than one candidate and now name
the symbol; 4,154 had exactly one and keep their resolved target.
`discoverTurboGenerators` no longer emits an edge to `LruCache::set`. `EXTRACTED`
went **89,452 → 89,454** — up, not down, which is the direction the step's verify
requires.
