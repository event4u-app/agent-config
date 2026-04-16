---
type: "always"
description: "Model recommendation — detect task complexity, suggest optimal model (Opus/Sonnet/GPT), check on task changes and command invocations"
alwaysApply: true
source: package
---

# Model Recommendation

Detect the current model from your system prompt identity (e.g., "Claude Opus" → `opus`,
"Claude Sonnet" → `sonnet`, "GPT" → `gpt`, "Gemini" → `gemini`).

If the detected model is `gemini`, immediately trigger the Gemini warning (see below).

## When to act

**BEFORE starting any work**, classify the task the user is asking for:

- **opus**: refactoring, architecture, complex debugging, code review, multi-file changes
- **sonnet**: daily coding, bug fixes, tests, simple features, quality checks, PRs, commits, config
- **gpt**: complex agent flows, automations, research

**This check is MANDATORY** — not optional, not "nice to have". It runs:
- On the **first user message** of a conversation
- On **every clear topic/task change** (e.g., from refactoring to "create PR")
- **When a command is invoked** (e.g., `/create-pr` → sonnet task)

**⚠️ COMMAND INVOCATIONS ARE TASK CHANGES.** When the user invokes a command (e.g., `/create-pr`,
`/commit`, `/fix-ci`), ALWAYS re-evaluate the model before executing. Commands like `/create-pr`,
`/commit`, `/fix-pr-comments` are sonnet tasks — even if the previous task was opus-level.
This is the most commonly missed check. Do NOT skip it.

**Priority over commands rule**: This check runs BEFORE the `commands` rule. If a model switch
is recommended, show the suggestion first. Only after the user responds, execute the command.

**If ambiguous** (could be opus or sonnet): default to **sonnet** — cheaper, and the user can escalate.

If the recommended model ≠ detected model, suggest switching **before doing any work**:

```
> 💡 This looks like {task type} — best suited for **{recommended model}**.
> You're currently on **{detected model}**.
>
> 1. I've switched to {recommended} — continue
> 2. Stay on {detected model}
```

**⛔ STOP AND WAIT.** After showing this suggestion, your response ENDS.
Do NOT read files, create tasks, start coding, or do anything else in the same response.
The ONLY content after the numbered options is the end of your message.
Wait for the user to pick 1 or 2 before proceeding.

→ Full mapping and heuristics: `.augment/contexts/model-recommendations.md`

## Switch confirmation

- If user picks **1**: accept and continue. No follow-up question.
- If user picks **2**: accept. Don't ask again until the task type changes.
- **Never ask more than once per task** unless the task type changes significantly.

## Downgrade after Opus

After completing an opus-level phase (architecture done, root cause found, refactoring plan ready),
suggest switching back to sonnet for implementation. Same numbered options.

## Gemini warning

If detected model is `gemini`: warn that Gemini is **not recommended** for this project.
Suggest switching to the best model for the current task (opus/sonnet/gpt).
Show the same numbered options as above. Repeat once if dismissed — then accept.
