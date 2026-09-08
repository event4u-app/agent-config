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
artifact or a SCIP index (`index.scip`, `*.scip`). One that exists is already
built, so it is the cheap first question for "who calls X", "where is Y used",
"what does this import". This suite is an **orchestrator first, owner where it
wins** (ADR-124): query a shipped index when present and fresh; otherwise the
native engine covers the gap (shipped since ADR-259 — no manual install).

## The rule

```
REPO SHIPS A CODE-GRAPH INDEX (graph.json-shaped OR a SCIP index)
→ QUERY IT FIRST FOR CODEBASE-STRUCTURE QUESTIONS. GREP IS THE FALLBACK,
NOT THE FIRST MOVE. NEVER REBUILD A FRESH CONSUMER-SHIPPED INDEX.
NO FRESH INDEX SHIPPED → THE NATIVE ENGINE MAY BUILD ONE (ADR-124); STILL
GREP-FALLBACK FOR WHAT THE GRAPH DOES NOT ANSWER, AND SAY WHICH SOURCE ANSWERED.
```

## Staleness is part of the answer

```
AN ANSWER FROM AN INDEX N COMMITS BEHIND IS WORTH LESS THAN THE SAME ANSWER
FROM A FRESH ONE. NEVER REPORT A GRAPH ANSWER WITHOUT KNOWING WHICH IT WAS.
```

`behind:N` → refresh first, or grep and say so. Silence is not freshness.
Delivery per host: [`code-intelligence`](../skills/code-intelligence/SKILL.md)
§ Staleness delivery.

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

Query-first is an **ordering** heuristic, never a claim the index answers better
— no measured class beat `grep`. Figures:
[`code-intelligence`](../skills/code-intelligence/SKILL.md) § Measured.

## When NOT to fire

- No such index in the repo — normal `grep`/read is the right first move.
- The question is about content/semantics, not code structure.

## See also

- [`code-intelligence`](../skills/code-intelligence/SKILL.md) — the executable
  routing skill, the measured figures, staleness delivery per host, and the
  pointer to this suite's OWN artefact relation-graph (`discovery_graph`).
- [`think-before-action`](think-before-action.md) — analyze with the best
  available tool before grepping blind.
