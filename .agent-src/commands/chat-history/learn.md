---
name: chat-history:learn
cluster: chat-history
sub: learn
description: Surface prior chat-history sessions as numbered options, let the user pick exactly one, then read its entries verbatim — selective, user-driven cross-session learning
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "import a past session into the current chat, learn from a prior session, pick a session to read"
  trigger_context: "user wants to selectively pull context from one earlier session into the current one"
---
<!-- cloud_safe: noop -->

# /chat-history learn

Read-only, **user-driven** cross-session import. Surfaces prior
sessions in `.agent-chat-history` as numbered options, user picks
**one**, agent reads that session's entries **verbatim**. Any
extraction or summarisation happens in dialogue, user-directed —
agent does **not** auto-summarise, auto-import, or rewrite user
context (Council Round 2 / R2-2 — verbatim is honest v1 contract).

Opt-in counterpart to read-path filter (Phase 3 of
`road-to-chat-history-session-isolation`): default reads stay
session-scoped; `learn` is the explicit cross-boundary surface.

## When NOT to use

- Inspect current session — default of `/chat-history show` plus
  `scripts/chat_history.py read`.
- Bulk-import all sessions — out of scope for v1. One session per
  invocation; multi-pick is v2.
- Search prior sessions by content — out of scope for v1; no fuzzy
  search, no full-text grep. User picks by `id`, `last_ts`, `preview`.

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false`
or section missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Set it to true in .agent-settings.yml to start logging.
```

### 2. List sessions

Run `scripts/chat_history.py sessions --json --limit 20`. Helper
returns array of `{id, count, first_ts, last_ts, preview}` sorted
by `last_ts` desc. Default excludes empty buckets — only sessions
with at least one body entry.

If empty array, stop:

```
> 📒 No prior sessions found in .agent-chat-history.
```

### 3. Surface as numbered options

Render each session as numbered option (per `user-interaction` —
Iron Law: numbered options for any picker). Format:

```
> Pick a session to read verbatim:
>
> 1. {id}  ·  {count} entries  ·  {last_ts}
>    {preview}
> 2. ...
> ...
> N. abort — do not read any session
```

Keep preview ≤ 80 chars (helper truncates). Always include explicit
abort option as last numbered choice.

### 4. Wait for the pick

**One question per turn** (per `ask-when-uncertain`). Do not chain
listing with anything else; do not auto-pick; do not surface a
default. Wait for user response.

If user picks abort, stop without reading.

### 5. Read picked session verbatim

Run `scripts/chat_history.py read --session <id>` with picked `id`.
Helper returns entries as JSON.

Render **verbatim** in chat — do not summarise, do not re-format,
do not drop fields. One entry per line acceptable; preserve `t`,
`text`, `name`, `ts`, and any other fields helper emits. Use fenced
block so timestamps and JSON survive markdown:

````
> 📒 Session {id} — {count} entries

```json
{...entry 1...}
{...entry 2...}
...
```
````

If session is large (>50 entries), still render verbatim — but
prepend one-line note that listing is long, so user can scroll.
Do not silently truncate.

### 6. Hand back

After rendering, **do not** auto-act on content. Hand back with
short prompt:

```
> Picked session is rendered above. What would you like to extract?
```

Any follow-up (extract decisions, copy entries into current
session, etc.) is user-directed in subsequent turns. Agent does
not write to current session's log on user's behalf without
explicit instruction.

## Gotchas

- **Verbatim, not structured.** Council Round 2 (R2-2) resolved
  earlier contradiction in favour of verbatim. Do not "helpfully"
  pre-summarise — user reads source, then directs extraction.
- **One pick per invocation.** Multi-pick is v2. For second
  session, run `/chat-history learn` again.
- **Read-only.** Never writes to `.agent-chat-history`, never
  rotates.
- **`<legacy>` and `<unknown>` buckets** appear like any session
  id when they have body entries — user can pick them too. Helper
  aggregates entries with no `s` field into `<legacy>` and entries
  with `s == "<unknown>"` into `<unknown>`.

## See also

- [`chat-history-platform-hooks`](../../../agents/contexts/chat-history-platform-hooks.md) — read contract, isolation default, learn opt-in path
- [`/chat-history show`](show.md) — current-session inspector
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — `sessions` and `read --session` CLI surface
- [`user-interaction`](../../rules/user-interaction.md) — numbered-options Iron Law
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — one-question-per-turn Iron Law
