---
name: chat-history-resume
description: Load the persistent chat-history log into the current conversation and adopt its header — recover context after a crashed or switched session
disable-model-invocation: true
---

# /chat-history-resume

Reconnects the current conversation with an existing `.agent-chat-history`
file. Reads the JSONL log, summarizes it into actionable context, and
rewrites the header's fingerprint so subsequent turns append to the same
file.

Use after a crashed chat, after switching tools (Augment → Claude Code),
or after the agent asked "Found existing chat history from a different
session — resume?" (the flow described in the
[`chat-history`](../rules/chat-history.md) rule).

## When NOT to use

- Just inspect metadata → [`/chat-history`](chat-history.md).
- Start fresh instead of resuming → [`/chat-history-clear`](chat-history-clear.md)
  or pick "Archive" in the rule's foreign-session prompt.
- Logging is disabled (`chat_history.enabled: false`) → enable it in
  `.agent-settings.yml` first; this command refuses to run otherwise.

## Preconditions

- `.agent-settings.yml` exists and `chat_history.enabled: true`.
- `.agent-chat-history` exists at the project root.

If either is missing, tell the user and stop — do not create files here.

## Steps

### 1. Load status

Run `scripts/chat_history.py status`. If `exists: false` or `entries: 0`,
tell the user there is nothing to resume and stop.

### 2. Compare fingerprints

Run `scripts/chat_history.py check --first-user-msg "<current first
user message>"`. The helper returns `match`, `mismatch`, or `missing`.

- `match` → nothing to adopt; the current session already owns the
  file. Jump to step 4 (summarize) for the user's benefit.
- `mismatch` → continue with step 3.
- `missing` → header is corrupt; tell the user and suggest
  `/chat-history-clear` to start fresh. Stop.

### 3. Adopt the header

Run `scripts/chat_history.py adopt --first-user-msg "<current first
user message>"`. The helper rewrites the fingerprint in place; body
entries are preserved verbatim.

### 4. Summarize into conversation context

Read the entries via the helper (for example
`scripts/chat_history.py read --all` or a bounded `--last N`). Produce
a short, structured summary — **not** a verbatim dump:

```
> 📒 Resumed chat-history ({entries} entries, {age})
>
> ## What was done
> - {1–3 bullets from agent/decision entries}
>
> ## Open threads
> - {1–3 bullets from the most recent entries and any pending questions}
>
> ## Key decisions
> - {decisions captured during the prior session}
>
> Ready to continue. What would you like to do?
```

Keep the summary under ~25 lines. Rationale: this is input into the new
turn, not a display artifact (see
[`token-efficiency`](../rules/token-efficiency.md)).

### 5. Hand control back to the user

After presenting the summary, stop and wait. Do not auto-resume work —
the user decides what to do next.

## Gotchas

- **Iron law — one question at a time.** Even if the log contains
  several open threads, ask about one at a time after the summary
  (see [`ask-when-uncertain`](../rules/ask-when-uncertain.md)).
- `adopt` rewrites the header in place. A backup is NOT created — use
  `/chat-history-clear` first if you want a clean slate.
- The summary is derived from the agent's reading of the JSONL. Old
  entries may be incomplete (especially if the previous session ran
  under `per_turn` and only wrote summaries). Flag gaps explicitly.

## See also

- [`chat-history`](../rules/chat-history.md) — foreign-session prompt that
  often routes here
- [`/chat-history`](chat-history.md) — status inspection without adopting
- [`/chat-history-clear`](chat-history-clear.md) — wipe instead of adopt
- [`/agent-handoff`](agent-handoff.md) — complementary: generates a
  paste-into-new-chat prompt (no disk file)
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — helper API
