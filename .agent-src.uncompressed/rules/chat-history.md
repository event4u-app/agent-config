---
type: "always"
description: "Persist the conversation to .agent-chat-history for crash recovery — read on first turn, append on progress, detect foreign sessions, honor per-profile frequency and overflow settings"
alwaysApply: true
source: package
---

# Chat History

Persists the conversation to `.agent-chat-history` (JSONL, project root,
git-ignored) so a crashed or switched agent session can be resumed. File
I/O is owned by [`scripts/chat_history.py`](../../../scripts/chat_history.py)
— this rule says **when** to call it, not how the file is structured.

## Activation

Read `chat_history.*` from `.agent-settings.yml` **once per conversation**
(first turn). Cache the values.

- `chat_history.enabled: false` **or** section missing → rule is a **no-op**
  for the whole conversation. Do not read, write, or mention the file.
- `chat_history.enabled: true` → cache `frequency`, `max_size_kb`,
  `on_overflow` and proceed to the first-turn handshake.

## First-turn handshake

Before executing the user's request:

1. If `.agent-chat-history` does not exist → run `scripts/chat_history.py
   init --first-user-msg "<msg>" --freq <frequency>`. Proceed silently.
2. If it exists → run `scripts/chat_history.py check --first-user-msg
   "<msg>"`. The helper prints `match` | `mismatch` | `missing`.
   - `match` → adopt, continue appending.
   - `mismatch` → **ask before touching the file** (see below).
   - `missing` → corrupt header; `init` a fresh file.

## Append cadence — from `frequency`

Every append goes through `scripts/chat_history.py append --type <t>
--json '<obj>'`. Never write the file directly.

- `per_turn` — one entry at the end of every agent turn.
- `per_phase` — at phase boundaries (user question, agent answer,
  decision, completion of a task-list item).
- `per_tool` — after each tool-call sequence.

Entry types: `user`, `agent`, `tool`, `decision`, `phase`. Prefer `phase`
over `agent` when the entry marks a boundary.

## Overflow — from `on_overflow`

When the helper reports file size > `max_size_kb`:

- `rotate` → `rotate --mode rotate --max-kb <n>`. Drops oldest entries;
  silent and cheap.
- `compress` → `rotate --mode compress --max-kb <n>`. Marks the file for
  summarization; the **next** turn writes the summary for the dropped
  range. Do not block the current turn on this.

The setting is stable for the session; never mix modes.

## Ask on foreign

When `check` returns `mismatch` **and** `status.entries >= 1`, stop and
ask before any write:

```
> 📒 Found existing chat history from a different session.
>
> Header fingerprint: <short-hash-A>
> Current session:    <short-hash-B>
> Entries on file:    <N>   Age: <age>
>
> 1. Resume — adopt this file and continue appending
> 2. Archive — move it to .agent-chat-history.bak and start fresh
> 3. Ignore — disable logging for this session only
```

- `1` → `adopt --first-user-msg "<msg>"`, then append normally.
- `2` → rename to `.agent-chat-history.bak`, then `init --first-user-msg
  <msg>`.
- `3` → disable logging for this conversation; do not touch the file,
  do not edit settings.

Free-text replies ("weiter", "skip it") count as `3`.

## What this rule does NOT do

- Display, reload, or clear the log — that is `/chat-history`,
  `/chat-history-resume`, `/chat-history-clear`.
- Auto-flip `enabled` or `on_overflow` in settings.
- Run when `enabled: false`. No silent logging. No telemetry.

## Interactions

- `ask-when-uncertain` + `user-interaction` — foreign-session prompt uses
  numbered options, one question per turn.
- `language-and-tone` — prompt translated at runtime; `.md` stays English.
- `onboarding-gate` — runs first; this rule activates only after it clears.
- `token-efficiency` — never load the full log into context from this
  rule; use `status` for metadata.

## See also

- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — file API
- [`/chat-history`](../commands/chat-history.md) — status inspection
- [`/chat-history-resume`](../commands/chat-history-resume.md) — adopt + load
- [`/chat-history-clear`](../commands/chat-history-clear.md) — wipe
- [`agent-settings` template](../templates/agent-settings.md) — `chat_history.*` reference
- [`rule-type-governance`](rule-type-governance.md) — why this is `always`
