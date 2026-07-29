---
type: "auto"
tier: "2a"
description: "CLI runs, log fetches, replies — redirect verbose output, minimize tool calls, stay concise"
alwaysApply: false
load_context:
  - ../contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - intent: "verbose CLI output"
  - intent: "fetching logs"
  - keyword: "minimize tool calls"
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

## Fresh Output Over Memory

When a tool returns a value (branch name, file path, PR number), use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## API-dollar levers

Large stable context reused across turns (caching), non-interactive bulk
cohorts (batch), or a cost-aware model/effort decision → route via the
[`token-optimizer`](../skills/token-optimizer/SKILL.md) index branch
(`api-cost-levers` row) — single source of truth for the billing levers.

## Mechanics

Anti-loop patterns, act-skip-narration / stop-early / minimize-tool-calls clauses, and small-output / debugging exceptions: [`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). Precedence: never overrides `user-interaction` or command rules.
