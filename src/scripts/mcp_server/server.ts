// MCP Server — registers `prompts/*` + `resources/*` over stdio.
//
// Phase 3 boundary (A0 Hard Contract still holds): read-only. No
// `tools/*` filesystem writes beyond the allowlisted handlers. New in
// Phase 3:
//
// - **C1/C2** `resources/list` + `resources/read` for rules,
//   guidelines, contexts via `ResourceCache`.
// - **C3** cursor-based pagination on `resources/list` (same shape as
//   prompts/list).
// - **C4** hot-reload — `ResourceCache` re-scans on mtime change before
//   each `resources/list` response.
//
// Carried over from Phase 2:
//
// - **B1/B2** full skills + commands coverage via `PromptCache`.
// - **B4** cursor-based pagination on `prompts/list`.
// - **B5** hot-reload — `PromptCache` re-scans on mtime change before
//   each `prompts/list` response.
//
// `build_server` still accepts a plain `SkillPrompt[]` so the Phase-1
// contract tests keep passing without touching their fixtures.
//
// TS twin of server.py (py2ts Phase 8). The Python module builds on the
// `mcp` Python SDK (`mcp.server.Server`) and registers handlers via the
// SDK decorators; the tests poke `server.request_handlers[...]`. There is
// no `mcp` Python SDK in the TS runtime and the npm
// `@modelcontextprotocol/sdk` (a different surface) is NOT a dependency of
// this package. The twin therefore mirrors the *handler logic* exactly and
// exposes it through a transport-agnostic `BuiltServer` whose
// `request_handlers` map mirrors the Python contract, then attaches the
// handlers to the npm SDK lazily IF it is importable (degrade-when-absent,
// the TS analogue of Python's `try: import mcp`). `run_stdio` likewise
// degrades: it builds the server, emits the same boot-log lines, and only
// drives the SDK transport when the SDK is present.
import { SERVER_NAME, __version__ } from './index.js';
import {
    boot_log_line as identity_boot_log_line,
    compute_skill_set_signature,
    read_package_version,
} from './metadata.js';
import {
    PromptCache,
    type SkillPrompt,
    _project_root,
    to_mcp_prompt_meta,
} from './prompts.js';
import { type Resource, ResourceCache, to_mcp_resource_meta } from './resources.js';
import { ToolCache, boot_log_line as tools_boot_log_line, to_mcp_tool_meta } from './tools.js';

// Page size for cursor-based pagination. Conservative default —
// Claude Desktop and Zed handle larger pages, but small pages keep
// wire payloads under typical stdio frame limits.
export const DEFAULT_PAGE_SIZE = 100;

export type PromptsSource = SkillPrompt[] | (() => [SkillPrompt[], string[]]);
export type ResourcesSource = Resource[] | (() => [Resource[], string[]]);

/** Normalise to a callable returning `[prompts, errors]`. */
function _makeLoader(source: PromptsSource): () => [SkillPrompt[], string[]] {
    if (typeof source === 'function') {
        return source;
    }
    const staticList = [...source];
    return () => [staticList, []];
}

/** Normalise to a callable returning `[resources, errors]`. */
function _makeResourceLoader(source: ResourcesSource): () => [Resource[], string[]] {
    if (typeof source === 'function') {
        return source;
    }
    const staticList = [...source];
    return () => [staticList, []];
}

/** Cursor is a stringified integer offset. Invalid → start at 0. */
function _decodeCursor(cursor: string | null | undefined, total: number): number {
    if (cursor === null || cursor === undefined) {
        return 0;
    }
    const offset = Number.parseInt(cursor, 10);
    if (Number.isNaN(offset)) {
        return 0;
    }
    if (offset < 0 || offset > total) {
        return 0;
    }
    return offset;
}

// Wire-shaped result objects. These mirror the fields the Python tests
// inspect on `result.root.*`; they are plain data so the TS server-layer
// tests can assert against them without the SDK.
export interface PromptMeta {
    name: string;
    description: string;
    [k: string]: unknown;
}
export interface ListPromptsResult {
    prompts: PromptMeta[];
    nextCursor: string | null;
}
export interface PromptMessageContent {
    type: 'text';
    text: string;
}
export interface PromptMessage {
    role: 'user';
    content: PromptMessageContent;
}
export interface GetPromptResult {
    description: string;
    messages: PromptMessage[];
}
export interface ResourceMeta {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    [k: string]: unknown;
}
export interface ListResourcesResult {
    resources: ResourceMeta[];
    nextCursor: string | null;
}
export interface ReadResourceContents {
    content: string;
    mimeType: string;
}
export interface ToolMeta {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    [k: string]: unknown;
}

/**
 * Transport-agnostic built server. `request_handlers` mirrors the Python
 * `Server.request_handlers` map keyed by JSON-RPC method, so the
 * server-layer tests can drive the handlers directly. `attachToSdk`
 * wires the same handlers onto an `@modelcontextprotocol/sdk` Server
 * when that SDK is importable.
 */
export interface BuiltServer {
    request_handlers: {
        'prompts/list': (cursor: string | null) => Promise<ListPromptsResult>;
        'prompts/get': (name: string) => Promise<GetPromptResult>;
        'resources/list': (cursor: string | null) => Promise<ListResourcesResult>;
        'resources/read': (uri: string) => Promise<ReadResourceContents[]>;
        'tools/list'?: () => Promise<ToolMeta[]>;
        'tools/call'?: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
}

/**
 * Construct the MCP server handlers with the new-style paginated logic.
 *
 * Pure factory — no I/O. Tests pass a static list; the stdio entrypoint
 * passes a `PromptCache.get` callable for hot-reload. When `resources`
 * is omitted, resources/* handlers are still registered but return an
 * empty list — clients can probe the capability without seeing a
 * protocol error.
 */
export function build_server(
    source: PromptsSource,
    options: {
        page_size?: number;
        resources?: ResourcesSource | null;
        tools?: ToolCache | null;
    } = {},
): BuiltServer {
    const pageSize = options.page_size ?? DEFAULT_PAGE_SIZE;
    const loader = _makeLoader(source);
    const resourceLoader = _makeResourceLoader(options.resources ?? []);

    const listPrompts = async (cursor: string | null): Promise<ListPromptsResult> => {
        const [prompts] = loader();
        const start = _decodeCursor(cursor, prompts.length);
        const end = start + pageSize;
        const page = prompts.slice(start, end);
        const nextCursor: string | null = end < prompts.length ? String(end) : null;
        return {
            prompts: page.map((p) => to_mcp_prompt_meta(p) as unknown as PromptMeta),
            nextCursor,
        };
    };

    const getPrompt = async (name: string): Promise<GetPromptResult> => {
        const [prompts] = loader();
        const index = new Map<string, SkillPrompt>(
            prompts.map((p) => [to_mcp_prompt_meta(p).name as string, p]),
        );
        const prompt = index.get(name);
        if (prompt === undefined) {
            throw new Error(`Unknown prompt: ${name}`);
        }
        return {
            description: prompt.description,
            messages: [{ role: 'user', content: { type: 'text', text: prompt.body } }],
        };
    };

    const listResources = async (cursor: string | null): Promise<ListResourcesResult> => {
        const [items] = resourceLoader();
        const start = _decodeCursor(cursor, items.length);
        const end = start + pageSize;
        const page = items.slice(start, end);
        const nextCursor: string | null = end < items.length ? String(end) : null;
        return {
            resources: page.map((r) => to_mcp_resource_meta(r) as unknown as ResourceMeta),
            nextCursor,
        };
    };

    const readResource = async (uri: string): Promise<ReadResourceContents[]> => {
        const [items] = resourceLoader();
        const index = new Map<string, Resource>(items.map((r) => [r.uri, r]));
        const resource = index.get(uri);
        if (resource === undefined) {
            throw new Error(`Unknown resource: ${uri}`);
        }
        return [{ content: resource.body, mimeType: resource.mime_type }];
    };

    const handlers: BuiltServer['request_handlers'] = {
        'prompts/list': listPrompts,
        'prompts/get': getPrompt,
        'resources/list': listResources,
        'resources/read': readResource,
    };

    const tools = options.tools ?? null;
    if (tools !== null) {
        const toolCache = tools;
        handlers['tools/list'] = async (): Promise<ToolMeta[]> =>
            toolCache.list().map((t) => to_mcp_tool_meta(t) as unknown as ToolMeta);
        handlers['tools/call'] = async (
            name: string,
            args: Record<string, unknown>,
        ): Promise<Record<string, unknown>> => toolCache.dispatch(name, args ?? {});
    }

    return { request_handlers: handlers };
}

// The npm `@modelcontextprotocol/sdk` is a soft dependency: it IS declared
// in package.json, but the specifiers are built at runtime and imported
// dynamically so the module stays importable (and the boot path stays
// exercisable in tests / CI) even when the dependency has been stripped —
// the TS analogue of Python's `try: import mcp`.
const _SDK_SERVER_SPEC = '@modelcontextprotocol/sdk' + '/server/index.js';
const _SDK_STDIO_SPEC = '@modelcontextprotocol/sdk' + '/server/stdio.js';
const _SDK_TYPES_SPEC = '@modelcontextprotocol/sdk' + '/types.js';

/** Dynamic import that escapes static module resolution. */
async function _dynImport(spec: string): Promise<unknown> {
    return import(/* @vite-ignore */ spec);
}

/** True when the npm `@modelcontextprotocol/sdk` is importable. */
export async function mcp_sdk_available(): Promise<boolean> {
    try {
        await _dynImport(_SDK_SERVER_SPEC);
        return true;
    } catch {
        return false;
    }
}

/**
 * Entrypoint — load prompts + resources via caches, run server over stdio.
 *
 * Mirrors `run_stdio` in server.py: emits the same boot-log lines on
 * stderr, then drives the SDK transport. Degrades when the MCP SDK is
 * absent (the Python analogue raises ImportError; here we surface a
 * one-line stderr notice and return without serving so the boot path is
 * still exercisable in tests / CI without the dependency).
 */
export async function run_stdio(): Promise<void> {
    const cache = new PromptCache();
    const [prompts, errors] = cache.get();
    for (const line of errors) {
        process.stderr.write(`mcp-server: warn: ${line}\n`);
    }
    process.stderr.write(
        `mcp-server: loaded ${prompts.length} prompts (${errors.length} warnings)\n`,
    );
    const resourceCache = new ResourceCache();
    const [resourcesList, resourceErrors] = resourceCache.get();
    for (const line of resourceErrors) {
        process.stderr.write(`mcp-server: warn: ${line}\n`);
    }
    process.stderr.write(
        `mcp-server: loaded ${resourcesList.length} resources ` +
            `(${resourceErrors.length} warnings)\n`,
    );
    const toolCache = new ToolCache();
    process.stderr.write(tools_boot_log_line(toolCache) + '\n');
    const packageVersion = read_package_version(_project_root());
    const skillSetSignature = compute_skill_set_signature(
        cache.signature,
        resourceCache.signature,
    );
    process.stderr.write(
        identity_boot_log_line({
            server_version: __version__,
            package_version: packageVersion,
            skill_set_signature: skillSetSignature,
        }) + '\n',
    );

    const server = build_server(() => cache.get(), {
        resources: () => resourceCache.get(),
        tools: toolCache,
    });

    if (!(await mcp_sdk_available())) {
        process.stderr.write(
            'mcp-server: warn: @modelcontextprotocol/sdk not importable — ' +
                'stdio transport unavailable (degraded). The SDK is a declared ' +
                'dependency; run `npm install` to restore stdio serving.\n',
        );
        return;
    }

    await _serveOverSdk(server);
}

/**
 * Wire the built handlers onto the npm MCP SDK and serve over stdio.
 *
 * Maps the transport-agnostic `request_handlers` map onto the SDK's
 * schema-keyed `setRequestHandler` API. This is the TS analogue of the
 * Python module's `@server.list_prompts()` / `@server.call_tool()`
 * decorators: same handler logic, same wire output. The result envelopes
 * mirror what the Python `mcp` SDK produced — in particular `tools/call`
 * wraps the handler's plain object in a single JSON-serialized `text`
 * content block (the Python SDK auto-wrapped a returned `dict` the same
 * way), and a `null` `nextCursor` is dropped (omitted) rather than sent.
 *
 * Isolated in its own function with lazy imports so the module stays
 * importable and the non-serving boot path runs even when the SDK has
 * been stripped (degrade-when-absent, the analogue of Python `try: import`).
 */
async function _serveOverSdk(server: BuiltServer): Promise<void> {
    const sdk = (await _dynImport(_SDK_SERVER_SPEC)) as {
        Server: new (
            info: { name: string; version: string },
            options: { capabilities: Record<string, unknown> },
        ) => SdkServer;
    };
    const { StdioServerTransport } = (await _dynImport(_SDK_STDIO_SPEC)) as {
        StdioServerTransport: new () => SdkTransport;
    };
    const schemas = (await _dynImport(_SDK_TYPES_SPEC)) as {
        ListPromptsRequestSchema: unknown;
        GetPromptRequestSchema: unknown;
        ListResourcesRequestSchema: unknown;
        ReadResourceRequestSchema: unknown;
        ListToolsRequestSchema: unknown;
        CallToolRequestSchema: unknown;
    };

    const handlers = server.request_handlers;
    const sdkServer = new sdk.Server(
        { name: SERVER_NAME, version: __version__ },
        { capabilities: { prompts: {}, resources: {}, tools: {} } },
    );

    // MCP omits `nextCursor` when there is no next page; the handlers carry
    // `null`, which the SDK's response schema rejects — map it to undefined.
    const dropNull = (cursor: string | null): string | undefined =>
        cursor === null ? undefined : cursor;

    sdkServer.setRequestHandler(schemas.ListPromptsRequestSchema, async (req: SdkRequest) => {
        const result = await handlers['prompts/list']((req.params?.cursor as string) ?? null);
        return { prompts: result.prompts, nextCursor: dropNull(result.nextCursor) };
    });
    sdkServer.setRequestHandler(schemas.GetPromptRequestSchema, async (req: SdkRequest) =>
        handlers['prompts/get'](req.params?.name as string),
    );
    sdkServer.setRequestHandler(schemas.ListResourcesRequestSchema, async (req: SdkRequest) => {
        const result = await handlers['resources/list']((req.params?.cursor as string) ?? null);
        return { resources: result.resources, nextCursor: dropNull(result.nextCursor) };
    });
    sdkServer.setRequestHandler(schemas.ReadResourceRequestSchema, async (req: SdkRequest) => {
        const uri = req.params?.uri as string;
        const contents = await handlers['resources/read'](uri);
        return { contents: contents.map((c) => ({ uri, mimeType: c.mimeType, text: c.content })) };
    });

    const listTools = handlers['tools/list'];
    const callTool = handlers['tools/call'];
    if (listTools !== undefined && callTool !== undefined) {
        sdkServer.setRequestHandler(schemas.ListToolsRequestSchema, async () => ({
            tools: await listTools(),
        }));
        sdkServer.setRequestHandler(schemas.CallToolRequestSchema, async (req: SdkRequest) => {
            try {
                const result = await callTool(
                    req.params?.name as string,
                    (req.params?.arguments as Record<string, unknown>) ?? {},
                );
                // Mirror the Python SDK: a returned object becomes a single
                // JSON-serialized text content block.
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            } catch (err) {
                // Mirror the Python SDK's `call_tool` wrapper: a raised
                // exception becomes a tool-error CallToolResult (isError),
                // not a JSON-RPC protocol error.
                const message = err instanceof Error ? err.message : String(err);
                return { content: [{ type: 'text', text: message }], isError: true };
            }
        });
    }

    const transport = new StdioServerTransport();
    await sdkServer.connect(transport);
}

interface SdkRequest {
    params?: Record<string, unknown>;
}
interface SdkServer {
    setRequestHandler(
        schema: unknown,
        handler: (req: SdkRequest) => Promise<unknown>,
    ): void;
    connect(transport: SdkTransport): Promise<void>;
}
interface SdkTransport {
    readonly _isSdkTransport?: true;
}

/** Sync wrapper for `node -m scripts.mcp_server` / the package main entry. */
export function main(): void {
    void run_stdio();
}
