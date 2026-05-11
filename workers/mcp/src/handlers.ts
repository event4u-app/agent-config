/**
 * JSON-RPC method handlers — pure functions over (ContentBlob, params).
 *
 * Separated from `index.ts` so handlers are unit-testable without HTTP
 * or the Workers runtime (per Phase 2-5 council verdict D1).
 *
 * The Worker speaks MCP over a single HTTP POST endpoint as
 * Streamable HTTP transport. Each request is one JSON-RPC envelope.
 */

import type { ContentBlob } from "./content.js";
import { getPrompt, listPrompts } from "./prompts.js";
import { listResources, readResource } from "./resources.js";
import { DEPRECATED_TOOLS, isDeprecatedTool } from "./stubs.js";

/** JSON-RPC error codes used by this Worker. */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
};

export type JsonRpcError = {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** Server identity — surfaced on `initialize`. */
export type ServerIdentity = {
  name: string;
  version: string;
  releaseKey: string;
  skillSetSignature: string;
};

export function buildIdentity(blob: ContentBlob): ServerIdentity {
  return {
    name: "agent-config-mcp",
    version: blob.manifest.package_version,
    releaseKey: blob.manifest.release_key,
    skillSetSignature: blob.manifest.signature,
  };
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return data === undefined
    ? { jsonrpc: "2.0", id, error: { code, message } }
    : { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function rpcResult(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Dispatches a parsed JSON-RPC request against the bundled content. The
 * caller is responsible for HTTP framing — this function is sync and
 * pure given (blob, request).
 */
export function dispatch(blob: ContentBlob, req: JsonRpcRequest): JsonRpcResponse {
  const id = req.id ?? null;
  const params = (req.params ?? {}) as Record<string, unknown>;
  const identity = buildIdentity(blob);

  switch (req.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2025-03-26",
        capabilities: {
          prompts: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
          tools: { listChanged: false },
        },
        serverInfo: { name: identity.name, version: identity.version },
        _meta: {
          releaseKey: identity.releaseKey,
          skillSetSignature: identity.skillSetSignature,
        },
      });

    case "ping":
      return rpcResult(id, {});

    case "prompts/list": {
      const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
      return rpcResult(id, listPrompts(blob, cursor));
    }

    case "prompts/get": {
      const name = typeof params.name === "string" ? params.name : "";
      if (!name) return rpcError(id, RPC_INVALID_PARAMS, "params.name is required");
      const result = getPrompt(blob, name);
      if (!result) return rpcError(id, RPC_INVALID_PARAMS, `Unknown prompt: ${name}`);
      return rpcResult(id, result);
    }

    case "resources/list": {
      const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
      return rpcResult(id, listResources(blob, cursor));
    }

    case "resources/read": {
      const uri = typeof params.uri === "string" ? params.uri : "";
      if (!uri) return rpcError(id, RPC_INVALID_PARAMS, "params.uri is required");
      const result = readResource(blob, uri);
      if (!result) return rpcError(id, RPC_INVALID_PARAMS, `Unknown resource: ${uri}`);
      return rpcResult(id, result);
    }

    case "tools/list":
      return rpcResult(id, { tools: DEPRECATED_TOOLS });

    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      if (isDeprecatedTool(name)) {
        return rpcError(
          id,
          RPC_METHOD_NOT_FOUND,
          `Tool '${name}' is deprecated and not available on the hosted Worker. Use the local stdio server.`,
          { deprecated: true, alternative: "local-stdio" },
        );
      }
      return rpcError(id, RPC_METHOD_NOT_FOUND, `Unknown tool: ${name}`);
    }

    default:
      return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
  }
}
