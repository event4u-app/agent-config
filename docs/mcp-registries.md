# MCP registries & cross-tool install landscape

> Reference material. Where to *discover* MCP servers, what each registry gives
> you, and how to install one into each agent today — without our own tooling.
>
> Background: we evaluated building a read-only cross-agent MCP discovery helper
> (`ADR-086`) and decided **not to** — existing tooling already covers it. This
> doc captures the surviving value: the registry comparison and the per-agent
> manual install path. See [`docs/mcp.md`](mcp.md) for generating *your own*
> `mcp.json` across tools.

## The three registries (verified 2026-06-11)

| Dimension | Official registry | Glama | Smithery |
|---|---|---|---|
| Role | Vendor-neutral **catalog** (discovery spec) | Catalog **superset** + quality/safety scoring | Catalog **+ installer** |
| Canonical shape | `server.json` | Own schema (maps to `server.json` fields) | Own schema |
| Approx. scale | Hundreds+ (paginated, growing) | ~32k servers | Own index |
| Writes client config? | **No** (discovery only) | **No** (discovery only) | **Yes** — `smithery install X --client <c>` |
| API auth | **None** — public read | **None** — public read | n/a (CLI) |
| Query endpoint | `GET registry.modelcontextprotocol.io/v0/servers?search=&limit=&cursor=` | `GET glama.ai/api/mcp/v1/servers?first=&after=` | `smithery` CLI / site |

Both catalog APIs were live-checked: each returns `200` with **no API key**. The
official registry returns `{servers:[{server:<server.json>,_meta:…}],metadata:{nextCursor,count}}`;
Glama returns `{pageInfo:{endCursor,hasNextPage},servers:[{id,name,namespace,slug,
description,environmentVariablesJsonSchema,repository,spdxLicense,tools,url}]}`.

> Glama's quality/safety **score is a popularity/heuristic signal, not a verified
> security property** — treat it as a hint, never a guarantee.

## Installing a discovered server per agent

For most agents, **Smithery already writes the config for you** (the read-write
path — harder than discovery). Its CLI (`smithery-ai/cli`, `src/config/clients.ts`
`VALID_CLIENTS`, verified 2026-06-11) configures 23 clients, including:

`smithery install <server> --client <client>` where `<client>` ∈ **claude** (Desktop),
**claude-code**, **cursor**, **windsurf**, **cline**, **vscode** / **vscode-insiders**
(Copilot), plus codex, gemini-cli, zed, goose, kiro, trae, and others.

That covers Claude Code, Cursor, Windsurf, Cline, and VS Code/Copilot. **Augment is
the gap** — it is not in Smithery's client list, so install it manually (below).

## Augment — manual MCP install (no tooling needed)

Augment supports the **standard `mcpServers` object map** via its built-in
**Import from JSON** (Augment Settings Panel → gear icon → Import from JSON).
Paste, for a stdio server:

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "npx",
      "args": ["-y", "<package>"]
    }
  }
}
```

…or for a remote server:

```json
{
  "mcpServers": {
    "<server-name>": {
      "url": "https://example.com/mcp",
      "type": "sse"
    }
  }
}
```

Secret env vars get their own section in the Settings Panel — paste placeholders,
fill in the real value there; never commit a real secret. Augment also offers
**Easy MCP** (one-click) for common servers, and the JetBrains plugin manages MCP
through its own settings UI.

> Why no automated Augment writer? Augment's only file-writable surface is VS Code
> `settings.json` under the nested key `augment.advanced.mcpServers` (an array of
> `{name, command, args}`), which the official docs do not commit to as a stable
> contract. Smithery's writer targets flat, dedicated config files, so it cannot
> safely write Augment's nested/shared surface. Manual Import-from-JSON is the
> supported path today.

## Reopen criteria — automated Augment install

Reconsidered (e.g. native Smithery support or our own writer) only if **all** hold:

1. ≥ 3 users independently request automated Smithery → Augment install.
2. Augment documents the `settings.json` MCP schema as a **stable** contract.
3. The Smithery maintainers pre-approve the integration approach.

Until then this stays manual by design (`ADR-086`, AI-council convergence 2026-06-11).
