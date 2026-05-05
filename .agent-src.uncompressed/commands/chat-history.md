---
name: chat-history
description: Chat-history orchestrator — routes to show, learn
cluster: chat-history
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "show chat-history status, inspect .agent-chat-history log, learn from a prior session, import context from past sessions"
  trigger_context: "user wants to inspect the persistent .agent-chat-history log or selectively read a prior session"
---

<!-- cloud_safe: noop -->

# /chat-history

Top-level orchestrator for the `/chat-history` family. After the
hook-only reduction (`road-to-chat-history-hook-only`) writes and
overflow handling are driven entirely by platform hooks +
`scripts/chat_history.py` internals; the surfaced sub-commands are
read-only. Sessions coexist in one log file — each entry self-tags
via the `s` field — so there is no ownership layer to recover from.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/chat-history show` | `commands/chat-history/show.md` | Inspect the log — size, entries, header, last entries |
| `/chat-history learn` | `commands/chat-history/learn.md` | List prior sessions, pick one, render its entries verbatim — selective cross-session import |

## Dispatch

1. Parse the user's argument: `/chat-history <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps`
   section verbatim with the remaining args.
4. If the sub-command is unknown or missing (including the bare
   `/chat-history` invocation), route to `show` — the safe,
   current-session inspector default. `learn` is opt-in only.

## Rules

- **Do NOT commit, push, or open a PR** — both sub-commands are read-only.
- **Do NOT chain sub-commands.** One `/chat-history <sub>` per turn.
- **`learn` crosses the session boundary** — only run it when the
  user explicitly asked for cross-session reading. The default
  read path (filtered to current session) stays in effect for
  every other tool.
