---
model_tier: inherit
name: code-intelligence
description: "Route codebase-structure questions (who calls X, where used, what imports, change-impact) to a code-graph first, grep fallback. Triggers 'who calls', 'where is this used', 'call graph'."
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
> imports Z*, *what breaks if I change this symbol* — a code-graph answers far
> more precisely than a blind `grep`, at a fraction of the tokens. This skill
> routes such questions to the native code-graph engine (ADR-124, Class A) or a
> consumer-shipped index first, and falls back to grep **with a stated reason**
> when the graph cannot answer. It is the executable side of
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
4. **Read the confidence.** `EXTRACTED` = syntactic fact; `INFERRED` =
   hierarchy-resolved; `AMBIGUOUS` = dynamic dispatch / facade, carries
   candidates — treat its target as *one of* the candidates, never as certain.
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
- **Dynamic dispatch is honestly ambiguous.** On a Laravel/JS codebase most
  method-call edges are `AMBIGUOUS` (facades, injected services, `$obj->m()`).
  That is the engine being honest, not broken — do not "resolve" them yourself
  by guessing.

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
