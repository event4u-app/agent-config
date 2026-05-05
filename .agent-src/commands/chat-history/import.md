---
name: chat-history:import
cluster: chat-history
sub: import
description: Surface prior chat-history sessions as numbered options, let the user pick exactly one, then render its entries verbatim into the current chat — selective, user-driven cross-session import
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "import a past session into the current chat, pull a prior session into context, pick a session to read"
  trigger_context: "user wants to selectively pull verbatim context from one earlier session into the current one"
---
<!-- cloud_safe: noop -->

# /chat-history import

Read-only, **user-driven** cross-session import. Surfaces prior
sessions logged in `.agent-chat-history` as numbered options, the
user picks **one**, the agent reads that session's entries
**verbatim** and renders them in the chat. Any subsequent
extraction or summarisation happens in dialogue, user-directed —
the agent does **not** auto-summarise, auto-import, or rewrite the
user's context (Council Round 2 / R2-2 — verbatim is the honest v1
contract).

This is the opt-in counterpart to the read-path filter (Phase 3 of
`road-to-chat-history-session-isolation`): default reads stay
session-scoped; `import` is the explicit surface for crossing the
session boundary verbatim. For project-improving learnings derived
from a prior session, see [`/chat-history learn`](learn.md).

## When NOT to use

- Inspect the current session — that is the default of
  `/chat-history show` plus `scripts/chat_history.py read`.
- Generate a learning proposal from a prior session — use
  [`/chat-history learn`](learn.md), which orchestrates
  `learning-to-rule-or-skill` on the picked session.
- Bulk-import all sessions — out of scope for v1. One session per
  invocation; multi-pick is v2.
- Search prior sessions by content — out of scope for v1; no fuzzy
  search, no full-text grep. The user picks by `id`, `last_ts`, and
  `preview` from the listing.

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false`
or the section is missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Set it to true in .agent-settings.yml to start logging.
```

### 2. List sessions

Run `scripts/chat_history.py sessions --json --limit 20`. The
helper returns an array of `{id, count, first_ts, last_ts, preview}`
sorted by `last_ts` desc. Default excludes empty buckets — only
sessions with at least one body entry are surfaced.

If the array is empty, stop:

```
> 📒 No prior sessions found in .agent-chat-history.
```

### 3. Surface as numbered options

Render each session as a numbered option (per the `user-interaction`
rule — Iron Law: numbered options for any picker). Format:

```
> Pick a session to import verbatim:
>
> 1. {id}  ·  {count} entries  ·  {last_ts}
>    {preview}
> 2. ...
> ...
> N. abort — do not read any session
```

Keep the preview ≤ 80 chars (the helper already truncates). Always
include an explicit abort option as the last numbered choice.

### 4. Wait for the pick

**One question per turn** (per `ask-when-uncertain`). Do not chain
the listing with anything else; do not auto-pick; do not surface a
default. Wait for the user's response.

If the user picks the abort option, stop without reading.

### 5. Read the picked session verbatim

Run `scripts/chat_history.py read --session <id>` with the picked
`id`. The helper returns the entries as JSON.

Render them **verbatim** in the chat — do not summarise, do not
re-format, do not drop fields. One entry per line is acceptable;
preserve `t`, `text`, `name`, `ts`, and any other fields the helper
emits. Use a fenced block so timestamps and JSON survive markdown
rendering:

````
> 📒 Session {id} — {count} entries

```json
{...entry 1...}
{...entry 2...}
...
```
````

If the session is large (>50 entries), still render verbatim — but
prepend a one-line note that the listing is long, so the user can
scroll. Do not silently truncate.

### 6. Hand back

After rendering, **do not** auto-act on the content. Hand back to
the user with a short prompt:

```
> Picked session is rendered above. What would you like to extract?
```

Any follow-up (extract decisions, copy specific entries into the
current session, etc.) is user-directed in subsequent turns. The
agent does not write to the current session's log on the user's
behalf without an explicit instruction.

## Gotchas

- **Verbatim, not structured.** Council Round 2 (R2-2) resolved an
  earlier contradiction in favour of verbatim. Do not "helpfully"
  pre-summarise — the user reads the source, then directs the
  extraction.
- **One pick per invocation.** Multi-pick is v2. If the user wants
  a second session, run `/chat-history import` again.
- **Read-only.** This command never writes to `.agent-chat-history`
  and never rotates.
- **`<legacy>` and `<unknown>` buckets** show up like any other
  session id when they have body entries — the user can pick them
  too. The helper aggregates body entries with no `s` field into
  `<legacy>` and entries with `s == "<unknown>"` into `<unknown>`.

## See also

- [`/chat-history learn`](learn.md) — pick a prior session and turn it into a project-improving proposal via `learning-to-rule-or-skill`
- [`/chat-history show`](show.md) — current-session inspector
- [`chat-history-platform-hooks`](../../../agents/contexts/chat-history-platform-hooks.md) — read contract, isolation default, opt-in cross-session path
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — `sessions` and `read --session` CLI surface
- [`user-interaction`](../../rules/user-interaction.md) — numbered-options Iron Law
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — one-question-per-turn Iron Law
