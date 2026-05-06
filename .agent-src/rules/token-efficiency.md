---
type: "auto"
tier: "2a"
description: "When running CLI tools, fetching logs, or producing replies — redirect verbose output, minimize tool calls, keep replies concise"
alwaysApply: false
source: package
load_context:
  - ../contexts/communication/rules-auto/token-efficiency-mechanics.md
triggers:
  - intent: "verbose CLI output"
  - intent: "fetching logs"
  - keyword: "minimize tool calls"
---

# Token Efficiency

## The Iron Laws

```
NEVER load full command output into context. Redirect → read summary → targeted details.
```

```
NEVER call the same tool more than 2 times in a row with similar parameters.
If you catch yourself repeating a tool call — STOP, rethink, try a different approach, or ask the user.
```

## Fresh Output Over Memory

When a tool or command returns a value (branch name, file path, PR number), use that EXACT value in subsequent API calls. NEVER substitute a value from earlier in the conversation. Context decay causes silent mismatches — fresh output is the only source of truth.

## Mechanics — anti-loop patterns, conversation efficiency, exceptions

The anti-loop patterns (extended-reasoning loops, "CRITICAL INSTRUCTION" self-prompting), the act-skip-narration / stop-early / keep-output-minimal / don't-re-read / minimize-tool-calls clauses, and the small-output / debugging / explicit-full-output exceptions all live in [`contexts/communication/rules-auto/token-efficiency-mechanics.md`](../contexts/communication/rules-auto/token-efficiency-mechanics.md). The rule above is the obligation surface; the mechanics file is the lookup material.

This rule NEVER overrides `user-interaction` or command rules. Token efficiency means fewer *unnecessary* words — NOT skipping required questions, numbered options, or command steps.
