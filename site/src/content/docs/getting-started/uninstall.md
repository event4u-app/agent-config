---
title: Uninstall
description: Remove Agent Config cleanly — uninstall takes out only its own entries, leaves other tools' config untouched, and --purge deletes only the files it recorded writing.
---

One command removes Agent Config from every AI tool it installed for:

```bash
npx -y @event4u/agent-config uninstall --global
```

It removes only its own keys from a shared tool config and leaves a neighbour's entries byte-identical. <!-- claim:surgical-uninstall -->

## Preview first

```bash
agent-config uninstall --global --dry-run
```

Prints every file and key it would remove, and removes nothing.

## Also delete the installed files

By default the skills, rules and commands it copied into each tool's folder stay, so nothing you rely on disappears mid-session. Add `--purge` to delete them too:

```bash
agent-config uninstall --global --purge
```

`--purge` deletes only the files the install recorded writing — never the tool's folder itself. A file it did not write stays byte-identical, a recorded file you edited since is kept and counted, and with no record of what was installed it refuses and deletes nothing. <!-- claim:uninstall-purge-inventory-bounded -->

## Only some tools

```bash
agent-config uninstall --global --tools=cursor,windsurf
```

## The repository folder

A repository only holds an `agents/overrides/` folder for your own changes plus a few gitignored bookkeeping files. To remove the per-tool bookkeeping files, run uninstall without `--global` inside the repository (or point `--project` at it):

```bash
agent-config uninstall
agent-config uninstall --project ~/code/my-app
```

`agents/overrides/` holds your own work, so it is never deleted for you — remove it yourself if you no longer want it.

## Everything else

- Your settings live in `~/.event4u/agent-config/`. Delete that folder after uninstalling to remove them too.
- If `upgrade` installed the package globally, remove the binary with `npm uninstall -g @event4u/agent-config`.
- GitHub Copilot: remove the `agent-config` plugin with Copilot's own plugin command. Claude Desktop: switch the uploaded skills off under **Settings → Customize → Skills** and delete them there.

## Next

- [Install](/agent-config/getting-started/installation/) — if you want it back.
