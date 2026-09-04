---
model_tier: inherit
name: code-intelligence
description: "Route codebase-structure questions (who calls X, where is this used, what imports, change-impact) to an existing code-graph first: cheaper, never more precise; grep stays routine. Also 'call graph'."
domain: engineering
workspaces:
  - engineering
packs:
  - meta
requires_skills:
  - source-discovery
---

# code-intelligence

> For a **structure** question — *who calls X*, *where is Y used*, *what
> imports Z*, *what breaks if I change this symbol* — ask an index that already
> exists before rebuilding the relationship by hand: it is already built, its
> answer is structured, and it costs a fraction of the tokens. It is **not** more
> precise than a blind `grep` — measured on this repository's own source, zero
> classes met the win bar (§ Measured twice) — so grep is the arm you fall back
> to routinely and **with a stated reason**, not grudgingly. This skill routes
> such questions to the native code-graph engine (ADR-124, Class A) or a
> consumer-shipped index first. It is the executable side of
> [`external-code-graph-interop`](../../rules/external-code-graph-interop.md):
> *orchestrator first, owner where it wins*.

## When to use

- The question is about **relationships between code symbols**, not content:
  callers/callees, references, imports, inheritance, change-impact.
- You are about to `grep`/`Read` across many files to reconstruct a call or
  import graph by hand.

**When NOT to use:** content/semantic questions ("what does this function
*mean*", "find the string 'password'"), single-file edits, or a repo with no
code-graph and no appetite to build one — plain `grep`/read is right there.

## Procedure

1. **Detect the source.** `agent-config code-graph detect` — is a fresh consumer
   `graph.json` or native cache present? (A consumer-shipped fresh index wins;
   the native engine covers stale-or-absent — ADR-124 § 2.)
2. **Build if absent and worthwhile.** No graph + a repo in the launch set
   (PHP / TS / JS)? `agent-config code-graph build` (deterministic, LLM-free,
   ~seconds). Skip for a one-off question in an unsupported stack — grep
   instead.
3. **Query.** Pick the verb:
   - `agent-config code-graph query <symbol>` — direct relations of a symbol.
   - `agent-config code-graph affected <symbol>` — reverse: who calls /
     references it (the "impact of changing X" question). `--since <ref>`
     seeds from a git diff.
   - `agent-config code-graph path <a> <b>` — how two symbols connect.
   - `agent-config code-graph explain <symbol>` — 2-hop neighbourhood.
   Pass `--budget <tokens>` to cap output.
4. **Read the confidence.** `EXTRACTED` = syntactic fact — a symbol declared in
   the file, or a name bound to the module specifier the file names; `INFERRED`
   = resolved by hierarchy, or by a repo-wide same-name lookup with no binding
   in the file to justify it; `AMBIGUOUS` = dynamic dispatch / facade, carries
   candidates — treat its target as *one of* the candidates, never as certain.
   Two target shapes are **not nodes** and resolve to nothing you can read:
   `symbol:<name>` (a name this repository does not declare) and
   `external:<module>` / `external:<module>#<name>` (a name imported from
   outside the indexed root — `external:node:path`).
5. **Fall back honestly.** If the graph has no entry for the symbol, grep — and
   say so: *"the graph has no entry for X, so I grepped."* If this command is
   not available, grep and say so.

## Output

Every answer built with this skill MUST:

- **Name the source** that answered — `native`, `consumer`, or `grep-fallback`
  — so the reader knows the provenance and freshness of the relationship claim.
- **Preserve the confidence class** for each relationship surfaced — never
  present an `AMBIGUOUS` edge as a definite call; list its candidates or say
  "ambiguous (dynamic dispatch)".

## Gotcha

- **A stale graph lies confidently.** If `detect` reports the index is N commits
  behind, rebuild (`agent-config code-graph build --update`) before trusting
  relationship answers, or say the answer is from a stale index.
- **Dynamic dispatch is honestly ambiguous — where there is anything to be
  ambiguous ABOUT.** A `$obj->m()` whose name matches a method declared
  somewhere in the repo is `AMBIGUOUS` and carries those candidates: the engine
  being honest, not broken — do not "resolve" them yourself by guessing. A
  dynamic call whose name matches **no** in-repo method (`xs.push()`,
  `map.get()`) is not emitted at all, and the count is published as
  `suppressed_edge_counts.dynamic_no_candidate`. It used to be 39 % of this
  engine's own graph, pointing at `symbol:push`, which is not a node and which
  no query verb could reach.
- **The AMBIGUOUS share is a property of the code, not a constant.** Measured
  2026-09-04 over the three roots the v2 benchmark uses: `AMBIGUOUS` is 0 of 495
  edges under `src/scripts/code_graph`, 0 of 181 under `src/shared`, and 121 of
  4,002 (3.0 %) under `src/scripts/ai_council` — class-free TypeScript has
  almost no in-repo method to be ambiguous between. A Laravel codebase, where
  facades and injected services dispatch onto real in-repo methods, is the
  opposite case. Read the counts in the graph rather than a remembered ratio.

## Measured twice, and it has not won (v2, 2026-08-29)

Pre-registered, published whichever way it landed:
`internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md`. The native
engine scored against disciplined `git grep` over three in-repo TypeScript
roots, 19 questions, per-class bars fixed before the run and unchanged from v1.

| Class | grep R | graph R | Δ pp | grep P | graph P | verdict |
|---|---|---|---|---|---|---|
| `callers` | 1.000 | 1.000 | +0.0 | 0.611 | 0.667 | TIE |
| `transitive-impact` | 0.611 | 0.500 | −11.1 | 1.000 | 0.667 | NULL |
| `path-between` | 0.917 | **1.000** | +8.3 | 0.778 | **1.000** | TIE |
| `references` | 1.000 | 0.333 | −66.7 | 0.833 | 0.333 | NULL |

**Zero classes met the win bar.** On `path-between` the graph is exact and is the
only class where it out-precises grep; it still ties, because the delta is +8.3 pp
against a +10 pp bar that was fixed before the run.

**The v1 run of 2026-08-28 published a false root cause, corrected 2026-08-29.**
It reported `path-between` as `VOID` because *"both arms measured nothing"*. Only
the grep arm did. The graph answered all three questions and v1's scorer discarded
the answer — it compared each returned symbol against the whole probe string
`"cmdBuild -> getParser"`. v1 also never invoked the shipped `path <a> <b>` verb,
and counted unresolved `symbol:` pseudo-nodes as files, which is the sole reason
its `callers` verdict was NULL with recall tied. v1's numbers are not retro-edited
— they were faithful to v1's own registration — and v1's report now carries the
correction. Do not quote a `path-between` delta near +89 pp: that figure comes
from repairing the graph arm and leaving grep on the broken probe.

**The rule's own wording was corrected by this result.** `external-code-graph-interop`
used to open by saying a committed index answers "far more precisely than a fresh
`grep`". That was never measured, and when it was, it was false for the native
engine on this repository's own code. The rule now gives the reasons that survive
measurement — an index that exists is already built and structured, so it is the
cheap first question — and drops the precision claim its own benchmark refuted.

## Re-run after the extractor repair (2026-09-04) — still no class won

`internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md`. The
SAME registration, the same corpus SHA, the same per-class bars and the same
arm-B verbs, re-run after the import-binding repair. The 2026-08-29 report is
untouched; this is a second report beside it, which is how v1 was handled too.

| Class | graph R then | graph R now | graph P then | graph P now | verdict then → now |
|---|---|---|---|---|---|
| `callers` | 1.000 | 1.000 | 0.667 | 0.667 | TIE → TIE |
| `transitive-impact` | 0.500 | **0.611** | 0.667 | **1.000** | **NULL → TIE** |
| `path-between` | 1.000 | 1.000 | 1.000 | 1.000 | TIE → TIE |
| `references` | 0.333 | **1.000** | 0.333 | **1.000** | **NULL → TIE** |

**Zero classes met the win bar, again.** Two NULLs became TIEs and nothing
regressed, so the routing verdict below is unchanged — a TIE is not a win, and
no bar was renegotiated after the repair.

Read with two caveats the report states in full. A measured root is live source:
`src/shared` is byte-identical between the runs, `src/scripts/ai_council` moved
by 27 files on `main` in between, and `src/scripts/code_graph` IS the engine, so
its content necessarily moves whenever the engine does — which is also why the
GREP arm's macro precision moved (0.806 → 0.764) in a run that changed nothing
about grep. Both classes that changed verdict did so on rows whose root did not
drift: `references` moved on `code_graph` and `shared`, `transitive-impact` on
`shared` alone.

**No class is graph-first.** Query the index first because an index that already
exists is cheap to ask and its answer is structured — not because it answers
better. When it returns nothing, that is the common case, and grep remains the
arm to fall back to rather than a grudging afterthought.

The sentence that stood here — *"the arm that won every valid class on this
corpus"* — is withdrawn. It is the framing v1's own report forbids: that report
says the defensible statement is *"zero classes met the pre-registered win
criterion"*, **not** that grep proved superior. It was also false on its own
terms under v2: grep wins two classes, ties two, and is out-precised on both
ties.

Scope, stated so this table is not over-read: it measured the **native** engine
on **this repository's TypeScript**, with a corpus of 19 questions. It is not
comparable to the 2026-07-28 external-corpus run, it is not comparable to v1
either (corpus, arm-B verb set and scorer all moved), and it says nothing about a
consumer-shipped SCIP index. Literal-string probes are reported as a separate
`capability-boundary` class with no floor derived from them: a symbol index
cannot answer them at all, which is where grep stays necessary rather than a
defect in the engine.

## Do NOT

- Do NOT rebuild a **fresh** consumer-shipped index — query it (interop
  courtesy).
- Do NOT block or defer a read waiting on the graph — it is an accelerator, not
  a gate.
- Do NOT treat the cache as a source of truth for anything beyond the last
  build; it is a rebuildable artifact.

## See also

- [`external-code-graph-interop`](../../rules/external-code-graph-interop.md) —
  the rule that routes structure questions here.
- [`source-discovery`](../source-discovery/SKILL.md) — evidence-before-structure
  discipline; the graph is one evidence source, still confirmed against the real
  code when load-bearing.
- `agent-config code-graph` — the CLI surface over the engine (build / query / detect / affected).
