# MCP Client Config — Remote agent-config

Connect any MCP-capable client to the hosted `agent-config-mcp` Worker
at `https://agent-config-mcp.event4u.workers.dev`. Read-only,
identity-stable per release, no auth.

For URL shapes (latest vs. pinned `/v<X.Y.Z>`) see
[`mcp-cloud-endpoints.md`](mcp-cloud-endpoints.md). For operator
setup of your own deployment see [`mcp-cloud-setup.md`](mcp-cloud-setup.md).

## Transport note

The Worker speaks JSON-RPC over HTTP POST. Clients that support
HTTP transport natively (Claude Code, Cursor) talk to it directly.
Clients that only support stdio (Claude Desktop, Zed) need the
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge from
npm — invoked via `npx`, no install required.

## Where settings live — `.agent-settings.yml` vs. MCP config

These are **two different files** for two different layers. Don't
look for MCP server config inside `.agent-settings.yml`.

| File | Where | Who reads it | Purpose |
|---|---|---|---|
| MCP client config (this page) | client-specific path per section above | the MCP client at startup | which MCP servers to talk to (name + URL / command) |
| `.agent-settings.yml` | consumer project root (`<repo>/.agent-settings.yml`) | the agent at runtime (Claude / Cursor / …) | per-developer preferences: `name`, `ide`, `cost_profile`, `personal.autonomy`, `pipelines.skill_improvement`, `caveman.speak_scope`, … |

The hosted MCP is **stateless** and **project-agnostic** — it serves
the same skill / rule / command catalog to every client. Personalization
happens agent-side after the MCP delivers its content blob; the Worker
itself does not read `.agent-settings.yml`.

First-time setup of `.agent-settings.yml` runs through `/onboard`;
template drift is handled by `/sync-agent-settings`.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. The connector appears in the dropdown.

Newer builds also support **Settings → Connectors → Add Custom
Connector** with the URL directly — no `mcp-remote` wrapper needed.

## Claude Code

Native HTTP transport — one command:

```bash
claude mcp add --transport http agent-config https://agent-config-mcp.event4u.workers.dev
```

Verify:

```bash
claude mcp list
```

## Cursor

`~/.cursor/mcp.json` (global) or `<repo>/.cursor/mcp.json`
(project-local):

```json
{
  "mcpServers": {
    "agent-config": {
      "url": "https://agent-config-mcp.event4u.workers.dev"
    }
  }
}
```

Reload Cursor (`Cmd+Shift+P → Reload Window`).

## Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "agent-config": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://agent-config-mcp.event4u.workers.dev"]
    }
  }
}
```

Zed has no native remote-MCP transport yet, so the `mcp-remote`
bridge is required.

## Continue

`~/.continue/config.yaml` (or `<repo>/.continue/config.yaml`):

```yaml
mcpServers:
  - name: agent-config
    command: npx
    args: ["-y", "mcp-remote", "https://agent-config-mcp.event4u.workers.dev"]
```

## Verify

After reload, every client should:

1. List `agent-config` under connectors / tools with a release-key
   matching the live deploy. Probe the endpoint to see the current
   release:

   ```bash
   curl https://agent-config-mcp.event4u.workers.dev
   # → { "ok": true, "release_key": "v…", "signature": "…", … }
   ```

2. Expose skill + command prompts under URIs like `skill://…` and
   `command://…`.
3. Expose rule + guideline + context resources under `rule://…`,
   `guideline://…`, `context://…`.

If the client shows the connector but no prompts / resources,
re-probe the URL — a 5xx from the Worker indicates the deploy is
mid-roll, retry after a minute.

## Local stdio alternative

If you have the repo cloned and prefer running the MCP server
locally (faster startup, no network), the stdio kernel under
`scripts/mcp_server/` is the same wire surface. Setup:
`task mcp:setup`, run details in [`../mcp-server.md`](../mcp-server.md).

## See also

- URL shapes & DNS — [`mcp-cloud-endpoints.md`](mcp-cloud-endpoints.md)
- Operator setup (your own deploy) — [`mcp-cloud-setup.md`](mcp-cloud-setup.md)
- A0-cloud contract — [`../contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md)
