---
name: chat-history-resume
description: Load the persistent chat-history log into the current conversation — picks match/returning/foreign flow and supports resume, merge, replace, or continue
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Explicit resume mechanic with foreign/returning state machine."
---

<!-- cloud_safe: noop -->

# /chat-history-resume

Reconnects the current conversation with an existing `.agent-chat-history`
file. Depending on the 4-state ownership check, it routes to the right
flow: silent summarize, adopt, merge, or replace.

Use after a crashed chat, after switching tools (Augment → Claude Code),
or when the agent showed the foreign- or returning-session prompt from
the [`chat-history`](../rules/chat-history-ownership.md) rule and the user picked
"resume".

## When NOT to use

- Just inspect metadata → [`/chat-history`](chat-history.md).
- Start fresh instead of resuming → [`/chat-history-clear`](chat-history-clear.md)
  or pick "New start" in the foreign prompt.
- Logging is disabled (`chat_history.enabled: false`) → enable it in
  `.agent-settings.yml` first; this command refuses to run otherwise.

## Preconditions

- `.agent-settings.yml` exists and `chat_history.enabled: true`.
- `.agent-chat-history` exists at the project root.

If either is missing, tell the user and stop — do not create files here.

## Steps

### 1. Load status

Run `scripts/chat_history.py status`. If `exists: false` or
`entries: 0`, tell the user there is nothing to resume and stop.

### 2. Determine ownership state

Run `scripts/chat_history.py state --first-user-msg "<current first user
message>"`. Branch on the result:

- `match` → step 3a (already owner)
- `returning` → step 3b (pick Merge / Replace / Continue)
- `foreign` → step 3c (pick Resume / New start / Ignore)
- `missing` → header corrupt; tell the user and suggest
  `/chat-history-clear` to start fresh. Stop.

### 3a. `match` — already owner

Nothing to adopt. Skip to step 4 (summarize) for the user's benefit.

### 3b. `returning` — this chat once owned the file

Another session took over. Present the Returning-Prompt from the rule
and wait for a number:

```
> 📒 Welcome back. This chat once owned the history file; another
> session has written to it since.
>
> On-file entries: {N}   Size: {X} KB
>
> 1. Merge — my in-memory history first, the foreign entries after
> 2. Replace — wipe the foreign entries, keep only my history
> 3. Continue — leave the file as-is; only new entries from now on
```

- **1 (Merge)** — build the in-memory entries list (see below), then:
  ```bash
  scripts/chat_history.py prepend --entries-json '<list>'
  scripts/chat_history.py adopt --first-user-msg "<msg>"
  ```
- **2 (Replace)** — build the in-memory entries list, then:
  ```bash
  scripts/chat_history.py reset --first-user-msg "<msg>" \
    --freq <frequency> --entries-json '<list>'
  ```
- **3 (Continue)** —
  ```bash
  scripts/chat_history.py adopt --first-user-msg "<msg>"
  ```

### 3c. `foreign` — new chat finds an unknown session's file

Present the Foreign-Prompt from the rule and wait for a number:

```
> 📒 Found chat history from an unknown session.
>
> Entries on file: {N}   Size: {X} KB
>
> 1. Resume — adopt this file, load entries as context, keep appending
> 2. New start — archive to .agent-chat-history.bak, init fresh
> 3. Ignore — leave the file untouched, disable logging for this session
```

- **1 (Resume)** — `adopt --first-user-msg "<msg>"`.
- **2 (New start)** — rename file to `.agent-chat-history.bak`, run
  `init --first-user-msg "<msg>" --freq <frequency>`. Skip summary.
- **3 (Ignore)** — do nothing. Report that logging is off for this
  conversation. Stop.

### 3d. Building the in-memory entries list (Merge / Replace)

Reconstruct the agent's prior turns as a JSON array:

- one `{"t":"user","text":"<preview>","ts":"<iso>"}` per user message
- one `{"t":"agent","text":"<preview>","ts":"<iso>"}` per agent reply
- `text` previews capped at ~200 chars (whitespace flattened)
- timestamps in ISO-8601 UTC (current time is acceptable if exact times
  are unknown; order is what matters)
- no tool-call payloads, no file contents, no secrets

If the list is large (>30 KB), stream it via stdin:
`prepend --entries-stdin` or `reset --entries-stdin`.

### 4. Overflow check

After any Merge or Replace, run
`scripts/chat_history.py rotate --max-kb <max_size_kb>
--mode <on_overflow>` so the combined body stays within the user's
budget.

### 5. Summarize into conversation context

Read the entries via the helper (`read --all` or `read --last N` for
bounded). Produce a short, structured summary — **not** a verbatim dump:

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

### 6. Hand control back to the user

After presenting the summary, stop and wait. Do not auto-resume work —
the user decides what to do next.

## Gotchas

- **Iron law — one question at a time.** Even if the log contains
  several open threads, ask about one at a time after the summary
  (see [`ask-when-uncertain`](../rules/ask-when-uncertain.md)).
- `adopt` rewrites the header in place and pushes the previous fp into
  `former_fps` (capped at 10). No backup is created — use
  `/chat-history-clear` first if you want a clean slate.
- `reset` discards whatever was on disk. Only use it when the user
  explicitly picks "Replace".
- The summary is derived from the agent's reading of the JSONL. Old
  entries may be incomplete (especially under `per_turn` with
  previews only). Flag gaps explicitly.

## See also

- [`chat-history`](../rules/chat-history-ownership.md) — the rule that triggers
  this command via the foreign- and returning-session prompts
- [`/chat-history`](chat-history.md) — status inspection without adopting
- [`/chat-history-clear`](chat-history-clear.md) — wipe instead of adopt
- [`/agent-handoff`](agent-handoff.md) — complementary: generates a
  paste-into-new-chat prompt (no disk file)
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — helper API
