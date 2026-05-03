---
type: "auto"
alwaysApply: false
description: "When debugging, fixing errors, or running long conversations — 3-failure stop rule, tool-loop detection, fresh-chat triggers"
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
## State Dump: [Task]
### Tried: 1. [Approach] → [Why failed] 2. ... 3. ...
### Known: [Key facts]
### Hypothesis: [Best guess for root cause]
### Recommendation: [Next approach for fresh session]
```

Use `/agent-handoff` to generate a context summary for a fresh conversation.

## Augment-specific: Ignored Skills Recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
If you need an ignored skill: read its SKILL.md directly, apply guidance, then ask:

```
> 💡 I loaded `{name}` manually — currently ignored in `.augmentignore`.
> 1. Remove from ignore — relevant for this project
> 2. Keep ignored — one-off
```
