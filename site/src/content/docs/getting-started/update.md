---
title: Update
description: Update Agent Config to the latest release with one command, check what changed first, and keep your settings file in step.
---

One command installs the latest release and refreshes every AI tool you installed for:

```bash
npx -y @event4u/agent-config upgrade
```

`upgrade` installs the newest package globally, re-runs the install for your tools and adds any new settings keys to your settings file, keeping your own lines as they are. Start a new session in your AI tool afterwards so it reads the new files.

## Check first

```bash
agent-config upgrade --check     # installed vs latest; installs nothing
agent-config upgrade --dry-run   # print the exact steps; run none
agent-config versions            # published versions and the one you run
```

Once a day, after a command finishes, the CLI prints a short notice when a newer release exists. It is silent in CI, without a terminal, or with `AGENT_CONFIG_NO_UPDATE_CHECK=1`. [What leaves your machine](/agent-config/trust/network/) has the details.

## Re-apply without changing version

```bash
agent-config refresh --global
```

Use it when a tool's folder was changed by hand or another tool overwrote a file. `agent-config doctor` tells you when you need it.

## Pin a version for a project

```bash
agent-config update --to 19.1.0
```

`update` writes the version into the project's settings file, so everyone on the project runs the same release; when your global install is older it upgrades first. Without `--to` it pins the latest.

## Settings keys

```bash
agent-config settings:sync                   # add keys new releases introduced
agent-config settings:sync --prune-removed   # also drop keys a release retired
```

## Next

- [Uninstall](/agent-config/getting-started/uninstall/)
- [CLI reference](/agent-config/reference/cli/)
