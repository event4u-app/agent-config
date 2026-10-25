# agent-config status (Claude Code mod)

A read-only Claude Code hooks module shipped with `@event4u/agent-config`. After
every turn it reads `agents/runtime/state/context-fill.json`, which agent-config
already writes at each stop, and shows how full the context is relative to the
recycle threshold in the status line. It decides nothing, blocks nothing,
rewrites nothing and calls no model, process or network.

It is opt-in. Nothing registers it for you.

## Install

```bash
claude plugin marketplace add ~/.event4u/agent-config/runtime/current/src/templates/claude-mod
```

Then, at a Claude Code prompt: `/plugin install agent-config-status@agent-config-local`.

## What it can and cannot do

- Hooks one event (`turn.complete`) and calls only `$.fs.exists`, `$.fs.read` and
  `$.ui.status`. A CI test holds it to that set.
- Reads relative to the session's working directory: a session started below the
  project root shows nothing. Silence is the failure, never a wrong number.
- Everything it shows is also available without mods: the same file, and the
  `context fill` line of `agent-config doctor neighbours`.

The class it belongs to is recorded in ADR-302 of the agent-config repository.
