/**
 * Pure JSON-RPC dispatch for the local stdio-lite MCP server (ADR-085).
 *
 * Wire shapes are mirrored VERBATIM from the hosted Worker
 * (`internal/workers/mcp/src/{handlers,prompts,resources}.ts`) so the local
 * stdio surface and the hosted HTTP surface return identical envelopes —
 * the multi-channel-consistency guarantee in ADR-085. If you change a shape
 * here, change it there too (and the Python kernel `scripts/mcp_server/`).
 *
 * Read-only: `tools/list` is empty and `tools/call` returns the
 * `not_implemented` envelope. Execution (the `full` kernel) is deferred per
 * ADR-085 § Phase-2 trigger. Pure — no I/O, no clock, no stdout.
 */

import type { ContentTree, ContentEntry } from './content.js';
import { entriesOfKind } from './content.js';

export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

/** MCP protocol version this server speaks (mirrors the Worker). */
export const PROTOCOL_VERSION = '2025-03-26';
const PAGE_SIZE = 50;
const MIME_MARKDOWN = 'text/markdown';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: unknown;
}
export interface JsonRpcSuccess {
    jsonrpc: '2.0';
    id: string | number | null;
    result: unknown;
}
export interface JsonRpcError {
    jsonrpc: '2.0';
    id: string | number | null;
    error: { code: number; message: string; data?: unknown };
}
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export interface ServerIdentity {
    name: string;
    version: string;
}

export function rpcResult(id: string | number | null, result: unknown): JsonRpcSuccess {
    return { jsonrpc: '2.0', id, result };
}
export function rpcError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
): JsonRpcError {
    return data === undefined
        ? { jsonrpc: '2.0', id, error: { code, message } }
        : { jsonrpc: '2.0', id, error: { code, message, data } };
}

/** frontmatter name → MCP wire name. Mirrors the Worker + Python kernel. */
export function wireNameOf(e: ContentEntry): string {
    if (e.kind === 'command') return `command.${e.name.replace(/:/g, '.')}`;
    return `skill.${e.name}`;
}

function listPrompts(tree: ContentTree, cursor: string | undefined): unknown {
    const all = entriesOfKind(tree, ['skill', 'command'])
        .slice()
        .sort((a, b) => {
            const wa = wireNameOf(a);
            const wb = wireNameOf(b);
            return wa < wb ? -1 : wa > wb ? 1 : 0;
        });
    const startIdx = cursor ? all.findIndex((e) => wireNameOf(e) === cursor) + 1 : 0;
    const page = all.slice(startIdx, startIdx + PAGE_SIZE);
    const next = startIdx + PAGE_SIZE < all.length ? wireNameOf(page[page.length - 1]!) : undefined;
    return {
        prompts: page.map((e) => ({
            name: wireNameOf(e),
            title: e.name,
            description: e.description,
            arguments: [],
            _meta: { source: e.source, kind: e.kind },
        })),
        ...(next ? { nextCursor: next } : {}),
    };
}

function getPrompt(tree: ContentTree, wireName: string): unknown | null {
    const candidates = entriesOfKind(tree, ['skill', 'command']).filter(
        (e) => wireNameOf(e) === wireName,
    );
    if (candidates.length === 0) return null;
    // skill wins on a cross-kind duplicate — mirrors the Python dedup precedence.
    candidates.sort((a) => (a.kind === 'skill' ? -1 : 1));
    const e = candidates[0]!;
    return {
        description: e.description,
        messages: [{ role: 'user', content: { type: 'text', text: e.body } }],
        _meta: { source: e.source, kind: e.kind },
    };
}

function listResources(tree: ContentTree, cursor: string | undefined): unknown {
    const all = entriesOfKind(tree, ['rule', 'guideline'])
        .slice()
        .sort((a, b) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
    const startIdx = cursor ? all.findIndex((e) => e.uri === cursor) + 1 : 0;
    const page = all.slice(startIdx, startIdx + PAGE_SIZE);
    const next = startIdx + PAGE_SIZE < all.length ? page[page.length - 1]?.uri : undefined;
    return {
        resources: page.map((e) => ({
            uri: e.uri,
            name: e.name,
            description: e.description,
            mimeType: e.mime_type ?? MIME_MARKDOWN,
            _meta: { source: e.source, kind: e.kind },
        })),
        ...(next ? { nextCursor: next } : {}),
    };
}

function readResource(tree: ContentTree, uri: string): unknown | null {
    const e = tree.uris[uri];
    if (!e || (e.kind !== 'rule' && e.kind !== 'guideline')) return null;
    return {
        contents: [{ uri: e.uri, mimeType: e.mime_type ?? MIME_MARKDOWN, text: e.body }],
        _meta: { source: e.source, kind: e.kind },
    };
}

/** Read-only lite surface: no executable tools. ADR-085 defers `full`. */
function notImplementedEnvelope(name: string): Record<string, unknown> {
    return {
        code: 'not_implemented',
        message:
            `Tool '${name}' is not available on the local stdio-lite surface ` +
            `(read-only, ADR-085). Execution is deferred; self-host the Python ` +
            `kernel (scripts/mcp_server/) for tool execution.`,
        tool: name,
    };
}

export function dispatch(
    tree: ContentTree,
    identity: ServerIdentity,
    req: JsonRpcRequest,
): JsonRpcResponse {
    const id = req.id ?? null;
    const params = (req.params ?? {}) as Record<string, unknown>;

    switch (req.method) {
        case 'initialize':
            return rpcResult(id, {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {
                    prompts: { listChanged: false },
                    resources: { listChanged: false, subscribe: false },
                    tools: { listChanged: false },
                },
                serverInfo: { name: identity.name, version: identity.version },
            });

        case 'ping':
            return rpcResult(id, {});

        case 'prompts/list': {
            const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;
            return rpcResult(id, listPrompts(tree, cursor));
        }
        case 'prompts/get': {
            const name = typeof params.name === 'string' ? params.name : '';
            if (!name) return rpcError(id, RPC_INVALID_PARAMS, 'params.name is required');
            const r = getPrompt(tree, name);
            if (!r) return rpcError(id, RPC_INVALID_PARAMS, `Unknown prompt: ${name}`);
            return rpcResult(id, r);
        }
        case 'resources/list': {
            const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;
            return rpcResult(id, listResources(tree, cursor));
        }
        case 'resources/read': {
            const uri = typeof params.uri === 'string' ? params.uri : '';
            if (!uri) return rpcError(id, RPC_INVALID_PARAMS, 'params.uri is required');
            const r = readResource(tree, uri);
            if (!r) return rpcError(id, RPC_INVALID_PARAMS, `Unknown resource: ${uri}`);
            return rpcResult(id, r);
        }
        case 'tools/list':
            return rpcResult(id, { tools: [] });
        case 'tools/call': {
            const name = typeof params.name === 'string' ? params.name : '';
            if (!name) return rpcError(id, RPC_INVALID_PARAMS, 'params.name is required');
            const env = notImplementedEnvelope(name);
            // Mirror the Worker: -32601 with the envelope in `data`; consumers
            // drive logic off `error.data.code`, never the wire message.
            return rpcError(id, RPC_METHOD_NOT_FOUND, env.message as string, env);
        }
        default:
            return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
}
