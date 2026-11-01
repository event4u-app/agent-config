---
title: Which install do I get for my AI tool?
description: Agent Config installs four ways depending on the AI tool — a full install into the tool's folder, a plugin, a skill bundle you upload or an export you place yourself.
---

Run `init` and the installer picks the right way for each tool you tick:

```bash
npx -y @event4u/agent-config init --list-tools
```

23 tools are detected and 20 are supported: 18 get their configuration written directly, Copilot gets a plugin and Claude Desktop a bundle; the other 3 are export-only. <!-- claim:host-agent-count -->

| How it installs | Tools | What you do |
|---|---|---|
| [**Full install**](/agent-config/tools/full-install/) | Claude Code, Cursor, Windsurf, Cline, Codex, Gemini CLI, Augment, Roo Code, Kilo Code, Continue, Kiro, Qoder, OpenCode, Trae, Antigravity, CodeBuddy, Droid, Warp | Nothing beyond `init` — files land in the tool's user-level folder. |
| [**Plugin**](/agent-config/tools/plugin/) | GitHub Copilot | A discovery-only plugin (read-only MCP server and an install-pointer skill, no hooks), or exported instructions in a repository. |
| [**Skill bundle**](/agent-config/tools/bundle/) | Claude Desktop | `init` builds ZIPs; you upload them in Claude Desktop. |
| [**Export only**](/agent-config/tools/export-only/) | Aider, Zed, JetBrains AI | `agent-config export` writes a file; you place it and point the tool at it. |

## Can it stop the agent, or only ask?

On **Claude Code** a few checks can refuse an action — for example ending a turn on "done" when nothing was run. On every other tool the rules are instructions the agent is asked to follow: they reduce mistakes but do not remove them. <!-- claim:conformance-advisory-vs-blocking --> [What each tool can block](/agent-config/trust/enforcement-by-host/) has the per-tool detail.

## Everything is global

Every install goes into your home directory, never into a repository:

`agent-config init` installs into your home directory — the package under `~/.event4u/agent-config/` and each AI tool's user-level folder such as `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into your repository, which only gets an `agents/overrides/` folder for your own changes plus a few gitignored bookkeeping files and a block each in `.gitignore` and `.gitattributes`; `agent-config init --project` creates just those in a repository and nothing else.

Using several tools side by side? [Works with agent-switch](/agent-config/works-with-agent-switch/) covers switching between them.
