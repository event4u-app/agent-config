---
type: "auto"
tier: "2a"
description: "Running CLI tools, fetching logs, or producing replies — redirect verbose output, minimize tool calls, keep replies concise"
alwaysApply: false
load_context:
  - contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - intent: "verbose CLI output"
  - intent: "fetching logs"
  - keyword: "minimize tool calls"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

## Mechanics

Anti-loop patterns, act-skip-narration / stop-early / minimize-tool-calls clauses, and small-output / debugging exceptions: [`token-efficiency-mechanics`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). Precedence: never overrides `user-interaction` or command rules.
