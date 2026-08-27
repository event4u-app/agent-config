---
type: "auto"
tier: "2a"
description: "Repo ships a code-graph index (graph.json-shaped or SCIP) — query IT first for codebase-structure questions, do not grep from scratch"
triggers:
  - keyword: "scip"
  - keyword: "code-graph"
  - keyword: "code graph"
  - phrase: "graph.json"
  - phrase: "who calls"
  - phrase: "call graph"
  - phrase: "find references"
  - phrase: "where is this used"
applies_to_user_types:
  - "developer"
  - "maintainer"
self_contained: true
workspaces: [engineering]
packs: [meta]
# obligation: line 37
obligation_frequency: "per-turn"
---

# External Code-Graph Interop

Some repos commit a pre-built code-intelligence index — a `graph.json`-shaped
artifact or a SCIP index (`index.scip`, `*.scip`). When one exists, it already
answers "who calls X", "where is Y used", "what does this import" far more
precisely than a fresh `grep`. This suite is an **orchestrator first, owner
where it wins** (ADR-124): query a consumer-shipped index when it is present
and fresh; where none is shipped or ours is measurably better, the suite's own
native code-graph engine (default-off, benchmark-gated) covers the gap. Either
way — query first, grep as fallback, and name which source answered.

## The rule

```
REPO SHIPS A CODE-GRAPH INDEX (graph.json-shaped OR a SCIP index)
→ QUERY IT FIRST FOR CODEBASE-STRUCTURE QUESTIONS. GREP IS THE FALLBACK,
NOT THE FIRST MOVE. NEVER REBUILD A FRESH CONSUMER-SHIPPED INDEX.
NO FRESH INDEX SHIPPED → THE NATIVE ENGINE MAY BUILD ONE (ADR-124); STILL
GREP-FALLBACK FOR WHAT THE GRAPH DOES NOT ANSWER, AND SAY WHICH SOURCE ANSWERED.
```

## When it fires

A codebase-structure question (call graph, references, usages, import graph)
AND the repo contains a detectable index:

- a SCIP index — `index.scip` or any `*.scip` at the repo root or a conventional
  index directory;
- a `graph.json`-shaped artifact (a committed code-graph export).

## What to do

1. **Detect** the index (its path is the concrete pointer; the specific tool
   that produced it is named in the repo's own docs, not here).
2. **Query it** for the relationship the user asked about.
3. **Fall back to `grep`/read** only for what the index does not cover, and say
   so ("the index has no entry for X, so I grepped").

## When NOT to fire

- No such index in the repo — normal `grep`/read is the right first move.
- The question is about content/semantics, not code structure.

## See also

- [`code-intelligence`](../skills/code-intelligence/SKILL.md) — the executable
  routing skill: `agent-config code-graph detect|query|affected|path` over the
  native engine or a consumer-shipped index, grep as the stated fallback. On
  hook-capable hosts the PreToolUse `code-graph` nudge surfaces this once per
  session; on instruction-file hosts this rule is the surface. Which of the two
  you are on is `agent-config hooks:status`, not a guess from the host name.
- [`discovery_graph`](../scripts/discovery_graph.ts) — this suite's OWN artefact
  relation-graph (`affected`/`explain`); the external code-graph is the
  *source-code* analogue this rule defers to for code questions.
- [`think-before-action`](think-before-action.md) — analyze with the best
  available tool before grepping blind.
