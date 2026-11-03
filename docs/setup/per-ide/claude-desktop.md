# Claude Desktop Setup

Claude Desktop (macOS / Windows / Linux) does **not** discover skills from
any filesystem path. It loads skills only after you upload them through
**Settings → Customize → Skills**. The installer therefore builds one ZIP
per skill and per command for you to upload.

> `agent-config init` installs into your home directory — the package under
> `~/.event4u/agent-config/` and each AI tool's user-level folder such as
> `~/.claude/` or `~/.cursor/` — and writes no skills, rules or commands into
> your repository, which only gets an `agents/overrides/` folder for your own
> changes plus a few gitignored bookkeeping files and a block each in
> `.gitignore` and `.gitattributes`; `agent-config init --project` creates just
> those in a repository and nothing else.

## Prerequisites

- Claude Desktop installed (free or paid plan — same install path).
- Node.js ≥ 22.6 (for the `npx` entrypoint).

## Step 1 — build the ZIP bundles

```bash
npx @event4u/agent-config init --tools=claude-desktop
```

This writes:

- `~/.event4u/agent-config/claude-desktop/bundles/` — one ZIP per skill and
  per command
- `~/Library/Application Support/Claude/agent-config.md` — a marker that
  names the bundles folder and repeats the upload steps

Re-running is safe: only bundles whose content changed are rewritten. The
install summary prints the bundles folder so you can paste it into Finder
or Explorer.

## Step 1b — upload the bundles

1. Open Claude Desktop → **Settings** (`Cmd+,` on macOS).
2. Pick **Customize** in the left sidebar, then the **Skills** tab.
3. Click **Upload**.
4. Browse to `~/.event4u/agent-config/claude-desktop/bundles/` and pick the
   ZIPs you want — drag-drop them, or multi-select in the file picker.
5. Toggle each uploaded skill **On** (the toggle, not the upload, is what
   Claude Desktop checks at runtime).

## Step 2 — verify

1. Quit Claude Desktop fully (`Cmd+Q` on macOS) and reopen it.
2. Open a new conversation and type `/` — the uploaded skills appear in
   the menu.
3. **Settings → Customize → Skills** lists every uploaded skill with its
   **On** toggle.

If a skill is missing from `/`: confirm its toggle is **On**, re-upload
that ZIP, and fully quit and reopen Claude Desktop.

## Step 3 — optional MCP server

Claude Desktop also speaks MCP. Wiring up your own self-hosted
`agent-config-mcp` Cloudflare Worker exposes the skill / rule / command
catalog on demand, on top of the skills you uploaded in Step 1b.

Deploy the Worker first per [`../mcp-cloud-setup.md`](../mcp-cloud-setup.md) — your
URL will be `https://agent-config-mcp.<your-account>.workers.dev`
(or a custom domain). Replace
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
[`src/templates/claude_desktop_config.json.template`](../../../src/templates/claude_desktop_config.json.template) —
copy, swap the placeholder URL for your deploy, and uncomment the MCP
block.

Restart Claude Desktop. The 🔌 icon shows the connector under
**Settings → Connectors**. Full transport details (mcp-remote vs.
native HTTP) and per-client Bearer-auth snippets live in
[`../mcp-client-config.md`](../mcp-client-config.md).

## Claude Desktop ↔ Claude Code — what is shared, what is not

| Surface | Loaded by Desktop? | Loaded by Code? |
| --- | --- | --- |
| `~/.claude/` (skills, commands, rules, hooks) | no | yes — written by `init --tools=claude-code` |
| `~/.event4u/agent-config/claude-desktop/bundles/*.zip` | yes, once uploaded via Customize → Skills | no |
| `claude_desktop_config.json` | yes — MCP servers | no |

Run `npx @event4u/agent-config init --tools=claude-desktop` again to
rebuild the bundles, then re-upload any that changed. For the Claude Code
side see [`claude-code.md`](claude-code.md); `--tools=claude-code,claude-desktop`
sets up both in one run.

## Claude Cowork

Claude Cowork (paid plans only — Pro / Max / Team) **inherits the
Desktop session**. Once Steps 1 and 1b (and optionally 3) are done in Desktop:

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

1. In Claude Desktop → Settings → Customize → Skills, toggle off and delete
   each skill you uploaded.
2. Run `agent-config uninstall --global --tools=claude-desktop` (add
   `--purge` to delete the deployed files, `--dry-run` to preview).

Full sequence: [Uninstall](../../installation.md#uninstall).

## See also

- Install matrix — [`../../installation.md`](../../installation.md)
- MCP client transports — [`../mcp-client-config.md`](../mcp-client-config.md)
