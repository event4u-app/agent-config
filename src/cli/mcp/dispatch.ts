/**
 * Pure JSON-RPC dispatch for the local stdio-lite MCP server (ADR-207).
 *
 * Wire shapes are mirrored VERBATIM from the hosted Worker
 * (`internal/workers/mcp/src/{handlers,prompts,resources}.ts`) so the local
 * stdio surface and the hosted HTTP surface return identical envelopes —
 * the multi-channel-consistency guarantee. If you change a shape here, change
 * it there too (and the kernel `src/scripts/mcp_server/`).
 *
 * Read-only, and still read-only after Phase 1.1 of
 * `road-to-skill-delivery-over-mcp`: `tools/list` now returns exactly TWO
 * discovery tools — `suggest_skill_for_task` and `read_skill` — both of which
 * only read the in-memory content tree. Execution (the `full` kernel) remains
 * deferred per ADR-085 § Phase-2 trigger, and every other tool name still gets
 * the `not_implemented` envelope. Pure — no I/O, no clock, no stdout.
 *
 * WHY THESE TWO AND NOT MORE. The turnkey server is small enough to load
 * upfront (Claude Code defers MCP tool definitions only above ~10% of context),
 * so every tool here is standing cost in every session. `LITE_TOOLS_TOKEN_CAP`
 * below is that budget, asserted in `tests/scripts/mcp_lite_tools.test.ts`.
 * `list_skills` is deliberately absent: the host already lists the names, and a
 * 290-name tool result is the context cost this whole surface exists to avoid.
 *
 * The read-only boundary itself is accepted policy, owned with its revisit
 * trigger by ADR-112 and restated as the distribution shape by ADR-207 on
 * Node-only grounds; Phase 1.1 widens what is READ, never what is executed.
 */

import { rankSkills, type RankableSkill } from '../../shared/skillRanking.js';
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

/**
 * Server `instructions` (Phase 1.2).
 *
 * The AAIF Skills-over-MCP working group's June-2026 experiments found models
 * routinely ignoring skills served over MCP and reaching for tools instead, and
 * found that a server-side instruction nudge helped. This is that nudge, and it
 * is the ONE positive finding from that work applied here — its decay with
 * context length is a measurement (Phase 4.3), not something this paragraph
 * fixes. Derived from the Iron Law of `rules/missing-skill-recovery.md`.
 */
export const INSTRUCTIONS =
    'This server indexes the full skill catalogue, including skills the host ' +
    'listed without a description or did not list at all. A skill missing from ' +
    'the catalogue still exists: ask by task with suggest_skill_for_task, then ' +
    'read the winner with read_skill. Never conclude that no skill covers a ' +
    'task from the list you were shown.';

/** Standing-context budget for the two tool definitions, in tokens (chars/4). */
export const LITE_TOOLS_TOKEN_CAP = 600;
/** Byte cap on `INSTRUCTIONS`, so the nudge cannot grow into a preamble. */
export const INSTRUCTIONS_BYTE_CAP = 400;

/**
 * The two discovery tools. Read-only, shell-free, and pure over the content
 * tree — `read_skill` resolves a NAME through the tree's uri map and never
 * joins a path, so directory traversal is not merely rejected but unexpressible.
 */
export const LITE_TOOLS: readonly Record<string, unknown>[] = [
    {
        name: 'suggest_skill_for_task',
        description:
            'Rank skills against a free-form task description. Use when the ' +
            'skill you need is not in the catalogue the host delivered, so ' +
            'asking by name is impossible and asking by task is not. Returns ' +
            'names, scores and personas only — never bodies.',
        inputSchema: {
            type: 'object',
            required: ['task'],
            properties: {
                task: { type: 'string', description: 'The task to match skills against.' },
                limit: { type: 'integer', minimum: 1, default: 5, description: 'Max results. Default 5.' },
            },
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
    },
    {
        name: 'read_skill',
        description:
            'Return one skill body by name, as listed by suggest_skill_for_task.',
        inputSchema: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string', description: 'Skill name.' } },
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
    },
];

const LITE_TOOL_NAMES: ReadonlySet<string> = new Set(LITE_TOOLS.map((t) => t.name as string));

/**
 * Is this name one of the two tools this surface actually runs?
 *
 * Exported so the impure transport shell can classify a call's outcome without
 * re-deriving the tool list — one reader of one fact, the same discipline
 * `describeHostCapabilities` applies to the capability manifest.
 */
export function isLiteTool(name: string): boolean {
    return LITE_TOOL_NAMES.has(name);
}

/** Chars/4 over the served `tools/list` payload — the figure the cap is on. */
export function liteToolsTokenCost(): number {
    return Math.round(JSON.stringify({ tools: LITE_TOOLS }).length / 4);
}

/** MCP `tools/call` success shape: text content plus the structured result. */
function toolTextResult(payload: unknown): Record<string, unknown> {
    return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        structuredContent: payload,
        isError: false,
    };
}

function rankableSkills(tree: ContentTree): RankableSkill[] {
    return entriesOfKind(tree, ['skill']).map((e) => ({
        name: e.name,
        description: e.description,
        personas: e.personas ?? [],
        triggerText: e.trigger_text ?? [],
    }));
}

/**
 * Phase 3.3 — when the host already lists a skill WITH its description,
 * returning it from the recovery tool is noise. Filter Tier A out if a split
 * exists on this machine; return everything and say `tiers: unknown` if not.
 *
 * The filter deliberately does NOT apply when it would empty the result. A
 * ranked list that went empty only because every match was Tier A is
 * indistinguishable, to the caller, from "no skill covers this" — which is the
 * exact wrong conclusion `missing-skill-recovery.md` exists to prevent.
 */
function tierState(tree: ContentTree): 'unknown' | 'tier-b-only' {
    return tree.tier_a ? 'tier-b-only' : 'unknown';
}

/**
 * `suggest_skill_for_task`. Mirrors the kernel handler's envelope — `status`,
 * `suggestions[]` of `{skill, score, personas}` — so a consumer that learned the
 * shape on one server does not have to relearn it on the other. `tiers` is
 * Phase 3.3's field and reports `unknown` until a tier file is wired in.
 */
function suggestSkillForTask(tree: ContentTree, params: Record<string, unknown>): Record<string, unknown> {
    const task = typeof params.task === 'string' ? params.task.trim() : '';
    if (!task) return { status: 'error', error: 'params.task is required', suggestions: [] };
    const rawLimit = typeof params.limit === 'number' ? Math.floor(params.limit) : 5;
    const limit = Math.max(1, rawLimit);
    const skills = rankableSkills(tree);
    if (skills.length === 0) {
        return { status: 'no_catalogue', suggestions: [], tiers: 'unknown' };
    }
    const all = rankSkills(task, skills);
    const tiers = tierState(tree);
    const tierA = tree.tier_a;
    const filtered = tierA ? all.filter((r) => !tierA.has(r.name)) : all;
    // Never let the tier filter turn a real match into an empty answer.
    const kept = filtered.length > 0 ? filtered : all;
    return {
        status: 'ok',
        skills_indexed: skills.length,
        tiers,
        ...(tierA && filtered.length === 0 && all.length > 0 ? { tier_filter: 'bypassed-to-avoid-empty' } : {}),
        suggestions: kept.slice(0, limit).map((r) => ({ skill: r.name, score: r.score, personas: r.personas })),
    };
}

/** `read_skill`. Name lookup through the uri map; no path is ever constructed. */
function readSkill(tree: ContentTree, params: Record<string, unknown>): Record<string, unknown> {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return { status: 'error', error: 'params.name is required' };
    // Structurally unnecessary — the lookup is a map hit on `skill://<name>` and
    // cannot escape anywhere — but rejected explicitly so a reader does not have
    // to reconstruct that argument, and so a future path-based backend inherits
    // the guard rather than the hole.
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
        return { status: 'error', error: 'skill name must not contain a path separator' };
    }
    const entry = tree.uris[`skill://${name}`];
    if (!entry || entry.kind !== 'skill') {
        return { status: 'not_found', name };
    }
    return {
        status: 'ok',
        name: entry.name,
        description: entry.description,
        source: entry.source,
        body: entry.body,
    };
}

/** Read-only lite surface: only the two discovery tools. ADR-085 defers `full`. */
function notImplementedEnvelope(name: string): Record<string, unknown> {
    return {
        code: 'not_implemented',
        message:
            `Tool '${name}' is not available on the local stdio-lite surface ` +
            `(read-only, ADR-112). Execution is deferred; self-host the kernel ` +
            `(src/scripts/mcp_server/) for tool execution.`,
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
                instructions: INSTRUCTIONS,
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
            return rpcResult(id, { tools: LITE_TOOLS });
        case 'tools/call': {
            const name = typeof params.name === 'string' ? params.name : '';
            if (!name) return rpcError(id, RPC_INVALID_PARAMS, 'params.name is required');
            if (LITE_TOOL_NAMES.has(name)) {
                const args = (params.arguments ?? {}) as Record<string, unknown>;
                const payload =
                    name === 'suggest_skill_for_task'
                        ? suggestSkillForTask(tree, args)
                        : readSkill(tree, args);
                return rpcResult(id, toolTextResult(payload));
            }
            const env = notImplementedEnvelope(name);
            // Mirror the Worker: -32601 with the envelope in `data`; consumers
            // drive logic off `error.data.code`, never the wire message.
            return rpcError(id, RPC_METHOD_NOT_FOUND, env.message as string, env);
        }
        default:
            return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
}
