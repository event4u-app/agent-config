---
name: agent-handoff
description: "Agent Handoff"
disable-model-invocation: true
---

# /agent-handoff

Generate concise handoff prompt for copy-paste into new chat.

## Steps

### 1. Gather context

- **Branch**: `git branch --show-current`
- **Uncommitted changes**: `git status --short`
- **Recent commits**: `git log --oneline -5`
- **Active roadmap**: Check `agents/roadmaps/`
- **Task list**: Only if user explicitly asks

### 2. Generate handoff prompt

```
---
Branch: {branch}
Last commit: {hash} {message}
Roadmap: {roadmap file if active, or "none"}
---

## Done
- {1-2 sentences summarizing what was accomplished}

## Open
- {bullet list of remaining tasks or next steps}

## Key decisions
- {important decisions made during this conversation}

## Relevant files
- {list of files that were edited or are important for context}
```

### 3. Present to user

Show in fenced code block: `> Copy this into a new chat to continue where we left off.`

## Rules

- <30 lines — more context = more tokens in new chat
- Only actionable info — skip history, reasoning, failed attempts
- Branch name + open tasks = critical
- Decisions prevent re-asking settled questions
- File list optional — only if needed for next edits
