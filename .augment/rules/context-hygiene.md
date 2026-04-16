---
type: "always"
alwaysApply: true
description: "3-failure rule for debugging and fixing errors — stop after 3 consecutive failed attempts, dump state, and recommend a fresh session"
source: package
---

# Context Hygiene

## Conversation Freshness

Monitor for **context decay** — long conversations degrade quality and waste tokens.

**Suggest new chat when:**

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

**If user picks 1:** Initiate session handoff or start fresh.

## 3-Failure Rule

After **3 consecutive failed attempts** at same task:

1. **STOP** — no 4th attempt
2. **State dump** — what was tried, what failed, what's known
3. **Recommend fresh start** — suggest new session with state dump, or different approach

**Counts as failure:** code change doesn't fix, test still fails, quality check errors, build fails.
**Does NOT reset:** unrelated tasks, user providing new info (course correction).

## Tool Loop Detection

Same tool called **2+ times** with similar params = loop.

1. **STOP** all tool calls
2. Do task directly
3. If stuck → ask user

`sequentialthinking`: max **once** per task. NEVER for simple file ops/commands/edits.

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

Use `/agent-handoff` for context summary for fresh conversation.

## Augment-specific: Ignored Skills Recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
When you need expertise from an ignored skill:

1. **Read SKILL.md directly** — `.augmentignore` only hides from system prompt, not `view`.
2. **Continue working** — apply skill's guidance.
3. **After task**, ask:

```
> 💡 I loaded the `{name}` skill manually — it's currently ignored in `.augmentignore`.
>
> 1. Remove from ignore — this skill is relevant for the project
> 2. Keep ignored — this was a one-off
```
