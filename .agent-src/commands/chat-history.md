---
name: chat-history
description: Chat-history orchestrator — routes to show
cluster: chat-history
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "show chat-history status, inspect .agent-chat-history log size, entries, fingerprint"
  trigger_context: "user wants to inspect the persistent .agent-chat-history log"
---

<!-- cloud_safe: noop -->

# /chat-history

Top-level orchestrator for the `/chat-history` family. After the
hook-only reduction (`road-to-chat-history-hook-only`) only the
read-only `show` sub-command remains — log writes, adoption, and
overflow handling are now driven entirely by platform hooks +
`scripts/chat_history.py` internals.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/chat-history show` | `commands/chat-history/show.md` | Inspect the log — size, entries, fingerprint, last entries |

For manual recovery (force-adopt a foreign log when auto-adopt
misfires), run `./agent-config chat-history:adopt` directly — it is
not exposed as a `/chat-history` sub-command.

## Dispatch

1. Parse the user's argument: `/chat-history <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps`
   section verbatim with the remaining args.
4. If the sub-command is unknown or missing (including the bare
   `/chat-history` invocation), route to `show` — it is the only
   remaining sub-command and the safe default.

## Rules

- **Do NOT commit, push, or open a PR** — `show` is read-only.
- **Do NOT chain sub-commands.** One `/chat-history <sub>` per turn.
