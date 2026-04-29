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

## Iron Law — three gates, skipping any one is a rule violation

```
1. turn-check    — first tool call of every session
2. append        — at every cadence boundary, with --first-user-msg
3. heartbeat     — last line of every reply, script-generated, verbatim
```

**Overrides** token-efficiency, conversation momentum, "the turn was
trivial". Three enforcement layers make violations observable:
**turn-start gate** (`turn-check` exits non-zero on
`missing`/`foreign`/`returning`), **append-side refusal**
(`append --first-user-msg` exits `3` on ownership mismatch), and
**reply-side heartbeat** (script-generated marker; missing marker or
stale entry-count = silent skip becomes immediately visible).

### Turn-start gate — MANDATORY first tool call

```bash
scripts/chat_history.py turn-check --first-user-msg "<first-user-msg>"
```

Exit codes: `0` = `ok`/`disabled` (proceed), `10` = `missing`
(run `init --first-user-msg "..." --freq <freq>`), `11` = `foreign`
(render Foreign-Prompt + stop), `12` = `returning` (render
Returning-Prompt + stop). The script also writes a one-line
`ACTION REQUIRED:` hint to stderr on non-zero exits.

### Append cadence — MANDATORY at boundaries

Cadence comes from `chat_history.frequency`:

- `per_turn` → one entry at the end of every agent turn.
- `per_phase` → at phase boundaries (user question answered, decision
  taken, task-list item completed, significant tool sequence finished).
  Pure clarification turns may skip.
- `per_tool` → after each tool-call sequence.

Every append goes through

```bash
scripts/chat_history.py append --first-user-msg "<msg>" \
  --type <user|agent|tool|decision|phase> --json '<obj>'
```

Never write the file directly. Prefer `phase` over `agent` for
boundaries. Exit `3` (`OWNERSHIP_REFUSED`) means turn-start was
skipped or the file was hijacked — surface it, do not swallow it.
Cadence is the trigger, not reply length; do not batch missed turns at
the end (crashes happen between turns).

### Heartbeat marker — MANDATORY in every reply

Run silently before emitting the final reply:

```bash
scripts/chat_history.py heartbeat --first-user-msg "<first-user-msg>"
```

Stdout is a single line, e.g.
`📒 chat-history: ok · 9 entries · per_phase · last 30s ago`. Include
this line **verbatim** as the last line of the reply. Always exits 0
— this is observability, not a gate.

**NEVER type the marker from memory.** Re-running the script is
the observability gate — typing the line from what you *remember*
makes stale counts, frozen ages, and foreign/missing/returning
states invisible. Every reply: invoke, copy stdout, paste
verbatim. Same rule for any tool-generated marker — re-run the
source, never reproduce from memory.

States: `ok` (entries+age shown), `disabled` (compact, single token),
`foreign`/`returning`/`missing` (marker tells the user the prompt or
init step is owed). The user sees stale entry counts or missing
markers immediately; that is the point — the previous text-only
pre-send gate was bypassed silently and this layer makes that
impossible.

## Activation & handshake

Read `chat_history.*` from `.agent-settings.yml` **once per conversation**
(first turn) and cache. `enabled: false` or section missing → rule is a
**no-op** (do not read, write, or mention the file). Otherwise cache
`frequency`, `max_size_kb`, `on_overflow` and run `turn-check` — its
state token branches to one of: `missing` → `init`, `ok` → continue,
`foreign` → Foreign-Prompt, `returning` → Returning-Prompt.

In `foreign` and `returning`, **always read the file's current contents
into the agent's working context before any write** — the user chose to
log history for a reason; losing it silently is never acceptable.

The legacy `state --first-user-msg` subcommand still exists for shell
scripts that need the bare token; agents prefer `turn-check` (folds in
`enabled` + distinct exit codes).

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

Trigger: `state == returning`. File exists, owned by a different session,
but this chat's fingerprint is in `former_fps`. Agent still holds its
own in-memory turns from before the hand-off.

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

- `1` (Merge) → build entries list (below), `prepend --entries-json '<list>'`,
  then `adopt --first-user-msg "<msg>"`.
- `2` (Replace) → build entries list,
  `reset --first-user-msg "<msg>" --freq <frequency> --entries-json '<list>'`.
- `3` (Continue) → `adopt --first-user-msg "<msg>"`, then append normally.

Free-text replies count as `3`.

### In-memory entries list (Merge / Replace)

JSON array, one entry per turn boundary, compact:
`{"t":"user|agent","text":"<preview>","ts":"<iso-utc>"}`. `text` is a
flattened preview ≤ ~200 chars (context, not transcript). Use current
time if exact timestamps are unknown — order matters, not precision.
Never include tool payloads, file contents, or secrets. For large
lists (>30 KB) use `reset ... --entries-stdin <<< '<list>'`.

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

- `ask-when-uncertain` + `user-interaction` — foreign/returning prompts use
  numbered options, one question per turn.
- `language-and-tone` — prompt translated at runtime; `.md` stays English.
- `onboarding-gate` — runs first; this rule activates only after it clears.
- `token-efficiency` — never load the full log; use `status` /  `read --last N`.
- File API: [`scripts/chat_history.py`](../../../scripts/chat_history.py).
  Commands: [`/chat-history`](../commands/chat-history.md),
  [`/chat-history-resume`](../commands/chat-history-resume.md),
  [`/chat-history-clear`](../commands/chat-history-clear.md). Settings:
  [`agent-settings`](../templates/agent-settings.md). Types:
  [`rule-type-governance`](rule-type-governance.md).
