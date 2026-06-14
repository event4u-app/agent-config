---
model_tier: medium
name: chat-history
disable-model-invocation: true
pack: memory
tier: 2
visibility: internal
description: Chat-history orchestrator — routes to import (selective cross-session resume). Mining moved to /memory mine-session; raw-log inspection uses the host's native transcript view.
cluster: chat-history
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "import a prior session into the current chat, resume a previous session, pull a prior session in verbatim"
  trigger_context: "user wants to pull a prior session from the agents/runtime/.agent-chat-history log into the current chat verbatim and optionally resume it"
workspaces:
  - agent-config-maintainer
packs:
  - memory
---

<!-- cloud_safe: noop -->

# /chat-history

Top-level orchestrator for the `/chat-history` family. Writes and overflow
handling are driven entirely by platform hooks + `scripts/chat_history.py`
internals (`road-to-chat-history-hook-only`); the surfaced sub-command is
read-only on the cross-host log (`agents/runtime/.agent-chat-history`).
Sessions coexist in one log file — each entry self-tags via the `s` field —
so there is no ownership layer to recover from.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/chat-history import` | `commands/chat-history/import.md` | List prior sessions, pick one, render its entries verbatim — selective cross-session import + resume |

**Consolidated elsewhere** (see `road-to-memory-pipeline-consolidation.md`):

- **Mining a session for learnings** — use
  [`/memory mine-session --mode=proposals`](../memory/mine-session/command.md)
  (the former `/chat-history learn`; now the single mining command, reading the
  same cross-host log).
- **Inspecting the raw log** (size, entries, header) — use the host's native
  transcript / session view; the bespoke `/chat-history show` was dropped as
  redundant.

## Dispatch

1. Parse the user's argument: `/chat-history <sub-command> [args]`.
2. The only sub-command is `import`. Bare `/chat-history` (or an unknown
   sub-command) → route to `import`.
3. Load `commands/chat-history/import.md` and follow its `## Steps` verbatim
   with the remaining args.

## Rules

- **Do NOT commit, push, or open a PR** — `import` is read-only (it renders a
  prior session into the current chat; it writes nothing).
- **Do NOT chain sub-commands.** One `/chat-history import` per turn.
- **`import` crosses the session boundary** — only run it when the user
  explicitly asked for cross-session reading.
