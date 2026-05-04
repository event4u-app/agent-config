---
type: "auto"
tier: "2a"
description: "After completing a meaningful task — trigger post-task learning capture if pipelines.skill_improvement is enabled"
alwaysApply: false
source: package
---

# Skill Improvement Trigger

## When to activate

Read `pipelines.skill_improvement` from `.agent-settings.yml`.

- **If `false` or missing** → do nothing. Stop here.
- **If `true`** → continue.

## What counts as "meaningful task"

Trigger after completing tasks that involve:
- Debugging a non-trivial bug (root cause wasn't obvious)
- Implementing a feature that required learning something new
- A pattern that worked well and should be remembered
- A mistake that cost >5 minutes to diagnose
- A workaround for a tool limitation

## What does NOT trigger

- Config changes, typos, docs-only edits
- Routine tasks with no surprises
- Tasks where the agent is just following instructions step by step
- Tasks shorter than 3 messages

## Trigger behavior

After completing a qualifying task, do a **quick mental check** (not a full workflow):

1. Was there a concrete, actionable learning?
2. Is it generalizable (not project-specific one-off)?
3. Is it NOT already covered by an existing rule or skill?

If all 3 are YES → propose to the user:

```
> 💡 Learning detected: "{one-sentence summary}"
>
> 1. Capture & improve — run the improvement pipeline
> 2. Skip — not worth capturing
```

If user picks 1 → invoke the `skill-improvement-pipeline` skill.
If user picks 2 → stop, do not ask again for this task.

## Important

- **Never auto-run the pipeline** — always ask first.
- **Max 1 trigger per task** — don't ask repeatedly.
- **Be honest** — if the learning is vague ("be more careful"), skip it silently.
- **Do not interrupt the user's flow** — only trigger AFTER the task is done.
