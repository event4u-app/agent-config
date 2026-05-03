---
name: chat-history-clear
description: Manually delete the persistent chat-history log — asks for confirmation, optionally archives to a timestamped backup before wiping
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Destructive log wipe — must be deliberate."
---

<!-- cloud_safe: noop -->

# /chat-history-clear

Wipes `.agent-chat-history`. Use when the log is stale (wrong session),
bloated beyond usefulness, or contains information you do not want
persisted on disk.

This command is **destructive** — always asks for confirmation before
touching the file, unless the file does not exist in the first place.

## When NOT to use

- Inspect before deleting → [`/chat-history`](chat-history.md).
- Keep the entries but re-point the header → [`/chat-history-resume`](chat-history-resume.md).
- Disable logging entirely → set `chat_history.enabled: false` in
  `.agent-settings.yml`; see
  [`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules).
  Disabling does not delete the existing file; run this command
  afterwards if you also want it gone.

## Steps

### 1. Check current state

Run `scripts/chat_history.py status`. If `exists: false`, tell the user
and stop:

```
> 📒 No .agent-chat-history to clear.
```

### 2. Show what is about to be deleted

Render a short preview so the user sees what they are wiping:

```
> 📒 About to clear .agent-chat-history
>
> Size:       {size_kb} KB
> Entries:    {entries}
> Session:    {short_fp}  (started {created_at_relative})
>
> 1. Archive — rename to .agent-chat-history.{YYYYMMDD-HHMMSS}.bak, then start fresh
> 2. Delete — permanent, no backup
> 3. Cancel — keep the file as-is
```

### 3. Act on the choice

- `1` (Archive) → `mv .agent-chat-history
  .agent-chat-history.{timestamp}.bak`. The rule will create a fresh
  file on the next append.
- `2` (Delete) → run `scripts/chat_history.py clear`. Permanent.
- `3` (Cancel) → stop. Make no changes.

Free-text replies ("abbrechen", "keep it", "nevermind") count as `3`.
An unrecognized reply also counts as `3` — never delete on ambiguous
input.

### 4. Confirm

After a successful archive or delete, print a one-line confirmation:

```
> 📒 Archived to .agent-chat-history.{timestamp}.bak
```

or

```
> 📒 .agent-chat-history deleted.
```

Do **not** re-enable logging or change `.agent-settings.yml` as a side
effect — this command is scoped to the file on disk only.

## Gotchas

- `.agent-chat-history.*.bak` files are also git-ignored by the
  installer's `.gitignore` block. They accumulate if archived often —
  users can delete them manually.
- If `chat_history.enabled: false`, the file will **not** be recreated
  after clearing. That is usually fine, but mention it so the user
  knows the log is now silent.
- Deletion cannot be undone. When in doubt, prefer option `1` (Archive).

## See also

- [`chat-history`](../rules/chat-history-ownership.md) — the rule that writes the file
- [`/chat-history`](chat-history.md) — status inspection
- [`/chat-history-resume`](chat-history-resume.md) — load + adopt instead of wipe
- [`agent-settings` template](../templates/agent-settings.md) — `chat_history.*` reference
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — helper API
