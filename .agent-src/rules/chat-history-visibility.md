---
type: "always"
description: "Heartbeat marker visibility for .agent-chat-history — paste subprocess stdout verbatim or nothing, never type from memory, hybrid mode prints only on drift, slip handling per language-and-tone"
alwaysApply: true
source: package
---

<!-- cloud_safe: noop -->

# Chat History — Visibility

Owns gate 3 of the chat-history Iron Law: the heartbeat marker that
makes append-cadence drift visible. Ownership (gate 1) lives in
[`chat-history-ownership`](chat-history-ownership.md); cadence (gate 2)
lives in [`chat-history-cadence`](chat-history-cadence.md). File I/O is
owned by [`scripts/chat_history.py`](../../../scripts/chat_history.py).

## Iron Law — gate 3 (heartbeat is subprocess stdout, not memory)

```
HEARTBEAT IS THE SCRIPT OUTPUT OF THE CURRENT TURN, VERBATIM, OR NOTHING.
NEVER TYPE THE LINE FROM MEMORY. NEVER REUSE THE PRIOR TURN'S MARKER.
EMPTY STDOUT → NO MARKER LINE.
```

Run silently before emitting the final reply:

```bash
scripts/chat_history.py heartbeat --first-user-msg "<first-user-msg>"
```

Stdout is **at most** one line, e.g.
`📒 chat-history: ok · 9 entries · per_phase · last 30s ago`. Non-empty →
paste **verbatim** as the last line of the reply. Empty → emit nothing.
Always exits 0 — observability, not a gate.

## Visibility modes — `chat_history.heartbeat`

| Mode | When marker prints | Token cost |
|---|---|---|
| `on` | every reply (legacy) | ~20 tokens / reply |
| `off` | never — full silence | 0 |
| `hybrid` *(default)* | drift states only (`missing`/`foreign`/`returning`) | 0 in normal flow, ~20 on drift |

`hybrid` ships zero tokens when healthy, loud on ownership drift. YAML 1.1
booleanizes bare `on`/`off`; the reader coerces both back, so
`heartbeat: on` works unquoted.

## Memory-typing the marker — rule violation, not a slip

Format is memorizable; counts and timestamps are not. A typed-from-
memory line shows stale entries and a healthy-looking `ok` while the
file is silently behind — observability collapses, invisible until
`status` is checked. Heartbeat is the script output of the **current
turn**, verbatim, or nothing.

**Self-check before send — MANDATORY.** (1) Did `heartbeat` run on
this turn? (2) Is the line byte-identical to that subprocess stdout?
(3) Empty stdout → no marker line. Any "no" → drop it.

**Slip handling.** Stale marker called out → acknowledge once in the
user's language; run `status`; on CHECKPOINT call `append` for
missed phase-boundaries (see [`chat-history-cadence`](chat-history-cadence.md));
run a real `heartbeat`; paste stdout verbatim or nothing. Don't promise
"from now on" — only behaviour proves compliance (mirrors
`language-and-tone` § slip handling).

## Path-specific behavior

Heartbeat (gate 3) stays useful for visibility on **every** path —
HOOK, ENGINE, CHECKPOINT — because the marker reports the file's
state, not the agent's intent. On HOOK and ENGINE paths the agent
still emits the marker even though it didn't fire `turn-check` or
`append` itself: the marker is read-only observability over whatever
the platform / engine wrote.

## What this rule does NOT do

Manage ownership decisions — those live in [`chat-history-ownership`](chat-history-ownership.md).
Manage append timing — that lives in [`chat-history-cadence`](chat-history-cadence.md).
Auto-decide visibility mode — `chat_history.heartbeat` is the only
trigger. Insert decoration: the marker is functional output per
[`direct-answers`](direct-answers.md) emoji whitelist, not a status
badge.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) heartbeat is **inert** —
no marker line, no `scripts/`. Treat `chat_history.enabled` as `false`.

## Interactions & references

- Sibling rules: [`chat-history-ownership`](chat-history-ownership.md) (gate 1 — turn-check) · [`chat-history-cadence`](chat-history-cadence.md) (gate 2 — append).
- `direct-answers` — emoji whitelist permits the `📒` marker as functional output, not decoration.
- `language-and-tone` § slip handling — stale-marker acknowledgement.
- API: [`scripts/chat_history.py`](../../../scripts/chat_history.py) `heartbeat` and `status` subcommands. Settings: [`agent-settings`](../templates/agent-settings.md) `chat_history.heartbeat`.
