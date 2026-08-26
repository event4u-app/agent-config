---
complexity: lightweight
---

<!-- evidence-type: analysis -->

# The `agent-memory` reference population, classified — and three numbers that disagree

> `road-to-decision-conformance` steps 0.1-0.4, measured 2026-08-26 on
> `drain/decision-conformance`.

## The population, and why the count is instrument-sensitive

```bash
command grep -rl "agent-memory" --include='*.md' --include='*.ts' --include='*.json' \
  --include='*.yml' --include='*.yaml' --include='*.sh' . \
  | command grep -v node_modules | command grep -v '^\./dist/' | wc -l
```

**78 files.** Confirmed by two independent runs.

`node_modules/` holds **zero** hits, so that exclusion is a no-op.
`dist/agent-src/` is excluded because it is a byte-exact projection of `src/`;
including it adds 4 files that are mirrors of `src/` rows already counted.

**The occurrence count is not stable across instruments, and that is worth
recording rather than picking a number.** Three figures exist: the roadmap says
**298 across 76**; a `grep -o` run reports **309**; a second reports **377**.
The file count is stable at 78 both times. Whatever the per-occurrence
discrepancy is (`-o` semantics, an overlapping `.agent-memory` prefix, or a
shell `grep` shim), **the file count is the denominator every acceptance
criterion here uses**, and it is 78.

**Consequence for AC-1, stated because it is unavoidable:** the AC requires
*"76 rows"*. The honest number is **78**. An AC pinned to a stale count cannot
be met by correct work.

## Class A — the load-bearing question, and the answer is NOT zero

```
$ npm ls @event4u/agent-memory
@event4u/agent-config@14.12.0
└── (empty)

$ grep -n "agent-memory" package.json          → no match
$ grep -rn "from '@event4u/agent-memory'" src/ tests/   → no match
```

**Zero imports, zero dependency entries, zero invocations.** Step 0.2's verify is
met on all three of its conjuncts.

**But class A is 3, not 0**, under the class definition's own last clause —
*"a path that resolves into it"*:

| file | what |
|---|---|
| `src/scripts/_cli/explain_last/memory.ts:40` | `const MEMORY_SIDECAR = path.join('.agent-memory', 'hits.jsonl')`, read at runtime when present, documented at `:14` as *"optional sidecar produced by the memory-MCP integration"* |
| `tests/scripts/_cli/explain_last_build_trace.test.ts` | creates that sidecar and asserts the reader consumes it |
| `tests/fixtures/explain_last/README.md` | documents the sidecar slot |

That read path is **live, tested, and can never be satisfied** — nothing will
ever write the file. No import-shaped or dependency-shaped A row exists, and
none was manufactured to avoid reporting a small number.

## The four classes

| class | count | meaning |
|---|---:|---|
| **A** — live coupling | **3** | the sidecar read path above |
| **B** — inherited assumption | **11** | guards written because the package was assumed present or absent; **not actioned here**, per 0.3 |
| **C** — historical | **53** | archived roadmaps, ADR Context sections, changelogs, evidence files — true when written |
| **D** — stale | **11** | present-tense claims a live artefact makes that the tree contradicts |
| **sum** | **78** | equals the file count |

## Class D — the eleven live falsehoods

1. `docs/contracts/explain-modes.md:15` — *"The agent-memory MCP **already returns** an `explain-v1` envelope per `memory_explain`."* No package, no server, no tool.
2. `docs/contracts/local-knowledge-ingestion.md:74` — a **MUST** on `memory_retrieve`, *"existing surface in `agent-memory`"*. `keep-beta-until: 2026-08-23`, expired.
3. `docs/contracts/memory-visibility-v1.md:15,141` — *"the sibling agent-memory package"*, and a consumer that *"feeds the result back into the agent-memory store"*. `keep-beta-until: 2026-08-12`, expired.
4. `internal/schemas/retrieval-v1.schema.json:5` — *"shared by agent-config and agent-memory"*, citing a source path that does not exist. **The schema itself is live** — consumed by `tests/conformance/retrieval/fixtures.test.ts`.
5. `tests/fixtures/retrieval/README.md:3,25` — *"both repos"*, linking an absent roadmap.
6. `docs/decisions/ADR-026-explain-mode-translation.md:17,65,77` — **`status: accepted`, `superseded_by: —`**, depending on *"`explain-v1` … stabilized in `agent-memory` 3.0"*. The sharpest row: a live accepted ADR whose stated dependency is gone. Already flagged **REVIEW-NOW** at `adr-evidence-sweep-2026-08.md:367`.
7. `docs/migration/divergences/src-scripts-check_memory.md:70` — *"absent **until** `@event4u/agent-memory` … exist"*, framing a completed removal as a pending arrival.
8. `src/scripts/check_no_roadmap_refs.ts:69` — a dead illustrative example, `agent-memory/`.
9. `src/domains/product-basic/roadmap/create/command.md:180` — the same dead example, in a live command.
10. `internal/workers/mcp/content.json` — a generated bundle carrying #9 verbatim; fixed by regenerating, never by editing.
11. `agents/roadmaps/road-to-decision-conformance.md:74,87,273` — the roadmap's own *"298 across 76"*.

**Rows 8-10 are the weakest three** — dead examples, not present-tense
capability claims. Named as weak so they are not over-actioned.

**Row 4 is the only D row sitting under a green gate that does not check it.**

**Rows 2 and 3 already had a trigger nobody fired:** both are past their own
`keep-beta-until` date and both assert the package present. The staleness had an
independent existing expiry, and the expiry did not fire.

## Class B — the guards, and who owns reopening

Per 0.3, **no class-B row is actioned in this roadmap.** Each is recorded with
the guard it names and the record that would own its reopening.

The canonical origin of the whole set is
`docs/decisions/engine-reclassification-2026-07.md:59`, which records it as
*"canonical Layer-2 sunset origin, RE-AFFIRMED."*

**Two B rows have NO decision record behind them** — `_lib/bench_ab_scoring_v2.ts`
(a `.agent-memory` exclusion in a live scored-diff heuristic) and
`tests/contracts/rule_interactions_behavioural.test.ts` (a naming convention).
Those two are local heuristics wearing the shape of a governed constraint, which
is the distinction 0.3 exists to draw.

## 0.4 — the archived-refusal spot-check, found

`agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md:8-9`:

> **SKIPPED 2026-08-05 — decision against pursuit, per [`ADR-216`]…**

And `agents/roadmaps/skipped/road-to-code-graph-orchestration.md:6-8`:

> **SKIPPED — superseded same-day (2026-07-23) … per the embedded-engine
> doctrine (ADR-124, maintainer-directed)**

So 0.4's premise holds: an archived refusal does cite a decision record, and
that refusal keeps reading as a live veto when the cited ADR changes.

**One caveat that changes 0.4's scope:** **no file under `skipped/` mentions
`agent-memory` at all.** The six skipped roadmaps are disjoint from this
population, so extending the corpus to `skipped/` operates on a different file
set than 0.1 — the extension is right, and it will not surface more of *this*
population.
