---
model_tier: medium
name: agent-handoff
pack: meta
intent: "Generate a session-handoff summary to continue work in a fresh chat"
routes_to: [agent-docs-writing]
replaces: []
tier: 0
visibility: visible
skills: [agent-docs-writing]
description: Generate a context summary for continuing work in a fresh chat. Replaces the session system.
argument-hint: "[with tasks]"
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

## User instructions (VERBATIM — highest priority)
- {every standing constraint / exclusion / correction the user gave, quoted
  word-for-word, NEVER summarized — a paraphrase silently drops requirements
  and causes post-handoff drift}

## Done
- {1-2 sentences summarizing what was accomplished}

## Open
- {bullet list of remaining tasks or next steps}

## Resume pointer
- {the exact next action: "continue with X"}

## Repeatable workflow (only when the work is iterative)
- Atomic unit: {the one thing repeated per iteration}
- Per-iteration steps: {1, 2, 3}
- Decision criteria: {when to stop / branch}

## Errors + fixes
- {what failed and the fix that worked — so the new chat does not re-hit it}

## Feedback history
- {corrections/preferences the user gave, so they are not re-violated}

## Key decisions
- {important decisions made during this conversation}

## Relevant files
- {list of files that were edited or are important for context}
```

**Verbatim-first is the load-bearing rule:** the *User instructions* and
*Feedback history* sections are preserved word-for-word and never compressed —
lossy re-summarization of the user's own constraints is the exact failure this
template prevents. Everything else (Done / Key decisions) stays concise.

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

- **Concise everywhere EXCEPT the verbatim sections.** Keep Done / Key
  decisions tight, but never truncate *User instructions* or *Feedback history*
  to hit a line target — losing a user constraint costs far more than the
  tokens. The concise-<30-line default applies to the narrative, not the
  verbatim record.
- **Keep errors + fixes, drop dead-end noise.** Record what failed AND the fix
  that worked (so the new chat does not re-hit it); skip reasoning chatter and
  abandoned attempts that led nowhere.
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
  phase / decision any session logged. Pull prior-session context into
  the current chat verbatim with `/chat-history import`; mine a prior
  session for project-improving learnings with
  `/memory mine-session --mode=proposals`.

Prefer `/agent-handoff` for planned context switches across tools or
machines; use `/chat-history import` after a crash or fresh-chat reopen
on the same workspace to surface prior-session context verbatim.

Three distinct mechanisms — do not conflate them:

- **handoff** (this command) — a one-shot push summary for the *next* chat;
  ephemeral, copy-paste, verbatim on the user's instructions.
- **[`chat-history import`](../chat-history/import/command.md)** — pull a prior *session's* logged context into the current chat.
- **durable memory** ([`memory-consolidation`](../../../skills/memory-consolidation/SKILL.md)) — cross-*run* curated facts; a handoff is not memory, and memory is not a transcript.
