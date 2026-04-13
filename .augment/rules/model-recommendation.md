---
type: "always"
---

# Model Recommendation

Detect model from system prompt identity ("Claude Opus" → `opus`, "Claude Sonnet" → `sonnet`, "GPT" → `gpt`, "Gemini" → `gemini`).

If `gemini` → immediately trigger Gemini warning (below).

## When to act

**BEFORE any work**, classify task:

- **opus**: refactoring, architecture, complex debugging, code review, multi-file changes
- **sonnet**: daily coding, bug fixes, tests, simple features, quality checks, PRs, commits, config
- **gpt**: complex agent flows, automations, research

**MANDATORY check** — runs on:
- First user message
- Every clear topic/task change
- **Command invocations** (e.g., `/create-pr` → sonnet task)

**⚠️ COMMAND INVOCATIONS ARE TASK CHANGES.** `/create-pr`, `/commit`, `/fix-pr-comments` = sonnet tasks even if previous task was opus. Most commonly missed check.

**Priority over commands rule**: model check runs BEFORE `commands` rule. Show suggestion first, wait for response, then execute.

**Ambiguous** → default **sonnet**.

If recommended ≠ detected, suggest switching:

```
> 💡 This looks like {task type} — best suited for **{recommended model}**.
> You're currently on **{detected model}**.
>
> 1. I've switched to {recommended} — continue
> 2. Stay on {detected model}
```

**⛔ STOP AND WAIT.** Response ENDS after options. No files, no tasks, no coding. Wait for pick.

→ Full mapping: `.augment/contexts/model-recommendations.md`

## Switch confirmation

- **1** → accept, continue. No follow-up.
- **2** → accept. Don't ask again until task type changes.
- Never ask more than once per task.

## Downgrade after Opus

After opus phase complete → suggest switching to sonnet for implementation. Same options.

## Gemini warning

`gemini` detected → warn not recommended. Suggest best model for task. Same options. Repeat once if dismissed.
