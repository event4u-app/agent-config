---
name: chat-history
description: Chat-history orchestrator — routes to show, import, learn
cluster: chat-history
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "show chat-history status, inspect agents/.agent-chat-history log, import a prior session into the current chat, mine a prior session for project-improving learnings"
  trigger_context: "user wants to inspect the persistent agents/.agent-chat-history log, pull a prior session in verbatim, or extract learnings from a prior session"
---

<!-- cloud_safe: noop -->

# /chat-history

Top-level orchestrator for the `/chat-history` family. After the
hook-only reduction (`road-to-chat-history-hook-only`) writes and
overflow handling are driven entirely by platform hooks +
`scripts/chat_history.py` internals; the surfaced sub-commands are
read-only on the log itself. Sessions coexist in one log file —
each entry self-tags via the `s` field — so there is no ownership
layer to recover from.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/chat-history show` | `commands/chat-history/show.md` | Inspect the log — size, entries, header, last entries |
| `/chat-history import` | `commands/chat-history/import.md` | List prior sessions, pick one, render its entries verbatim — selective cross-session import |
| `/chat-history learn` | `commands/chat-history/learn.md` | List prior sessions, pick one, mine it for project-improving learnings via `learning-to-rule-or-skill` |

## Dispatch

1. Parse the user's argument: `/chat-history <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps`
   section verbatim with the remaining args.
4. If the sub-command is unknown or missing (including the bare
   `/chat-history` invocation), route to `show` — the safe,
   current-session inspector default. `import` and `learn` are
   opt-in only.

## Rules

- **Do NOT commit, push, or open a PR** — `show` and `import` are
  read-only; `learn` writes proposal drafts under
  `agents/proposals/` only and does not commit them.
- **Do NOT chain sub-commands.** One `/chat-history <sub>` per turn.
- **`import` and `learn` cross the session boundary** — only run
  them when the user explicitly asked for cross-session reading.
  The default read path (filtered to current session) stays in
  effect for every other tool.
