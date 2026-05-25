---
stability: experimental
---

# MCP Tool Stub Envelope — Phase 1 Discovery Contract

> **Status:** Active · governs the Discovery-First MCP coverage strategy
> ([`mcp-coverage-strategy.md`](../../agents/settings/contexts/mcp-coverage-strategy.md)).
> **Stability:** experimental — internal index reference only per
> `STABILITY.md`.

## Purpose

Locks the wire shape of the `not_implemented` envelope returned by
`tools/call` when a consumer agent invokes a catalog entry that has no
implementation on the active transport. Every denied call returns a
structured payload with a recovery hint, never a silent 404 and never
a 500.

## Source of truth

`scripts/mcp_server/consumer_tool_catalog.json` (schema_version 1).
Both the stdio server and the Cloud Worker bundle (`internal/workers/mcp/`,
packed by `scripts/pack_mcp_content.py`) read from this file. The
manifest returned by `tools/list` is byte-identical apart from
per-tool `implemented_on` metadata.

## Catalog entry

```json
{
  "name": "<snake_case>",
  "description": "<≤500 chars; agent-facing>",
  "side_effect": "ro | fs-write | shell",
  "implemented_on": ["stdio"],
  "input_schema": { "type": "object", "...": "JSON Schema draft-7" }
}
```

`implemented_on` lists transports where a real handler is wired;
missing transports return the envelope.

## Envelope wire shape

```json
{
  "code": "not_implemented",
  "tool": "<catalog name>",
  "transport": "stdio | worker",
  "install_hint": "<copyable shell command>",
  "alternative": "stdio",
  "message": "<one-sentence explainer>"
}
```

Stdio returns this as the JSON-RPC `result` (SDK wraps in
`TextContent`); the Worker returns it as `error.data` alongside
`code: -32601`. Field invariants: `code` is the frozen literal
`not_implemented`; `tool` echoes the caller; `transport` is set per
surface; `install_hint` comes from the catalog's `install_hint_stdio`
field; `alternative` is the frozen literal `stdio` until Phase 3.
Consumer agents must drive logic from `code`, not `message`.

## Unknown-tool / latent-demand path

A call to a name not in the catalog returns JSON-RPC error `-32601`
with the same envelope shape, `code: "unknown_tool"`. Both transports
log the attempt with `outcome: "latent_demand"` so Phase 2 can
promote unforeseen names.

## Acceptance

- Both transports return `code == "not_implemented"` for every
  catalog entry whose `implemented_on` excludes the transport.
- Both transports return `code == "unknown_tool"` for any name not in
  the catalog.
- Schema version bumps on any incompatible field rename; new optional
  fields are compatible.
