# Chat-History Handshake — Foreign / Returning prompts

Operational reference cited by [`rules/chat-history.md`](../../.agent-src.uncompressed/rules/chat-history.md).
Holds the verbose prompt blocks, free-text fallbacks, and the in-memory
entries-list shape so the rule itself stays under the size budget.

The triggers that select between these prompts come from
`scripts/chat_history.py turn-check` exit codes:

- `11` → `foreign` → render Foreign-Prompt below.
- `12` → `returning` → render Returning-Prompt below.

Both prompts are numbered-options blocks per
[`user-interaction`](../../.agent-src.uncompressed/rules/user-interaction.md);
free-text replies fall back to option `3` ("Ignore" / "Continue").

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

## In-memory entries list (Merge / Replace)

JSON array, one entry per turn boundary, compact:
`{"t":"user|agent","text":"<preview>","ts":"<iso-utc>"}`. `text` is a
flattened preview ≤ ~200 chars (context, not transcript). Use current
time if exact timestamps are unknown — order matters, not precision.
Never include tool payloads, file contents, or secrets. For large
lists (>30 KB) use `reset ... --entries-stdin <<< '<list>'`.

## Overflow — from `on_overflow`

When file size > `max_size_kb`:

- `rotate` → `rotate --mode rotate --max-kb <n>` — drops oldest entries silently.
- `compress` → `rotate --mode compress --max-kb <n>` — marks for next-turn
  summarization; do not block the current turn.

Run the overflow check once after Merge / Replace rewrites. The setting is
stable for the session — never mix modes.

## See also

- [`rules/chat-history.md`](../../.agent-src.uncompressed/rules/chat-history.md) — Iron Law and activation gates.
- [`agents/contexts/chat-history-platform-hooks.md`](chat-history-platform-hooks.md) — per-platform classification.
- [`scripts/chat_history.py`](../../scripts/chat_history.py) — canonical implementation.
