# Claude Desktop — agent-config setup

The fastest path to running our skills, rules, and (optionally) the MCP
server inside Claude Desktop. macOS / Windows / Linux. ~5 minutes.

> **TL;DR** — Claude Desktop reads from `~/.claude/` (global only, no
> project-local discovery on macOS). Run `npx @event4u/agent-config
> global --tools=claude-desktop` once per user, or
> `npx @event4u/agent-config init --tools=claude-code` per project
> (Claude Code's project install also covers Desktop on macOS via the
> shared `~/.claude/` location seeded during `init`). The v1 npm /
> composer install scheme is retired; the new global-first scheme is
> ADR-007 and writes through `~/.config/agent-config/installed.lock`.

## Prerequisites

- Claude Desktop installed (free or paid plan — same install path).
- Node ≥ 18 (`npx` resolves the package per-project).
- 5 minutes.

## Step 1 — project-local install

Run inside each project that should be visible to Claude Desktop:

```bash
npx @event4u/agent-config init --tools=claude-code
```

> `--tools=claude-code` covers both Claude Code **and** Claude
> Desktop — the two surfaces share the project's `.claude/`
> directory. Pass `--tools=claude-code,cursor,windsurf` to seed
> additional surfaces in the same run.

The init writes:

```
.claude/
├── rules/      # active rules for the project
├── skills/     # active skills for the project
└── commands/   # slash commands
```

`.agent-settings.yml` carries the `agent_config_version` pin so every
`npx` invocation resolves the same runtime.

## Step 2 — verify

1. Restart Claude Desktop (full quit, not just window close).
2. Open the project folder in a new conversation.
3. Type `/` — the curated skills (`/work`, `/commit`, `/create-pr`,
   `/quality-fix`, `/review-changes`, `/agent-handoff`,
   `/project-analyze`, …) appear in the slash-command menu.
4. Open Settings → Connectors. The kernel rules count appears under
   "rules loaded".

If the menu is empty:

- Check `ls .claude/skills/` inside the project — should list the
  curated skills.
- Quit Claude Desktop (`Cmd+Q` on macOS, **not** just close the
  window — the menubar process keeps the old skills cached).
- Re-open and try `/` again.

## Step 3 — optional MCP server

Claude Desktop also speaks MCP. Wiring up your own self-hosted
`agent-config-mcp` Cloudflare Worker exposes the **full** skill / rule /
command catalog (~480 items) on demand, on top of the 15 you installed
in Step 1.

Deploy the Worker first per [`../mcp-cloud-setup.md`](../mcp-cloud-setup.md) — your
URL will be `https://agent-config-mcp.<your-account>.workers.dev`
(or a custom domain you wire up in Step 7). Replace
`https://your-worker.workers.dev` below with that URL.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows /
Linux is `~/.config/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-worker.workers.dev"]
    }
  }
}
```

If you set the `MCP-Token` secret on the Worker (recommended — see
[`../mcp-cloud-setup.md`](../mcp-cloud-setup.md) § Bearer auth), add the header:

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://your-worker.workers.dev",
        "--header", "Authorization: Bearer ${MCP_TOKEN}"
      ],
      "env": { "MCP_TOKEN": "paste-token-here" }
    }
  }
}
```

A pre-wired template ships at
[`templates/claude_desktop_config.json.template`](../../../templates/claude_desktop_config.json.template) —
copy, swap the placeholder URL for your deploy, and uncomment the MCP
block.

Restart Claude Desktop. The 🔌 icon shows the connector under
**Settings → Connectors**. Full transport details (mcp-remote vs.
native HTTP) and per-client Bearer-auth snippets live in
[`../mcp-client-config.md`](../mcp-client-config.md).

## Claude Desktop ↔ Claude Code config sharing

Both surfaces read **the same project `.claude/` directory**. Anything
the `npx … init` writes for one is automatically picked up by the
other when the project folder is opened:

| File / dir                       | Shared by Desktop & Code? |
| -------------------------------- | ------------------------- |
| `<project>/.claude/CLAUDE.md`    | yes — project system prompt |
| `<project>/.claude/rules/`       | yes — written by `npx … init` |
| `<project>/.claude/skills/`      | yes — written by `npx … init` |
| `<project>/.claude/commands/`    | yes — slash commands      |
| `<project>/.claude/hooks/`       | yes — lifecycle hooks     |
| `claude_desktop_config.json`     | Desktop only (MCP)        |
| `~/.claude.json` (CLI config)    | Code only                 |

Translation: run `npx @event4u/agent-config init` once per project,
both clients pick the files up. Cross-link to
[`claude-code.md`](claude-code.md) for the CLI-side view.

## Claude Cowork

Claude Cowork (paid plans only — Pro / Max / Team) **shares the
Desktop config**. Once Step 1 + Step 3 are done in Desktop:

- Skills and rules under `~/.claude/` are picked up automatically.
- MCP servers under `claude_desktop_config.json` are available
  inside Cowork sessions without a separate install.
- Cowork-specific limit (per Anthropic docs): MCP tools that write to
  the local filesystem are sandboxed — read-only tools (the entire
  `agent-config-mcp` Worker surface) work fine.

If a feature works in Desktop but not in Cowork, check that you're on
a paid plan — Cowork is gated, Desktop's free tier has the full
client-side feature set.

## Uninstall

Remove the project's `.claude/`, `.agent-settings.yml`, and any bridge
files written by `npx … init`. Nothing lives under `~/.claude/` from
this package any more.

## See also

- Project-local install — [`../../installation.md`](../../installation.md)
- MCP client transports — [`../mcp-client-config.md`](../mcp-client-config.md)
