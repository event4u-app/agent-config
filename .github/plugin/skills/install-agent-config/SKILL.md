---
name: install-agent-config
description: >-
  Governance rules, skills and commands for AI coding agents in Claude Code, Cursor, GitHub Copilot and Gemini CLI —
  install or upgrade the full event4u agent-config suite. No plugin that ships this pointer is the full suite (the Claude
  Code one adds hooks, the Copilot one a read-only MCP server); ALL content installs via `npx -y @event4u/agent-config init`.
  Use when the user asks to install, set up, or upgrade agent-config, wants coding-agent rules or skills, or
  wonders why this plugin contains no other skills.
---

# Install agent-config

The plugin that delivered this skill is a **discovery entry**, not the suite. The Claude Code plugin adds hooks that
run only alongside a global npm install of the package (never a project-local one) — on a plugin-only install no hook
runs, so the `fail_closed` guards (`block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`) are
**off**; the session start says so once. The Copilot plugin adds a read-only MCP server and no hooks.

## Install (canonical, one command)

```bash
npx -y @event4u/agent-config init
```

The installer writes the full content projection, registers the dispatcher
hooks as a managed block in `~/.claude/settings.json` (byte-identical to
the Claude Code plugin's hooks, so nothing double-fires), and keeps everything
upgradeable via `agent-config upgrade`.

## Already installed both?

Run `agent-config doctor` to check for duplicate surfaces, and
`agent-config converge` to clean up consented duplicates.
