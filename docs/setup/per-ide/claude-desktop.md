# Claude Desktop — agent-config setup

The fastest path to running our skills, rules, and (optionally) the MCP
server inside Claude Desktop. macOS / Windows / Linux. ~5 minutes.

> **TL;DR** — install the package globally with `--global` so the
> kernel rules and the curated top-N skills land in `~/.claude/`,
> then restart Claude Desktop. The slash-command menu picks them up
> automatically.

## Prerequisites

- Claude Desktop installed (free or paid plan — same install path).
- Node ≥ 18 *or* a clone of the `event4u/agent-config` repo
  (either route can run `--global`).
- 5 minutes.

## Step 1 — global install

Pick whichever entrypoint matches your environment. Both seed the same
files under `~/.claude/`.

```bash
# Node — no clone needed.
npx @event4u/create-agent-config --global --tools=claude-code

# Or via curl (no Node).
curl -fsSL https://raw.githubusercontent.com/event4u/agent-config/main/setup.sh \
  | bash -s -- --global --tools=claude-code

# Or from a local clone.
bash scripts/install --global --tools=claude-code
```

> `--tools=claude-code` covers both Claude Code **and** Claude
> Desktop — the two surfaces share `~/.claude/`. Pass
> `--tools=claude-code,cursor,windsurf` if you want Cursor / Windsurf
> globally seeded in the same run.

After the install you'll have:

```
~/.claude/
├── rules/event4u/      # 9 kernel rules (Iron-Law set)
└── skills/event4u/     # 15 curated top-N skills
```

Curation lives in
[`templates/global-install-manifest.yml`](../../../templates/global-install-manifest.yml).
Edit and re-run `--global` to grow or shrink the set.

## Step 2 — verify

1. Restart Claude Desktop (full quit, not just window close).
2. Open a new conversation.
3. Type `/` — the curated skills (`/work`, `/commit`, `/create-pr`,
   `/quality-fix`, `/review-changes`, `/agent-handoff`,
   `/project-analyze`, …) appear in the slash-command menu.
4. Open Settings → Connectors. The kernel rules count appears under
   "rules loaded".

If the menu is empty:

- Check `ls ~/.claude/skills/event4u/` — should list 15 directories.
- Quit Claude Desktop (`Cmd+Q` on macOS, **not** just close the
  window — the menubar process keeps the old skills cached).
- Re-open and try `/` again.

## Step 3 — optional MCP server

Claude Desktop also speaks MCP. Wiring up the hosted `agent-config-mcp`
Worker exposes the **full** skill / rule / command catalog (~480 items)
on demand, on top of the 15 you installed in Step 1.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows /
Linux is `~/.config/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://agent-config-mcp.event4u.workers.dev"]
    }
  }
}
```

A pre-wired template ships at
[`templates/claude_desktop_config.json.template`](../../../templates/claude_desktop_config.json.template) —
copy + uncomment the MCP block.

Restart Claude Desktop. The 🔌 icon shows the connector under
**Settings → Connectors**. Full transport details (mcp-remote vs.
native HTTP) live in
[`../mcp-client-config.md`](../mcp-client-config.md).

## Claude Desktop ↔ Claude Code config sharing

Both surfaces read **the same `~/.claude/` directory**. Anything you
install for one is automatically available in the other:

| File / dir                       | Shared by Desktop & Code? |
| -------------------------------- | ------------------------- |
| `~/.claude/CLAUDE.md`            | yes — global system prompt |
| `~/.claude/rules/event4u/`       | yes — installed by `--global` |
| `~/.claude/skills/event4u/`      | yes — installed by `--global` |
| `~/.claude/commands/`            | yes — slash commands      |
| `~/.claude/hooks/`               | yes — lifecycle hooks     |
| `claude_desktop_config.json`     | Desktop only (MCP)        |
| `~/.claude.json` (CLI config)    | Code only                 |

Translation: run `--global` once, both clients pick the files up.
Cross-link to [`claude-code.md`](claude-code.md) for the CLI-side
view.

## Claude Cowork

Claude Cowork (paid plans only — Pro / Max / Team) **shares the
Desktop config**. Once Step 1 + Step 3 are done in Desktop:

- Skills and rules under `~/.claude/` are picked up automatically.
- MCP servers under `claude_desktop_config.json` are available
  inside Cowork sessions without a separate install.
- Cowork-specific limit (per Anthropic docs): MCP tools that write to
  the local filesystem are sandboxed — read-only tools (the entire
  hosted `agent-config-mcp` surface) work fine.

If a feature works in Desktop but not in Cowork, check that you're on
a paid plan — Cowork is gated, Desktop's free tier has the full
client-side feature set.

## Uninstall

```bash
bash scripts/install --global --uninstall --tools=claude-code
```

Removes only `~/.claude/{rules,skills}/event4u/`. Anything you added
under sibling paths (custom rules, your own slash commands) stays.

## See also

- Project-local install — [`../../installation.md`](../../installation.md)
- Global install reference — [`../../installation.md#global-user-level-install---global`](../../installation.md#global-user-level-install---global)
- MCP client transports — [`../mcp-client-config.md`](../mcp-client-config.md)
- Curation manifest — [`../../../templates/global-install-manifest.yml`](../../../templates/global-install-manifest.yml)
