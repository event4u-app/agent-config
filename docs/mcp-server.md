# MCP Server

> Status: **experimental** — read-only prompts + resources plus a growing `tools/*` surface (stub-by-default: every catalogued tool name resolves, unimplemented ones return a structured `not_implemented` envelope). Tool coverage and the write/exec unlock path are governed by [`agents/settings/contexts/mcp-coverage-strategy.md`](../agents/settings/contexts/mcp-coverage-strategy.md). Promotion to **beta** is gated on the six criteria in [`docs/contracts/mcp-beta-criteria.md`](contracts/mcp-beta-criteria.md); current gate status: `./agent-config doctor --check mcp-beta-readiness`.

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
  Worker (`internal/workers/mcp/`) serves the same wire surface over HTTP/SSE for
  hosted-agent platforms. URL shapes pinned in
  [`docs/setup/mcp-cloud-endpoints.md`](setup/mcp-cloud-endpoints.md);
  safety contract in
  [`docs/contracts/mcp-cloud-scope.md`](contracts/mcp-cloud-scope.md).
  Wire-parity-checked against the local stdio kernel on every release.

Every implemented tool is either read-only or writes only inside the
consumer's project tree via a path-guard (`_validateInTreePath`) —
[`docs/contracts/mcp-phase-1-scope.md`](contracts/mcp-phase-1-scope.md)
is the scope contract; exec-tier tools (shell-spawning) and network-tier
tools (billable) are gated behind
[`agents/settings/contexts/mcp-coverage-strategy.md`](../agents/settings/contexts/mcp-coverage-strategy.md).

## What the server exposes

| Primitive | URIs | Source |
|---|---|---|
| `prompts/list` + `prompts/get` | `skill.<name>`, `command.<name>` | `dist/agent-src/skills/`, `dist/agent-src/commands/` |
| `resources/list` + `resources/read` | `rule://<stem>` | `dist/agent-src/rules/` |
| ↳ | `guideline://<relpath>` | `docs/guidelines/` |
| ↳ | `context://<relpath>` | `dist/agent-src/contexts/` |
| `tools/list` + `tools/call` | see [`agents/settings/contexts/mcp-tool-tier-map.md`](../agents/settings/contexts/mcp-tool-tier-map.md) for the full candidate surface | `src/scripts/mcp_server/consumer_tool_catalog.json` |

All resources are served with `mimeType: text/markdown`. Pagination is
cursor-based (default page size: 100). Hot-reload triggers automatically on
file mtime changes — edit a rule, reissue `resources/list`, see the update.
Exact prompt/resource/tool counts drift with every content change — the smoke
test below reports the live numbers rather than a number pinned in prose.
_Last verified boot (`task mcp:glama-test`, 2026-07-07): 430 prompts / 232
resources / 27 tools (9 implemented, 18 stubs)._

## Setup — one-line install

```bash
task mcp:setup            # maintainer / dev repo
./agent-config mcp:setup  # consumer projects (uses the package CLI wrapper)
```

Either form verifies that `tsx` + the server module are present and
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

Both forms launch the TypeScript MCP server over stdio via `tsx`. Use these
for a manual smoke test — MCP clients (Claude Desktop, Cursor, Zed, Continue)
launch the server themselves via the config snippets below.

## Client configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agent-config": {
      "command": "/absolute/path/to/agent-config/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/agent-config/src/scripts/mcp_server/__main__.ts"],
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
      "command": "/absolute/path/to/agent-config/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/agent-config/src/scripts/mcp_server/__main__.ts"],
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
        "path": "/absolute/path/to/agent-config/node_modules/.bin/tsx",
        "args": ["/absolute/path/to/agent-config/src/scripts/mcp_server/__main__.ts"]
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
    command: /absolute/path/to/agent-config/node_modules/.bin/tsx
    args: [/absolute/path/to/agent-config/src/scripts/mcp_server/__main__.ts]
    cwd: /absolute/path/to/agent-config
```

## Smoke test

After configuring a client, run a manual stdio handshake to verify the server
boots cleanly:

```bash
./agent-config mcp:run < /dev/null
# Expect stderr: "mcp-server: loaded N prompts (0 warnings)",
#                "mcp-server: loaded N resources (0 warnings)", and
#                "mcp-server: registered N tools (N implemented, N stubs): [...]"
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Client shows no prompts | Confirm the `cwd` points at the repo root (where `dist/agent-src/` lives), not at `scripts/`. |
| Stale prompts after editing | Hot-reload triggers on mtime; touch the file or reissue `resources/list`. |
| Client refuses to start the server | Check the client's log for the full command. Most clients require **absolute** paths in `command` and `cwd`. |

## Scope

- **In scope:** read-only prompts + resources, pagination, hot-reload, stdio
  transport, free-tier client compatibility, a growing read-only and
  in-tree-write `tools/*` surface (see
  [`agents/settings/contexts/mcp-tool-tier-map.md`](../agents/settings/contexts/mcp-tool-tier-map.md)).
- **Out of scope:** SSE / native HTTP transport for this server (the
  Cloudflare Worker above is the HTTP bridge instead), shell-exec and
  network-tier tools until the safety envelope in
  [`agents/settings/contexts/mcp-coverage-strategy.md`](../agents/settings/contexts/mcp-coverage-strategy.md)
  ships, signed payloads.

← [Architecture](architecture.md) · [MCP config generation (consumer side)](mcp.md)
