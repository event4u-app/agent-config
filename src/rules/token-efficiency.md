---
type: "auto"
tier: "2a"
description: "CLI runs, log fetches, replies — redirect verbose output, minimize tool calls, stay concise"
alwaysApply: false
load_context:
  - contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - keyword: "minimize tool calls"
  - phrase: "fetching logs"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
---

# Token Efficiency

## The Iron Laws

```
NEVER load full command output into context. Redirect → read summary → targeted details.
```

```
NEVER CALL THE SAME TOOL >2 TIMES IN A ROW WITH SIMILAR PARAMETERS.
IF YOU CATCH YOURSELF REPEATING → STOP, RETHINK, ASK.
```

## Enumerated file sets are ONE operation, not N repetitions

The same-tool ceiling counts *repetition without new information* — the loop where the agent re-runs a tool because it did not learn from the last result. Reading N **declared, enumerated** files is the opposite: each read returns different content and the set was known before the first call. Counting it as N repetitions puts this rule in direct conflict with [`downstream-changes`](downstream-changes.md) ("find **ALL** callers, tests, imports") and with [`source-discovery-gate`](source-discovery-gate.md), which cannot be satisfied in two calls.

Exempt — the file set is enumerated **before** the first read and each read is a distinct member:

- an override / settings-resolution chain (project → user → global);
- a downstream-caller sweep after a rename or signature change;
- the members of a directory listing or grep result being opened in turn;
- a declared read protocol under [`context-hygiene`](context-hygiene.md).

Not exempt, and still the failure this rule exists to catch: re-reading the *same* file hoping for a different answer, re-running a failing command unchanged, or widening a grep by one word at a time instead of thinking. The discriminator is **did the previous call change what I know** — not the tool name.

## Fresh Output Over Memory

When a tool returns a value (branch name, file path, PR number), use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## API-dollar levers

Large stable context reused across turns (caching), non-interactive bulk
cohorts (batch), or a cost-aware model/effort decision → route via the
[`token-optimizer`](../skills/token-optimizer/SKILL.md) index branch
(`api-cost-levers` row) — single source of truth for the billing levers.

## Mechanics

Anti-loop patterns, act-skip-narration / stop-early / minimize-tool-calls clauses, and small-output / debugging exceptions: [`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). Precedence: never overrides `user-interaction` or command rules.
