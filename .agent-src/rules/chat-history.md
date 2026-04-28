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

## Iron Law — append at every cadence boundary, ALWAYS

```
APPEND TO .agent-chat-history AT EVERY CADENCE BOUNDARY. ALWAYS.
BEFORE SENDING ANY REPLY, RUN THE PRE-SEND GATE BELOW.
A REPLY WITHOUT A MATCHING APPEND IS A RULE VIOLATION, NOT A SLIP.
```

**Overrides** token-efficiency, conversation momentum, "the turn was
trivial". The whole point of the log is crash recovery — silently
skipping turns defeats it. First thing to check after the reply is
drafted, last thing before it goes out.

### Pre-send gate — MANDATORY before every reply

Run silently **before** emitting the final reply:

1. **Detect** — does this turn cross the configured cadence boundary?
   - `per_turn` → every reply crosses one. Always append.
   - `per_phase` → did this turn complete a phase boundary? (user
     question answered, decision taken, task-list item completed,
     significant tool sequence finished). If yes, append. If the turn
     is a pure clarification with no progress, skip.
   - `per_tool` → did any tool call run this turn? If yes, append.
2. **Check** — was `scripts/chat_history.py append` already called this
   turn for the boundary identified in step 1?
3. **Append** — if not, do it now with a one-line `phase`/`decision`
   entry capturing what the turn produced. Use a `phase` entry over
   `agent` when the turn marks a boundary.
4. **Confirm** — the `append` call returned 0. If it failed (file lock,
   ownership mismatch from a parallel session), surface the error to
   the user — do not swallow it.

### Failure modes

Cadence is the trigger, not reply length. Never batch missed turns at
the end — crashes happen between turns. After tool-heavy turns, append
last before shipping. If the configured cadence is unrealistic for the
agent's actual discipline (drift between setting and behavior), fix the
setting — don't keep skipping.

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
  decision, task-list item completion).
- `per_tool` — after each tool-call sequence.

Entry types: `user`, `agent`, `tool`, `decision`, `phase`. Prefer `phase`
over `agent` when the entry marks a boundary.

## Overflow — from `on_overflow`

When file size > `max_size_kb`: `rotate` → `rotate --mode rotate
--max-kb <n>` (drops oldest, silent). `compress` → `rotate --mode
compress --max-kb <n>` (marks for next-turn summarization; do not block
the current turn). Run the overflow check once after Merge/Replace
rewrites. Setting is stable for the session — never mix modes.

## What this rule does NOT do

Display/reload/clear (`/chat-history*` commands). Auto-flip `enabled` or
`on_overflow`. Run when `enabled: false` (no silent logging, no
telemetry). Decide ownership heuristically — only `state` does that.

## Interactions & references

- `ask-when-uncertain` + `user-interaction` — foreign/returning prompts
  use numbered options, one question per turn.
- `language-and-tone` — prompt translated at runtime; `.md` stays English.
- `onboarding-gate` — runs first; this rule activates only after it clears.
- `token-efficiency` — never load the full log; use `status` for
  metadata, `read --last N` for a tail.
- File API: [`scripts/chat_history.py`](../../../scripts/chat_history.py).
  Commands: [`/chat-history`](../commands/chat-history.md),
  [`/chat-history-resume`](../commands/chat-history-resume.md),
  [`/chat-history-clear`](../commands/chat-history-clear.md). Settings:
  [`agent-settings` template](../templates/agent-settings.md). Type
  governance: [`rule-type-governance`](rule-type-governance.md).
