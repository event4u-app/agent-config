---
title: CLI Overview
description: The terminal CLI surface — the agent-config binary and the Taskfile — and how it differs from in-agent slash-commands.
---

> **Two command surfaces, don't confuse them.** This section covers the
> **terminal CLI**: the `agent-config` binary and `task` runner a *human* runs
> in a shell. The [`/slash` commands](/agent-config/agent-commands/overview/) an
> *AI agent* invokes in-chat are a separate surface — they are **not** run via
> the Taskfile.

## The `agent-config` binary

Two entrypoints resolve to the same command surface:

| Who | How | Mechanism |
|---|---|---|
| **Consumers** | `npx @event4u/agent-config <cmd>` or global `agent-config <cmd>` | `package.json` `bin` → the bundled CLI |
| **Maintainers** (source checkout) | `./agent-config <cmd>` | root shim → bundled CLI, falling back to the Bash dispatcher |

Internally the CLI parses a small **native** set directly and **delegates** the
rest to a Bash dispatcher — an implementation detail; every subcommand is listed
in
[`src/cli/registry.ts`](https://github.com/event4u-app/agent-config/blob/main/src/cli/registry.ts).

```bash
npx @event4u/agent-config init        # install / open the wizard
npx @event4u/agent-config doctor      # read-only drift report
npx @event4u/agent-config validate    # CI drift gate
```

## The Taskfile

Maintainers working in the repo use [go-task](https://taskfile.dev):

```bash
task ci              # run the full local CI chain
task sync            # regenerate dist/agent-src/ + .augment/
task generate-tools  # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md
```

`Taskfile.yml` pulls grouped taskfiles from `taskfiles/*.yml` into a flat
namespace, so every task is `task <name>` with no prefix.

## Next

- [agent-config Reference](/agent-config/cli/agent-config-reference/) — the binary's subcommands.
- [Taskfile Reference](/agent-config/cli/taskfile-reference/) — the maintainer task battery.
