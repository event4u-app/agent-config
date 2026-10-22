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

This plugin is a **bootstrap shim** kept so the marketplace listing stays
discoverable. Its hooks run only alongside a global npm install of the
package — the staged runtime under `~/.event4u/agent-config/runtime/` or an
`agent-config` binary on `PATH` outside the opened project; a project-local
install is never used. On a plugin-only install no dispatcher is reachable, so
no hook runs and the `fail_closed` guards (`block-no-verify`,
`block-kernel-rule-writes`, `block-plumbing-writes`) are **off**; the session
start says so once. Content (skills, rules, commands, personas) ships as a file projection.

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
