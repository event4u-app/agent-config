---
type: "auto"
alwaysApply: false
description: "3-failure rule for debugging and fixing errors — stop after 3 consecutive failed attempts, dump state, and recommend a fresh session"
---

# Context Hygiene

## 3-Failure Rule

After **3 consecutive failed attempts** at same task:

1. **STOP** — no 4th attempt
2. **State dump** — what was tried, what failed, what's known
3. **Recommend fresh start** — suggest new session with state dump, or ask for different approach

After 3 failures, context is polluted. Fresh session with clean dump > 7th attempt in polluted context.

## What counts as failure

- Code change doesn't fix problem
- Test still fails after fix
- Quality check still errors after fix
- Build/deploy fails after config change

## Tool Loop Detection

Same tool called **2+ times** with similar parameters = loop. Critical failure mode.

1. **STOP** all tool calls
2. Do task directly
3. If stuck → ask user

`sequentialthinking`: max **once** per task. NEVER for simple file ops/commands/edits.

## Counter rules

- Unrelated tasks don't reset counter
- User providing new info = course correction, not failure

## State dump format

```
## State Dump: [Task Description]

### What was tried
1. [Approach 1] → [Why it failed]
2. [Approach 2] → [Why it failed]
3. [Approach 3] → [Why it failed]

### What is known
- [Fact 1]
- [Fact 2]

### Hypothesis
- [Best hypothesis for root cause]

### Recommendation
- [Suggested next approach for a fresh session]
```

Use `/agent-handoff` to generate context summary for fresh conversation.
