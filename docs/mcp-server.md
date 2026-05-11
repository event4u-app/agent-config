# MCP Server

> Status: **experimental** — Phase 1 + 2 + 3 shipped. No `tools/*` primitive yet (Phase 4, deferred behind a design call).

`agent-config` ships a built-in [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes the package's read-only governance surface to MCP-aware
clients (Claude Desktop, Cursor, Zed, Continue, Codex via MCP). Three channels
coexist:

- **File projection** — `task generate-tools` writes `.claude/`, `.cursor/`,
  `.clinerules/`, `.windsurfrules`. Used by Aider, Cline, Windsurf, Gemini CLI.
- **Local stdio MCP server** — `scripts/mcp_server/` exposes the same content
  over JSON-RPC. Used by clients that speak MCP natively. Default for personal
  installs.
- **Remote MCP** *(experimental, opt-in)* — a Cloudflare-hosted TypeScript
  Worker (`workers/mcp/`) serves the same wire surface over HTTP/SSE for
  hosted-agent platforms. URL shapes pinned in
  [`docs/setup/mcp-cloud-endpoints.md`](setup/mcp-cloud-endpoints.md);
  safety contract in
  [`docs/contracts/mcp-cloud-scope.md`](contracts/mcp-cloud-scope.md).
  Wire-parity-checked against the local stdio kernel on every release.

The MCP server **never executes engine code, never writes files, never spawns
shells**. It is a read-only instructional surface — see
[`docs/contracts/mcp-phase-1-scope.md`](contracts/mcp-phase-1-scope.md).

## What the server exposes

| Primitive | URIs | Source | Count (this package) |
|---|---|---|---|
| `prompts/list` + `prompts/get` | `skill.<name>`, `command.<name>` | `.agent-src/skills/`, `.agent-src/commands/` | 174 skills + 104 commands |
| `resources/list` + `resources/read` | `rule://<stem>` | `.agent-src/rules/` | 60 rules |
| ↳ | `guideline://<relpath>` | `docs/guidelines/` | 69 guidelines |
| ↳ | `context://<relpath>` | `.agent-src/contexts/` | 31 contexts |

All resources are served with `mimeType: text/markdown`. Pagination is
cursor-based (default page size: 100). Hot-reload triggers automatically on
file mtime changes — edit a rule, reissue `resources/list`, see the update.

## Setup — one-line install

```bash
task mcp:setup            # maintainer / dev repo
./agent-config mcp:setup  # consumer projects (uses the package CLI wrapper)
```

Either form creates `.venv-mcp/` (Python 3.11+), installs the `mcp` SDK, and
prints the client config snippet. Run once per checkout.

If you do not have `task` or the CLI wrapper available:

```bash
bash scripts/mcp_setup.sh
```

## Running the server

```bash
task mcp:run            # maintainer / dev repo
./agent-config mcp:run  # consumer projects
```

Both forms launch `python -m scripts.mcp_server` over stdio against the
local `.venv-mcp/`. Use these for ad-hoc smoke tests; long-running clients
(Claude Desktop, Cursor, Zed, Continue) launch the server themselves via
the config snippets below.

## Client configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "/absolute/path/to/agent-config/.venv-mcp/bin/python",
      "args": ["-m", "scripts.mcp_server"],
      "cwd": "/absolute/path/to/agent-config"
    }
  }
}
```

Restart Claude Desktop. The skills, commands, rules, guidelines, and contexts
appear under the connector dropdown.

### Cursor

`~/.cursor/mcp.json` (or `<repo>/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "/absolute/path/to/agent-config/.venv-mcp/bin/python",
      "args": ["-m", "scripts.mcp_server"],
      "cwd": "/absolute/path/to/agent-config"
    }
  }
}
```

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "agent-config": {
      "command": {
        "path": "/absolute/path/to/agent-config/.venv-mcp/bin/python",
        "args": ["-m", "scripts.mcp_server"]
      },
      "settings": {}
    }
  }
}
```

### Continue (`continue.dev`)

`~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: agent-config
    command: /absolute/path/to/agent-config/.venv-mcp/bin/python
    args: ["-m", "scripts.mcp_server"]
    cwd: /absolute/path/to/agent-config
```

## Smoke test

After configuring a client, run a manual stdio handshake to verify the server
boots cleanly:

```bash
./agent-config mcp:run < /dev/null
# Expect stderr: "mcp-server: loaded N prompts (0 warnings)" and
#                "mcp-server: loaded 160 resources (0 warnings)"
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Client shows no prompts | Confirm the `cwd` points at the repo root (where `.agent-src/` lives), not at `scripts/`. |
| `ModuleNotFoundError: mcp` | Re-run `task mcp:setup`. The MCP runtime is isolated in `.venv-mcp/` — the project's base Python 3.9 deliberately does not see it. |
| Stale prompts after editing | Hot-reload triggers on mtime; touch the file or reissue `resources/list`. |
| Client refuses to start the server | Check the client's log for the full command. Most clients require **absolute** paths in `command` and `cwd`. |

## Scope

- **In scope:** read-only prompts + resources, pagination, hot-reload, stdio
  transport, free-tier client compatibility.
- **Out of scope (Phase 4+):** `tools/*` primitive, SSE / HTTP transport,
  cloud distribution, signed payloads. Tracked in
  [`agents/roadmaps/road-to-mcp-server.md`](../agents/roadmaps/road-to-mcp-server.md).

← [Architecture](architecture.md) · [MCP config generation (consumer side)](mcp.md)
