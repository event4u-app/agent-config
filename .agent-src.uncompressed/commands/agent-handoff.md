---
name: agent-handoff
skills: [agent-docs-writing]
description: Generate a context summary for continuing work in a fresh chat. Replaces the session system.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Explicit fresh-chat handoff — must be deliberate, never inferred from prose."
---

# /agent-handoff

Generates a concise handoff prompt the user can paste into a new chat.
This replaces the old session system — no files to save/load, just a copy-paste prompt.

## Steps

### 1. Gather context

Collect the following from the current conversation:

- **Branch**: `git branch --show-current`
- **Uncommitted changes**: `git status --short`
- **Recent commits**: `git log --oneline -5`
- **Active roadmap**: Check `agents/roadmaps/` for any active roadmap
- **Task list**: Only include if the user explicitly asks for it (e.g., "/agent-handoff with tasks")

### 2. Generate handoff prompt

Create a fenced code block the user can copy-paste into a new chat:

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

Show the handoff prompt in a fenced code block and say:

```
> Copy this into a new chat to continue where we left off.
```

## Rules

- **Keep it concise** — the prompt should be <30 lines. More context = more input tokens in the new chat.
- **Only include actionable info** — skip history, reasoning, and failed attempts.
- **Branch name is critical** — always include it.
- **Open tasks are critical** — the new chat needs to know what's left.
- **Decisions are important** — prevents the new chat from re-asking settled questions.
- **File list is optional** — only include if the new chat will need to edit specific files.

## When to use this vs. `.agent-chat-history`

- `/agent-handoff` is **push-based**: you copy a short summary into the
  new chat. Works across tools (Augment → Claude Code), across machines,
  and without any persistent file.
- `.agent-chat-history` is **pull-based** and **multi-session**: every
  session writes its own entries tagged with a 16-char session
  fingerprint derived from the platform `session_id` (schema v4, see
  [`chat-history-platform-hooks`](../../agents/contexts/chat-history-platform-hooks.md)).
  Works only on the same machine and same repo, but captures every
  phase / decision any session logged. Inspect with `/chat-history show`;
  read prior-session context with `/chat-history learn`.

Prefer `/agent-handoff` for planned context switches across tools or
machines; use `/chat-history learn` after a crash or fresh-chat reopen
on the same workspace to surface prior-session context.
