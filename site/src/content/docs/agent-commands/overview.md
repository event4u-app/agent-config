---
title: Agent Commands Overview
description: The in-agent /slash-command surface — how ~190 commands are namespaced and orchestrated, distinct from the terminal CLI.
---

> **In-agent commands, not terminal commands.** These are the `/slash` commands
> an *AI agent* invokes in-chat (e.g. `/create-pr`, `/roadmap:process-full`).
> They are **not** run via the Taskfile or the `agent-config` binary — that is
> the separate [terminal CLI](/agent-config/cli/overview/) surface.

agent-config ships **190** agent commands — workflow orchestrators that compose
skills and governance gates into a repeatable flow.

## Namespacing

Commands use a `cluster:name` form at the slash surface, mapping to the
directory tree:

```text
/council:default        → commands/council/default.md
/roadmap:process-full   → commands/roadmap/process-full.md
/agents:user:accept     → commands/agents/user/accept.md
```

Each cluster is fronted by a top-level **orchestrator** (`type: orchestrator`,
`routes_to: […]`) — invoking the bare `/council` routes to a subcommand or shows
a menu. Standalone commands (no cluster) sit at the top level: `/work`,
`/implement-ticket`, `/agent-handoff`, `/mode`, `/orchestrate`, `/condense`, …

## Source & catalog

- Authored source: `src/agent-src/commands/`; shipped projection:
  [`dist/agent-src/commands/`](https://github.com/event4u-app/agent-config/tree/main/dist/agent-src/commands).
- Authoritative index of all 190:
  [`docs/catalog.md`](https://github.com/event4u-app/agent-config/blob/main/docs/catalog.md)
  (also mirrored on the [Catalog](/agent-config/catalog/) page).

## Next

- [Command Clusters](/agent-commands/clusters/) — the clusters at a glance.
- [Key Commands](/agent-commands/key-commands/) — the ones you'll reach for.
