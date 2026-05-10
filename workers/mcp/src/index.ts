/**
 * Cloudflare Worker entry — HTTP/JSON-RPC transport for the agent-config
 * MCP bridge.
 *
 * The bundled `content.json` is loaded once at module init via static
 * import (replaced by `scripts/pack_mcp_content.py` at build time).
 * When the file is missing — local `wrangler dev` without a pack — we
 * fall back to STUB_BLOB so the Worker boots and round-trips empty.
 *
 * Governed by `docs/contracts/mcp-cloud-scope.md` §A0-cloud.
 */

import contentJson from "../content.json" with { type: "json" };

import {
  RPC_INVALID_REQUEST,
  RPC_PARSE_ERROR,
  dispatch,
  rpcError,
  type JsonRpcError,
  type JsonRpcRequest,
} from "./handlers.js";
import { assertContentBlob, STUB_BLOB, type ContentBlob } from "./content.js";

type Env = {
  PACKAGE_VERSION: string;
  RELEASE_KEY: string;
};

/** Frozen at module init — the bundle IS the truth. */
const CONTENT: ContentBlob = (() => {
  try {
    assertContentBlob(contentJson);
    return contentJson;
  } catch {
    // No packed content available (dev / first-boot). The stub blob
    // round-trips empty lists; production deploys always replace it.
    return STUB_BLOB;
  }
})();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // The Worker is read-only and identity-stable per release_key.
      // Cache-Control is conservative; CDN cache key includes path only.
      "cache-control": "public, max-age=60",
      "x-agent-config-release": CONTENT.manifest.release_key,
      "x-agent-config-signature": CONTENT.manifest.signature,
    },
  });
}

function parseRequestBody(raw: string): JsonRpcRequest | JsonRpcError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return rpcError(null, RPC_PARSE_ERROR, "Parse error: invalid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    return rpcError(null, RPC_INVALID_REQUEST, "Invalid Request: not an object");
  }
  const p = parsed as Partial<JsonRpcRequest>;
  if (p.jsonrpc !== "2.0" || typeof p.method !== "string") {
    return rpcError(
      (p.id as string | number | null | undefined) ?? null,
      RPC_INVALID_REQUEST,
      "Invalid Request: missing jsonrpc=2.0 or method",
    );
  }
  return parsed as JsonRpcRequest;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    if (request.method === "GET") {
      // Liveness probe — returns release identity, no MCP semantics.
      return jsonResponse({
        ok: true,
        name: "agent-config-mcp",
        release_key: CONTENT.manifest.release_key,
        package_version: CONTENT.manifest.package_version,
        signature: CONTENT.manifest.signature,
        schema_version: CONTENT.schema_version,
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }

    const raw = await request.text();
    const parsed = parseRequestBody(raw);
    if ("error" in parsed) {
      return jsonResponse(parsed, 200);
    }

    const response = dispatch(CONTENT, parsed);
    return jsonResponse(response, 200);
  },
};
