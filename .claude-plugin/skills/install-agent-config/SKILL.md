---
name: install-agent-config
description: >-
  Install or upgrade the event4u agent-config suite. This marketplace plugin
  is a bootstrap shim — it ships hooks plus this pointer only; ALL skills,
  rules, and commands are installed via `npx -y @event4u/agent-config init`.
  Use when the user asks to install, set up, or upgrade agent-config, or
  wonders why this plugin contains no other skills.
---

# Install agent-config

This plugin is a **bootstrap shim**. It exists so the marketplace listing
stays discoverable and existing plugin installs keep working hooks — the
content surface (skills, rules, commands, personas) is distributed as a
file projection, not through this plugin.

## Install (canonical, one command)

```bash
npx -y @event4u/agent-config init
```

The installer writes the full content projection, registers the dispatcher
hooks as a managed block in `~/.claude/settings.json` (byte-identical to
this plugin's hooks, so nothing double-fires), and keeps everything
upgradeable via `agent-config upgrade`.

## Already installed both?

Run `agent-config doctor` to check for duplicate surfaces, and
`agent-config converge` to clean up consented duplicates.
