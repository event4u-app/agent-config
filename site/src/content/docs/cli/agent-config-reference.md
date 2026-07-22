---
title: agent-config Reference
description: The agent-config binary subcommands, grouped by cluster. The registry is the exhaustive source.
---

A curated view of the `agent-config <cmd>` surface, grouped by purpose. The
exhaustive, authoritative list is
[`src/cli/registry.ts`](https://github.com/event4u-app/agent-config/blob/main/src/cli/registry.ts).

## Install & lifecycle

| Command | Purpose |
|---|---|
| `init` | One-shot install (opens the wizard); `--project` for the project surface |
| `setup` | Open the onboarding wizard |
| `install` | Open the install wizard |
| `sync` | Replay the installed-tools lockfile |
| `update` / `upgrade` | Update the version pin / update global install to latest |
| `use` | Switch active experience profile |
| `uninstall` / `prune` | Remove bridge markers / lockfile entries |

## Diagnostics & conformance

| Command | Purpose |
|---|---|
| `doctor` | Read-only drift report: manifest ↔ filesystem |
| `validate` | Drift detection (CI gate) |
| `conformance` | Consumer conformance (installed *and* firing) |
| `explain` | Read-only decision-chain trace (`config` / `rule <name>` / `route "<text>"`) |
| `benchmark` | Report context-token reduction vs a full always-loaded projection |

## Settings

| Command | Purpose |
|---|---|
| `config` / `settings` | Open the settings GUI (global; `--project` for project) |
| `settings:check` | Validate `.agent-settings.yml` (read-only) |
| `settings:sync` | Additively merge new template keys |

## Discovery

| Command | Purpose |
|---|---|
| `workspaces` / `packs` / `commands` | List the discovery manifest surface |
| `affected` / `graph-explain` | Explore the artefact relation-graph |

## Roadmap

| Command | Purpose |
|---|---|
| `roadmap:progress` | Regenerate the roadmap dashboard |
| `roadmap:progress-check` | Fail if the dashboard is stale (CI) |
| `roadmap:archive` | Archive completed roadmaps |

## MCP

| Command | Purpose |
|---|---|
| `mcp:render` / `mcp:check` | Render / verify per-tool MCP client configs |
| `mcp-server` | Turnkey read-only stdio MCP server over bundled content |

## Memory & telemetry

| Command | Purpose |
|---|---|
| `memory:lookup` / `memory:signal` / `memory:check` | Retrieve / append / validate memory entries |
| `telemetry:record` / `telemetry:status` / `telemetry:report` | Artefact-engagement telemetry (default-off) |

## AI council

| Command | Purpose |
|---|---|
| `council:estimate` | Pre-call cost preview (no spend) |
| `council:run` | Run the council (requires `--confirm` to spend) |
| `keys:install-anthropic` / `keys:install-openai` | Install provider keys |

## Work

| Command | Purpose |
|---|---|
| `work` | Drive the work engine on a free-form prompt |
| `implement-ticket` | Drive the work engine from a ticket |

> `cost:*` (session cost tracking) are **Taskfile** tasks, not binary
> subcommands — see the [Taskfile Reference](/agent-config/cli/taskfile-reference/).
