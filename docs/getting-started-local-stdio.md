# Getting Started — local stdio MCP (end-users)

> You installed (or want to install) `@event4u/agent-config` and want your
> AI client to see its skills, commands, rules, and guidelines — **locally,
> with no server to deploy and no account**. This page is for you. If you are
> a *contributor* hacking on the package itself, see
> [`mcp-server.md`](mcp-server.md) instead.

The turnkey path is one command — **`agent-config mcp-server`** — wired into
your MCP client. It serves the bundled content over stdio: **read-only**,
fully local, offline, no Cloudflare account, no repo clone.

## 1. Install

```bash
npm install -g @event4u/agent-config
agent-config --version    # confirms the binary is on your PATH
```

No global install? Every config below also works with
`"command": "npx", "args": ["-y", "@event4u/agent-config", "mcp-server"]`.

## 2. Point your client at it

Copy the snippet for your client from
[`setup/mcp-client-config.md § Local stdio (turnkey)`](setup/mcp-client-config.md#local-stdio-turnkey--no-worker-no-account).
The shape is the same everywhere — a **command**, not a URL:

```json
{
  "mcpServers": {
    "agent-config": { "command": "agent-config", "args": ["mcp-server"] }
  }
}
```

Claude Desktop, Claude Code, Cursor, and Zed snippets are all in that section.
Restart / reload the client after editing its config.

## 3. Verify

Drive the server by hand — it speaks newline-delimited JSON-RPC on stdio:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  | agent-config mcp-server
# → {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"agent-config-mcp",…}}}
```

In your client you should then see `agent-config` listed, exposing:

- **prompts** — skills (`skill.<name>`) and commands (`command.<name>`),
- **resources** — rules (`rule://<name>`) and guidelines (`guideline://<name>`).

## What you get — and what you don't

- **Read-only content.** The local server serves the governance content as MCP
  prompts + resources. It does **not** execute anything: `tools/list` is empty
  and `tools/call` returns a `not_implemented` envelope. That is by design — see
  [`decisions/ADR-085-mcp-stdio-end-user-distribution-shape.md`](decisions/ADR-085-mcp-stdio-end-user-distribution-shape.md).
- **No network, no account.** Nothing leaves your machine. (If you instead want
  a shared team endpoint reachable from anywhere, that is the *self-hosted
  Worker* path — see [§ Two ways to connect](setup/mcp-client-config.md#two-ways-to-connect--pick-one).)

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `command not found: agent-config` | The global install isn't on PATH. Use the `npx` form, or fix your npm global bin path. |
| Client shows the server but no prompts/resources | The package is installed but unbuilt content is missing — reinstall `@event4u/agent-config`; the server refuses to serve an empty surface and prints why on **stderr**. |
| Garbled / "invalid JSON" in the client | Something is writing to **stdout**. The server keeps stdout pure JSON-RPC and prints its readiness note on stderr — if you wrapped it in a script, make sure that wrapper doesn't echo to stdout. |

## See also

- [`setup/mcp-client-config.md`](setup/mcp-client-config.md) — all client snippets (local + remote).
- [`decisions/ADR-085-mcp-stdio-end-user-distribution-shape.md`](decisions/ADR-085-mcp-stdio-end-user-distribution-shape.md) — why local stdio is read-only.
- [`mcp-server.md`](mcp-server.md) — the contributor (clone + Python kernel) path.
