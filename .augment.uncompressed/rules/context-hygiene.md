---
type: "auto"
alwaysApply: false
description: "3-failure rule for debugging and fixing errors — stop after 3 consecutive failed attempts, dump state, and recommend a fresh session"
---

# Context Hygiene

## The 3-Failure Rule

When **3 consecutive attempts** at the same task fail (code fix, test fix, config change, etc.):

1. **STOP** — do not attempt a 4th fix.
2. **State dump** — summarize what was tried, what failed, and what you know so far.
3. **Recommend fresh start** — tell the user:
   - That you've tried 3 times and are going in circles.
   - Suggest starting a fresh session with the state dump as context.
   - Or ask the user for a different approach.

## Why this matters

After 3 failures, the conversation context is polluted with wrong assumptions,
failed approaches, and stale state. Each additional attempt is more likely to
repeat the same mistakes or introduce new ones.

A fresh session with a clean state dump is faster than a 7th attempt in a polluted context.

## What counts as a failure

- A code change that doesn't fix the problem.
- A test that still fails after the fix.
- A quality check (PHPStan, ECS) that still errors after the fix.
- A build/deploy that fails after the config change.

## Tool Loop Detection

If you notice yourself calling the **same tool** (especially `sequentialthinking`) more than
**2 times in a row** with similar parameters — you are in a loop. This is a critical failure mode.

**Immediate action:**
1. **STOP** all tool calls.
2. **Do the task directly** — write the code, run the command, answer the question.
3. If you genuinely can't proceed — ask the user for help.

The `sequentialthinking` tool is especially prone to loops. It should be used at most **once**
per task, and NEVER for simple file operations, command execution, or straightforward edits.

## What does NOT reset the counter

- Unrelated tasks (fixing bug A doesn't reset the counter for bug B).
- The user providing new information (this is a course correction, not a failure).

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

Use `/agent-handoff` to generate a context summary the user can paste into a fresh conversation.
