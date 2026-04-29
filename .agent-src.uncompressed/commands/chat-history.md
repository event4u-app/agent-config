---
name: chat-history
description: Show the status of the persistent chat-history log — file size, entry count, header fingerprint, age, and the last few entries
disable-model-invocation: true
---

<!-- cloud_safe: noop -->

# /chat-history

Inspect `.agent-chat-history` — the JSONL log maintained by the
[`chat-history`](../rules/chat-history.md) rule for crash recovery.

Shows:

- Whether the file exists and whether logging is currently enabled
- File size vs `max_size_kb`
- Header metadata: fingerprint preview, created-at, `frequency`
- Entry count and age of the oldest/newest entry
- A peek at the last 3–5 entries so the user can see what was captured

Read-only — this command never writes to the file.

## When NOT to use

- Load the log back into the conversation for context →
  [`/chat-history-resume`](chat-history-resume.md).
- Wipe the file → [`/chat-history-clear`](chat-history-clear.md).
- Configure logging behavior → edit `.agent-settings.yml` directly
  (`chat_history.*`); see
  [`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules).

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false` or
the section is missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Set it to true in .agent-settings.yml to start logging.
```

### 2. Read status via helper

Run `scripts/chat_history.py status`. The helper returns a JSON object
with `exists`, `size_bytes`, `size_kb`, `entries`, `header`, and `path`.

If `exists: false`, tell the user the file has not been created yet —
it will be created on the next agent turn that writes an entry.

### 3. Read last N entries

Run `scripts/chat_history.py read --last 5` (or equivalent — see the
helper's CLI). Capture timestamps and entry types without loading the
full file.

### 4. Present the summary

Render a concise report:

```
> 📒 chat-history status
>
> File:       .agent-chat-history  ({size_kb} KB / {max_size_kb} KB)
> Entries:    {entries}
> Fingerprint:{short_fp}  (session started {created_at_relative})
> Frequency:  {frequency}
> Overflow:   {on_overflow}
>
> Last entries:
>   {ts_1}  {type_1}  {preview_1}
>   {ts_2}  {type_2}  {preview_2}
>   ...
```

Keep previews short (≤ 60 chars). Do not render the full entry text
unless the user asks (avoids flooding the conversation with old log
data, see [`token-efficiency`](../rules/token-efficiency.md)).

### 5. Offer follow-ups (optional)

If the file exists and the fingerprint does **not** match the current
session, suggest `/chat-history-resume` to adopt it.

If the file is close to `max_size_kb` (> 80 %), mention it — the next
append may trigger overflow handling.

## Gotchas

- `.agent-chat-history` is git-ignored. This command never commits.
- The helper is the only way to read the file — do not cat or parse
  the JSONL directly; entry shape is owned by `scripts/chat_history.py`.
- If `exists: false` but the rule says logging is enabled, the file is
  created lazily on the first append. That is expected — not an error.

## See also

- [`chat-history`](../rules/chat-history.md) — the rule that writes the file
- [`/chat-history-resume`](chat-history-resume.md) — adopt + load
- [`/chat-history-clear`](chat-history-clear.md) — wipe
- [`agent-settings` template](../templates/agent-settings.md) — `chat_history.*` reference
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — helper API
