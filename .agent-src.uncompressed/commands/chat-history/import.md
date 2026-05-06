---
name: chat-history:import
cluster: chat-history
sub: import
description: Surface prior chat-history sessions as a numbered table, let the user pick one, read it silently, and emit a short summary plus a resume offer — selective, user-driven cross-session import
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "import a past session into the current chat, pull a prior session into context, pick a session to read"
  trigger_context: "user wants to selectively pull a prior session's context into the current one as a short summary"
---
<!-- cloud_safe: noop -->

# /chat-history import

Read-only, **user-driven** cross-session import. Surfaces prior
sessions logged in `agents/.agent-chat-history` as a numbered table,
the user picks **one**, the agent reads that session **silently**
and emits a 2–5 sentence summary, then offers to resume the last
task from that session. The agent does **not** render entries
verbatim, auto-import, or rewrite the user's context without an
explicit instruction.

This is the opt-in counterpart to the read-path filter (Phase 3 of
`road-to-chat-history-session-isolation`): default reads stay
session-scoped; `import` is the explicit surface for crossing the
session boundary. For project-improving learnings derived from a
prior session, see [`/chat-history learn`](learn.md).

## When NOT to use

- Inspect the current session — that is the default of
  `/chat-history show` plus `scripts/chat_history.py read`.
- Generate a learning proposal from a prior session — use
  [`/chat-history learn`](learn.md), which orchestrates
  `learning-to-rule-or-skill` on the picked session.
- Bulk-import all sessions — out of scope for v1. One session per
  invocation; multi-pick is v2.
- Search prior sessions by content — out of scope for v1; no fuzzy
  search, no full-text grep. The user picks by `last_ts` and
  `summary` from the listing.

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false`
or the section is missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Set it to true in .agent-settings.yml to start logging.
```

### 2. List sessions

Run `scripts/chat_history.py sessions --json --limit 20 --summary`.
The helper returns an array of
`{id, count, first_ts, last_ts, preview, summary}` sorted by
`last_ts` desc. The `summary` field is built **inside the helper**
from at most 10 sampled entries per session (5 oldest + 5 newest) —
token-cheap, no need to ever read the full body for the picker.
Default excludes empty buckets — only sessions with at least one
body entry are surfaced.

If the array is empty, stop:

```
> 📒 No prior sessions found in agents/.agent-chat-history.
```

### 3. Surface as a numbered table

Render the sessions as a markdown table — the row number is the
option (per `user-interaction` Iron Law: numbered options for any
picker). The session `id` is noise to humans; keep it **internal**
for step 5's `read --session <id>` call and never render it.
Format:

```
Pick a session to import:

| #  | Date             | Entries | Summary |
|----|------------------|---------|---------|
| 1  | YYYY-MM-DD HH:MM | N       | {summary} |
| 2  | YYYY-MM-DD HH:MM | N       | {summary} |
| …  |                  |         |           |
| N  | —                | —       | abort — do not read any session |
```

Format the timestamp as `YYYY-MM-DD HH:MM` (drop seconds and
timezone — the listing is for orientation, not forensics). Lead the
`Summary` cell with the helper's `summary` field — that is the
rough arc the user picks by (`<first user msg> → <last user msg>`
for normal sessions, or `(N entries — no user prompts; t-mix: …)`
for tool-only sessions). Do **not** truncate or rewrite `summary` —
markdown table wrap handles long values. Always include an explicit
`abort` row as the last numbered option. Track option-number → `id`
internally so step 5 can call `scripts/chat_history.py read
--session <id>` with the right id.

### 4. Wait for the pick

**One question per turn** (per `ask-when-uncertain`). Do not chain
the listing with anything else; do not auto-pick; do not surface a
default. Wait for the user's response.

If the user picks the abort option, stop without reading.

### 5. Read the picked session silently

Run `scripts/chat_history.py read --session <id> --last <count>`,
where `<count>` is the picked row's `count` from step 2. The
`--last` flag is **required** — the helper defaults to 5 entries,
which would silently truncate any longer session. The helper returns
the entries as JSON.

**Do not render the entries.** The verbose dump was reversed by the
user — token cost and scroll fatigue outweighed the verbatim
contract. Read the JSON in-context, then proceed to step 6.

### 6. Summarise and offer to resume

Emit a **2–5 sentence** summary of the picked session: the topic,
what was decided or built, and where it left off (the last task in
progress, if any). Plain prose — no bullets, no headings, no
verbatim quotes.

Then offer the resume choice as numbered options
(per `user-interaction`), one question per turn:

```
1. resume — pick up the last task from that session
2. stop — keep the summary in context, do nothing else
```

Wait for the pick. Do **not** auto-resume. If the user picks
`resume`, hand off to the relevant skill or command for that work;
do not silently start editing files. The agent does not write to
the current session's log on the user's behalf without an explicit
instruction.

## Gotchas

- **Summary, not verbatim.** Earlier Council R2-2 favoured verbatim
  rendering; reversed in practice — too slow, too token-expensive.
  The agent reads the picked session in-context and emits a 2–5
  sentence summary. Verbatim rendering is no longer part of the
  contract.
- **One pick per invocation.** Multi-pick is v2. If the user wants
  a second session, run `/chat-history import` again.
- **Read-only.** This command never writes to `agents/.agent-chat-history`
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
