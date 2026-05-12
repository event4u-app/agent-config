# MCP Client Config — Self-hosted agent-config Worker

Connect any MCP-capable client to your own `agent-config-mcp` Cloudflare
Worker. Read-only, identity-stable per release. Optional Bearer-token
auth — see [§ Bearer auth](#bearer-auth) below.

> **No public endpoint.** This package ships the Worker source under
> `workers/mcp/`, but does **not** operate a shared hosted MCP server.
> Deploy your own per [`mcp-cloud-setup.md`](mcp-cloud-setup.md) — your
> URL will be `https://agent-config-mcp.<your-account>.workers.dev`
> (or a custom domain you wire up in Step 7).
>
> In every snippet below, **replace `https://your-worker.workers.dev`
> with your actual deployment URL**.

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

The Worker is **stateless** and **project-agnostic** — it serves the
same skill / rule / command catalog to every client. Personalization
happens agent-side after the MCP delivers its content blob; the Worker
itself does not read `.agent-settings.yml`.

First-time setup of `.agent-settings.yml` runs through `/onboard`;
template drift is handled by `/sync-agent-settings`.

## Bearer auth

If you set the `MCP-Token` secret on your Worker (via
`task mcp:cloud:secret-put`), every POST request must carry the header
`Authorization: Bearer <token>`. The `GET /` liveness probe stays
unauthenticated.

Add the header to each client below by appending the per-client header
snippet shown in its section. Treat the token like any other secret —
keep it out of repo files and shared dotfiles; prefer an env var
(`MCP_TOKEN`) sourced from a password manager or shell init.

If your Worker has **no** `MCP-Token` secret set, skip the header
snippets — every POST is accepted as-is.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

With Bearer auth, add `--header`:

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

Restart Claude Desktop. The connector appears in the dropdown.

Newer builds also support **Settings → Connectors → Add Custom
Connector** with the URL directly — no `mcp-remote` wrapper needed.

## Claude Code

Native HTTP transport — one command:

```bash
claude mcp add --transport http agent-config https://your-worker.workers.dev
```

With Bearer auth:

```bash


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
      "url": "https://your-worker.workers.dev",
      "headers": { "Authorization": "Bearer paste-token-here" }
    }
  }
}
```

(Omit the `headers` block if your Worker has no `MCP-Token` secret.)
Reload Cursor (`Cmd+Shift+P → Reload Window`).

## Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "agent-config": {
      "source": "custom",
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

Drop the `--header` / `env` pair when the Worker has no token set.
Zed has no native remote-MCP transport yet, so the `mcp-remote`
bridge is required.

## Continue

`~/.continue/config.yaml` (or `<repo>/.continue/config.yaml`):

```yaml
mcpServers:
  - name: agent-config
    command: npx
    args:
      - "-y"
      - mcp-remote
      - https://your-worker.workers.dev
      - --header
      - "Authorization: Bearer ${MCP_TOKEN}"
    env:
      MCP_TOKEN: paste-token-here
```

Drop the `--header` / `env` keys when the Worker has no token set.

## Verify

After reload, every client should:

1. List `agent-config` under connectors / tools with a release-key
   matching the live deploy. Probe the endpoint to see the current
   release (the `GET /` liveness probe is always unauthenticated):

   ```bash
   curl https://your-worker.workers.dev
   # → { "ok": true, "release_key": "v…", "signature": "…", … }
   ```

2. Expose skill + command prompts under URIs like `skill://…` and
   `command://…`.
3. Expose rule + guideline + context resources under `rule://…`,
   `guideline://…`, `context://…`.

With Bearer auth, a wrong/missing token returns HTTP 401 with body
`{"jsonrpc":"2.0","id":null,"error":{"code":-32001,"message":"Unauthorized"}}` —
quick way to confirm enforcement:

```bash
curl -X POST -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' \
  https://your-worker.workers.dev
# → 401 Unauthorized

curl -X POST -H "content-type: application/json" \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' \
  https://your-worker.workers.dev
# → 200 { "jsonrpc":"2.0","id":1,"result":{} }
```

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
