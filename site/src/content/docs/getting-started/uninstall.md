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

With a global install, a repository holds at most an `agents/overrides/` folder for your own changes, plus what `agent-config init --project` added: a block in `.gitignore`, a block in `.gitattributes` and a gitignored `./agent-config` wrapper. There is nothing to uninstall there: `agent-config uninstall` without `--global` is only for a repository with its own install (an `agents/installed-tools.lock`). Run it in any other repository and it exits 1 with `no project lockfile` and changes nothing.

For a repository with its own install, run it inside the repository (or point `--project` at it):

```bash
agent-config uninstall
agent-config uninstall --project ~/code/my-app
```

Never deleted for you, because they are yours or may be:

- `agents/overrides/` — your own changes.
- `agents/map/` — the [code map](/agent-config/features/code-map/), drawn here when the repository already has an `agents/` folder.
- The `# event4u/agent-config` blocks in `.gitignore` and `.gitattributes`.

Remove them yourself if you no longer want them.

## Everything else

- Your settings, the install records, the code maps of repositories without an `agents/` folder and the cached `doctor` scans live in `~/.event4u/agent-config/`. Delete that folder after uninstalling to remove them too, and `~/.event4u/` if it is then empty.
- The install creates `~/.claude/settings.json` when it did not exist. Uninstall removes its own keys, so the file can remain as `{}`, and a tool folder the install created (`~/.claude/`, `~/.cursor/`, …) stays, empty. Delete them if you do not use those tools.
- `doctor` asks each AI tool's CLI it finds for its version. Some of them leave their own temporary files, for example under `~/.codex/tmp/` or `~/.gemini/`.
- If `upgrade` installed the package globally, remove the binary with `npm uninstall -g @event4u/agent-config`.
- GitHub Copilot: remove the `agent-config` plugin with Copilot's own plugin command. Claude Desktop: switch the uploaded skills off under **Settings → Customize → Skills** and delete them there.

## Next

- [Install](/agent-config/getting-started/installation/) — if you want it back.
