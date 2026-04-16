---
type: "always"
alwaysApply: true
description: "3-failure rule for debugging and fixing errors — stop after 3 consecutive failed attempts, dump state, and recommend a fresh session"
source: package
---

# Context Hygiene

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality and waste tokens.

**Suggest a new chat when:**

- Conversation exceeds **~20 user messages**
- Topic **changes completely**
- Re-reading files already in context
- **15+ completed tasks** and new unrelated topic
- Branch changed since start
- ~24 hours passed

**Repeat** at multiples: messages 20/40/60, tasks 15/30/45.
**ONLY at exact thresholds.** Between: silence.

**How to suggest:**

Estimate token cost: responses × ~1,500 tokens.

```
> ⚡ This conversation has ~{N} messages (~{N×1500} tokens history cost — charged on EVERY request).
> A fresh chat saves ~{N×1500} input tokens per request.
>
> 1. Start fresh — I'll initiate a session handoff
> 2. Continue here
```

**If the user picks 1:** Initiate a session handoff or start fresh.

## The 3-Failure Rule

When **3 consecutive attempts** at the same task fail (code fix, test fix, config change, etc.):

1. **STOP** — do not attempt a 4th fix.
2. **State dump** — summarize what was tried, what failed, and what you know so far.
3. **Recommend fresh start** — suggest a fresh session with the state dump as context, or ask for a different approach.

**What counts as a failure:**

- Code change that doesn't fix the problem
- Test that still fails after the fix
- Quality check (PHPStan, ECS) that still errors
- Build/deploy that fails after config change

**Does NOT reset the counter:** Unrelated tasks. User providing new information (course correction).

## Tool Loop Detection

Calling the **same tool** more than **2 times in a row** with similar parameters = loop.

**Immediate action:**
1. **STOP** all tool calls.
2. **Do the task directly** — write the code, run the command, answer the question.
3. If you can't proceed — ask the user for help.

`sequentialthinking` is especially prone to loops. Use at most **once** per task,
NEVER for simple file operations, command execution, or straightforward edits.

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

Use `/agent-handoff` to generate a context summary for a fresh conversation.

## Augment-specific: Ignored Skills Recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
When you need expertise from an ignored skill:

1. **Read the SKILL.md directly** — `.augmentignore` only hides from system prompt, not from `view`.
2. **Continue working** — apply the skill's guidance.
3. **After the task**, ask the user:

```
> 💡 I loaded the `{name}` skill manually — it's currently ignored in `.augmentignore`.
>
> 1. Remove from ignore — this skill is relevant for the project
> 2. Keep ignored — this was a one-off
```
