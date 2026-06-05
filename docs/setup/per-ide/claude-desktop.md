# Claude Desktop — agent-config setup

The fastest path to running our skills, rules, and (optionally) the MCP
server inside Claude Desktop. macOS / Windows / Linux. ~10 minutes.

> **TL;DR** — Claude Desktop does **not** auto-discover skills from any
> filesystem path. It loads skills only after they are uploaded through
> **Settings → Customize → Skills → Upload**. The package generates one
> ZIP per skill under
> `~/.event4u/agent-config/claude-desktop/bundles/` so you can drag /
> drop them into the Customize panel. The v1 npm / composer install
> scheme is retired; the current global-only scheme follows ADR-007 +
> [ADR-020](../../decisions/ADR-020-global-only-consumer-scope.md) and
> writes through `~/.event4u/agent-config/installed.lock` (legacy
> `~/.config/agent-config/installed.lock` read as fallback).

## Prerequisites

- Claude Desktop installed (free or paid plan — same install path).
- Node ≥ 18 (`npx` resolves the package per-project).
- 10 minutes (most of it is clicking through the Customize panel once).

## Step 1 — generate the ZIP bundles

Run once per user. Writes the per-skill ZIPs into the namespace dir:

```bash
npx @event4u/agent-config init --tools=claude-desktop --global
```

The init writes:

```
~/.event4u/agent-config/
├── claude-desktop/
│   ├── bundles/          # one <skill-name>.zip per .claude/skills/* folder
│   └── claude-desktop.md # human-readable marker with the import flow
├── agent-settings.yml
├── installed.lock
└── installed-tools.yml
```

Re-running is safe: each ZIP carries a SHA-256 sidecar. Bundles whose
content didn't change are skipped (idempotent).

## Step 1b — import skills into Customize

Claude Desktop does not read the bundle dir directly — you upload each
ZIP through the **Customize** panel.

1. Open Claude Desktop → **Settings** (`Cmd+,` on macOS).
2. Pick **Customize** in the left sidebar, then the **Skills** tab.
3. Click **Upload** (the button shown next to the search box).
4. Navigate to `~/.event4u/agent-config/claude-desktop/bundles/` and
   either:
   - drag-drop the ZIPs you want into the upload zone, or
   - select multiple ZIPs in the file picker (`Cmd-click` on macOS,
     `Ctrl-click` on Windows / Linux) and confirm.
5. The skills appear in the Customize list. Toggle each one **On**
   (the toggle is the gate Claude Desktop uses at runtime, not the
   upload itself).

> The bundles dir prints in the install summary so you can paste-copy
> it into Finder / Explorer. The marker file at the same path
> (`claude-desktop.md`) repeats the click-through instructions.

## Step 2 — verify

1. Restart Claude Desktop (full quit, not just window close — `Cmd+Q`
   on macOS).
2. Open a new conversation.
3. Type `/` — the uploaded skills appear in the slash-command menu.
4. **Settings → Customize → Skills** should list every skill you
   uploaded, each with its **On** toggle live.

If a skill is missing from `/`:

- Confirm the **On** toggle is enabled in Customize → Skills.
- Re-upload that specific ZIP — partial uploads can show up listed but
  disabled.
- Quit Claude Desktop fully (the menubar process on macOS caches old
  skill state). Re-open and re-check.

## Step 2b — optional: project-local install for Claude Code

If you also use **Claude Code** in the same project, install the
project-local config in the same run:

```bash
npx @event4u/agent-config init --tools=claude-code
```

Claude Code reads `.claude/` directly from the project — no upload
step required. Pass `--tools=claude-code,claude-desktop,cursor,…` to
seed multiple surfaces with one invocation.

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
[`src/templates/claude_desktop_config.json.template`](../../../templates/claude_desktop_config.json.template) —
copy, swap the placeholder URL for your deploy, and uncomment the MCP
block.

Restart Claude Desktop. The 🔌 icon shows the connector under
**Settings → Connectors**. Full transport details (mcp-remote vs.
native HTTP) and per-client Bearer-auth snippets live in
[`../mcp-client-config.md`](../mcp-client-config.md).

## Claude Desktop ↔ Claude Code — what is shared, what is not

Claude Code reads `.claude/` directly from the project. Claude Desktop
does **not** auto-discover from any filesystem path — skills must be
uploaded through Customize → Skills (Step 1b). MCP configuration is
shared via `claude_desktop_config.json`.

| Surface                          | Loaded by Desktop?           | Loaded by Code?            |
| -------------------------------- | ---------------------------- | -------------------------- |
| `<project>/.claude/CLAUDE.md`    | no                           | yes — project system prompt |
| `<project>/.claude/rules/`       | no                           | yes — written by `npx … init` |
| `<project>/.claude/skills/`      | no (upload via Customize)    | yes — written by `npx … init` |
| `<project>/.claude/commands/`    | no                           | yes — slash commands       |
| `<project>/.claude/hooks/`       | no                           | yes — lifecycle hooks      |
| `~/.event4u/agent-config/claude-desktop/bundles/*.zip` | imported via Customize → Skills | not used                  |
| `claude_desktop_config.json`     | yes — MCP servers            | no                          |
| `~/.claude.json` (CLI config)    | no                           | yes — CLI session state    |

Translation: run `npx @event4u/agent-config init --tools=claude-desktop
--global` once per user to refresh the bundles, then re-upload through
Customize → Skills whenever a bundle is rebuilt. Run
`npx @event4u/agent-config init --tools=claude-code` per project for
the Code-side files. Cross-link to [`claude-code.md`](claude-code.md)
for the CLI-side view.

## Claude Cowork

Claude Cowork (paid plans only — Pro / Max / Team) **inherits the
Desktop session**. Once Steps 1 + 1b + 3 are done in Desktop:

- Uploaded skills from Customize are available inside Cowork.
- MCP servers under `claude_desktop_config.json` are available inside
  Cowork sessions without a separate install.
- Cowork-specific limit (per Anthropic docs): MCP tools that write to
  the local filesystem are sandboxed — read-only tools (the entire
  `agent-config-mcp` Worker surface) work fine.

If a feature works in Desktop but not in Cowork, check that you're on
a paid plan — Cowork is gated, Desktop's free tier has the full
client-side feature set.

## Uninstall

1. Open Claude Desktop → Settings → Customize → Skills, toggle off and
   delete each skill you uploaded.
2. Delete `~/.event4u/agent-config/claude-desktop/` to remove the local
   bundles. The legacy `~/.config/agent-config/` path can stay; the
   loader treats it as read-only fallback.
3. Run `npx @event4u/agent-config uninstall --tools=claude-desktop` to
   refresh `installed.lock` (or `--all` to fully remove the user-scope
   state).

## See also

- Project-local install — [`../../installation.md`](../../installation.md)
- MCP client transports — [`../mcp-client-config.md`](../mcp-client-config.md)
