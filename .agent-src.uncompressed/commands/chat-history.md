---
name: chat-history
description: Chat-history orchestrator — routes to show, resume, clear, checkpoint
cluster: chat-history
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "show chat-history status, resume from log, clear the chat-history file, append a checkpoint entry"
  trigger_context: "user wants to inspect, restore, wipe, or manually flush .agent-chat-history"
---

<!-- cloud_safe: noop -->

# /chat-history

Top-level orchestrator for the `/chat-history` family. Replaces 4
standalone commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/chat-history show` | `chat-history-show.md` | Inspect the log — size, entries, fingerprint, last entries |
| `/chat-history resume` | `chat-history-resume.md` | Adopt and load the persistent log into the current conversation |
| `/chat-history clear` | `chat-history-clear.md` | Wipe the log (with optional archival backup) |
| `/chat-history checkpoint` | `chat-history-checkpoint.md` | Append a phase-boundary entry on CHECKPOINT-class platforms |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/chat-history <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions`
   (or `## Steps`) section verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and
   ask:

   > 1. show — inspect status, size, last entries
   > 2. resume — adopt the log into the conversation
   > 3. clear — wipe the file
   > 4. checkpoint — append a phase-boundary entry

## Migration

The 4 standalone commands (`/chat-history-show`, `/chat-history-resume`,
`/chat-history-clear`, `/chat-history-checkpoint`) continue to work for
one release cycle as deprecation shims. New invocations should use
`/chat-history <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it.
- **Do NOT chain sub-commands.** One `/chat-history <sub>` per turn.
- If the user invokes `/chat-history` with no argument, **show the
  menu** — do not guess which sub-command they meant.
