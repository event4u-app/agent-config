/**
 * Tool catalog dispatch — Worker side of the Phase 1 discovery contract.
 *
 * Source of truth: `scripts/mcp_server/consumer_tool_catalog.json`,
 * inlined into the bundled `content.json` by `scripts/pack_mcp_content.py`.
 * Both transports return identical metadata on `tools/list`; what differs
 * is per-tool `implemented_on`.
 *
 * Contract: `docs/contracts/mcp-tool-stub-envelope.md`.
 *   - Catalog entry with this transport in `implemented_on` → real handler.
 *     None are wired on the Worker yet (Phase 1 is discovery-only).
 *   - Catalog entry missing this transport → `code: not_implemented`
 *     envelope, returned as `error.data` alongside RPC error -32601.
 *   - Unknown name → `code: unknown_tool` envelope, same shape.
 */

import type { ContentBlob, ToolCatalogEntry } from "./content.js";

export const WORKER_TRANSPORT = "worker" as const;

export type ToolListing = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta: {
    side_effect: ToolCatalogEntry["side_effect"];
    implemented_on: readonly string[];
    /** `true` when this transport is missing from implemented_on. */
    stub: boolean;
  };
};

/** Build the `tools/list` payload from the bundled catalog. */
export function listTools(blob: ContentBlob): ToolListing[] {
  return blob.tool_catalog.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
    _meta: {
      side_effect: t.side_effect,
      implemented_on: t.implemented_on,
      stub: !t.implemented_on.includes(WORKER_TRANSPORT),
    },
  }));
}

export type NotImplementedEnvelope = {
  code: "not_implemented" | "unknown_tool";
  tool: string;
  transport: typeof WORKER_TRANSPORT;
  install_hint: string;
  alternative: "stdio";
  message: string;
};

function envelope(
  code: NotImplementedEnvelope["code"],
  tool: string,
  blob: ContentBlob,
  message: string,
): NotImplementedEnvelope {
  return {
    code,
    tool,
    transport: WORKER_TRANSPORT,
    install_hint: blob.tool_catalog.install_hint_stdio,
    alternative: "stdio",
    message,
  };
}

/** Dispatch a `tools/call` against the catalog. Phase 1: never executes. */
export function callTool(blob: ContentBlob, name: string): NotImplementedEnvelope {
  const entry = blob.tool_catalog.tools.find((t) => t.name === name);
  if (!entry) {
    return envelope(
      "unknown_tool",
      name,
      blob,
      `Tool '${name}' is not in the discovery catalog. See ` +
        "docs/contracts/mcp-tool-stub-envelope.md.",
    );
  }
  if (entry.implemented_on.includes(WORKER_TRANSPORT)) {
    // Phase 1 invariant — no Worker handlers are wired. Treat as stub
    // until Phase 3 promotes a tool to the worker transport.
    return envelope(
      "not_implemented",
      name,
      blob,
      `Tool '${name}' is marked implemented on the worker transport but ` +
        "no handler is wired yet. Run via the local stdio server.",
    );
  }
  return envelope(
    "not_implemented",
    name,
    blob,
    `Tool '${name}' is in the discovery catalog but not implemented on ` +
      "the worker transport. See the install hint to wire it up locally.",
  );
}
