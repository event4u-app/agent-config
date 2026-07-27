---
model_tier: inherit
name: code-intelligence
description: "Route codebase-structure questions (who calls X, where used, what imports, change-impact) to a code-graph first, grep fallback. Triggers 'who calls', 'where is this used', 'call graph'."
source: package
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
