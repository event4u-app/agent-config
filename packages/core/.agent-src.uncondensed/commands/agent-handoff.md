---
name: agent-handoff
tier: 0
skills: [agent-docs-writing]
description: Generate a context summary for continuing work in a fresh chat. Replaces the session system.
suggestion:
  eligible: true
  trigger_description: "user asks for an agent handoff, fresh-chat summary, or context-summary to paste into a new chat"
  trigger_context: "explicit verbatim ask — 'agent handoff', 'agend handoff' (typo), 'fasse für neuen chat zusammen', 'handoff summary', 'context summary for fresh chat'. Never inferred without a direct handoff / summary intent."
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

## Iron Law — output is ALWAYS a fenced code block

```
THE HANDOFF MUST BE WRAPPED IN A FENCED ```markdown CODE BLOCK
SO THE USER CAN COPY IT IN ONE CLICK. NEVER RENDER IT AS LIVE
MARKDOWN. NEVER SPLIT IT ACROSS MULTIPLE BLOCKS.
```

Use ` ```markdown ` as the fence so consumers get syntax highlighting
and the inner content is preserved verbatim. Add one short prose line
above the block (e.g. *"Copy this into a new chat:"*) and nothing
after — no follow-up questions, no numbered options.

## Detection — when natural-language triggers count as explicit

The user does not need to type `/agent-handoff` literally. Treat as
explicit invocation when the prompt contains a verbatim mention of:

- `agent handoff` / `agend handoff` (typo) / `handoff`
- `fresh chat`, `neuer chat`, `for a new chat`
- `context summary for {fresh,new} chat`
- `fasse … für … chat zusammen`

A vague *"summarize this conversation"* without handoff/new-chat
framing → NOT a trigger. Surface `/agent-handoff` as a numbered option,
do not auto-execute.

## Rules

- **Keep it concise** — the prompt should be <30 lines. More context = more input tokens in the new chat.
- **Only include actionable info** — skip history, reasoning, and failed attempts.
- **Branch name is critical** — always include it.
- **Open tasks are critical** — the new chat needs to know what's left.
- **Decisions are important** — prevents the new chat from re-asking settled questions.
- **File list is optional** — only include if the new chat will need to edit specific files.
- **NEVER render the handoff as live markdown** — see Iron Law above.

## When to use this vs. `agents/runtime/.agent-chat-history`

- `/agent-handoff` is **push-based**: you copy a short summary into the
  new chat. Works across tools (Augment → Claude Code), across machines,
  and without any persistent file.
- `agents/runtime/.agent-chat-history` is **pull-based** and **multi-session**: every
  session writes its own entries tagged with a 16-char session
  fingerprint derived from the platform `session_id` (schema v4, see
  [`chat-history-platform-hooks`](../../agents/settings/contexts/chat-history-platform-hooks.md)).
  Works only on the same machine and same repo, but captures every
  phase / decision any session logged. Inspect with `/chat-history show`;
  pull prior-session context into the current chat verbatim with
  `/chat-history import`; mine a prior session for project-improving
  learnings with `/chat-history learn`.

Prefer `/agent-handoff` for planned context switches across tools or
machines; use `/chat-history import` after a crash or fresh-chat reopen
on the same workspace to surface prior-session context verbatim.
