---
type: "always"
description: "Persist the conversation to .agent-chat-history for crash recovery — read on first turn, detect match/returning/foreign/missing, append on progress, honor per-profile frequency and overflow settings"
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

## First-turn handshake — four states

Before executing the user's request, run:

```bash
scripts/chat_history.py state --first-user-msg "<msg>"
```

It prints exactly one of `match` | `returning` | `foreign` | `missing`.
Branch:

- `missing` → `init --first-user-msg "<msg>" --freq <frequency>`. Proceed
  silently.
- `match` → this chat already owns the file. Continue appending as cached.
- `foreign` → a different session's file. Show **Foreign-Prompt** below.
- `returning` → this chat once owned the file but another session took
  over. Show **Returning-Prompt** below.

In `foreign` and `returning`, **always read the file's current contents
into the agent's working context before any write** — the user chose to
log history for a reason; losing it silently is never acceptable.

## Foreign-Prompt — new chat finds existing history

Trigger: `state == foreign` **and** `status.entries >= 1`.

```
> 📒 Found chat history from an unknown session.
>
> Header fingerprint: <short-hash-A>
> Current session:    <short-hash-B>
> Entries on file:    <N>   Age: <age>
>
> 1. Resume — adopt this file, load entries as context, keep appending here
> 2. New start — archive to .agent-chat-history.bak, init fresh
> 3. Ignore — leave the file untouched, disable logging for this session
```

- `1` → `adopt --first-user-msg "<msg>"` (the old fp lands in
  `former_fps` automatically). Read entries into context, then append
  normally.
- `2` → rename to `.agent-chat-history.bak`, then
  `init --first-user-msg "<msg>" --freq <frequency>`.
- `3` → logging disabled for this conversation; do not touch the file,
  do not edit settings.

Free-text replies ("weiter", "skip it") count as `3`.

## Returning-Prompt — old chat comes back

Trigger: `state == returning`. The file exists, its current owner is a
different session, but this chat's fingerprint is in `former_fps`. The
agent still has its own in-memory history of the turns it logged before
the hand-off.

```
> 📒 Welcome back. This chat once owned the history file; another
> session has written to it since.
>
> On-file entries:    <N>   Size: <X> KB   (now includes <M> foreign entries)
>
> (All three options read the on-disk entries into context first.)
>
> 1. Merge — my in-memory history first, the foreign entries after,
>    overwrite the file with the combined body
> 2. Replace — wipe the foreign entries, rewrite the file with my
>    in-memory history only
> 3. Continue — leave the file as-is; only new entries from now on
```

- `1` (Merge) → build the in-memory entries list (see below), call
  `prepend --entries-json '<list>'`, then `adopt --first-user-msg "<msg>"`.
- `2` (Replace) → build the in-memory list,
  `reset --first-user-msg "<msg>" --freq <frequency> --entries-json '<list>'`.
- `3` (Continue) → `adopt --first-user-msg "<msg>"`, then append normally.

Free-text replies count as `3`.

## Building the in-memory entries list (Merge / Replace)

The agent reconstructs its own conversation as a JSON array, one entry
per turn boundary. Keep it compact:

- One `{"t":"user","text":"<preview>","ts":"<iso>"}` per user message.
- One `{"t":"agent","text":"<preview>","ts":"<iso>"}` per agent reply.
- `text` is a preview — flatten whitespace, cap at ~200 characters. This
  is context, not a transcript.
- Timestamps in ISO-8601 UTC. If the agent does not have exact times,
  use the current time for all entries; order is what matters.
- Do **not** include tool-call payloads, file contents, or secrets.

If the list is large (>30 KB), pass it via stdin:
`reset ... --entries-stdin <<< '<list>'`.

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

After Merge or Replace rewrites, run the overflow check once — the new
body may exceed the budget.

The setting is stable for the session; never mix modes.

## What this rule does NOT do

- Display, reload, or clear the log — that is `/chat-history`,
  `/chat-history-resume`, `/chat-history-clear`.
- Auto-flip `enabled` or `on_overflow` in settings.
- Run when `enabled: false`. No silent logging. No telemetry.
- Decide ownership heuristically. Only the `state` helper does that.

## Interactions

- `ask-when-uncertain` + `user-interaction` — foreign/returning prompts
  use numbered options, one question per turn.
- `language-and-tone` — prompt translated at runtime; `.md` stays English.
- `onboarding-gate` — runs first; this rule activates only after it clears.
- `token-efficiency` — never load the full log into context from this
  rule; use `status` for metadata, `read --last N` for a tail.

## See also

- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — file API
- [`/chat-history`](../commands/chat-history.md) — status inspection
- [`/chat-history-resume`](../commands/chat-history-resume.md) — adopt + load
- [`/chat-history-clear`](../commands/chat-history-clear.md) — wipe
- [`agent-settings` template](../templates/agent-settings.md) — `chat_history.*` reference
- [`rule-type-governance`](rule-type-governance.md) — why this is `always`
