/**
 * The trace of one map-bench trial, read from `claude --output-format
 * stream-json --verbose` (H28): what the agent did, not only what it cost.
 * Redacted by construction — the trace holds tool names, paths, counts and
 * model ids, never message text, tool input bodies or tool results.
 */
import { createHash } from 'node:crypto';

export interface TrialTrace {
    turns: number;
    wall_s: number;
    models: string[];
    subtype: string;
    /** tool name → number of calls */
    tool_calls: Record<string, number>;
    /** reads of a path under `agents/map/` */
    map_reads: number;
    /** shell runs of `code-graph` */
    code_graph_runs: number;
    /** MCP `graph_*` tool calls */
    graph_tool_runs: number;
    /** distinct files read before the first edit; all reads when nothing was edited */
    files_read_before_first_edit: string[];
    /** the tools and MCP servers the session was given */
    tools: string[];
    mcp_servers: string[];
    /** the package version the arm ran under; `none` for an arm without the package */
    ac_version: string;
    /** first 16 hex of the SHA-256 of the injected system-prompt payload; `''` when none */
    payload_hash: string;
}

/** Every field a trial's trace must carry; `--check-trace-fields` fails on a missing one. */
export const TRACE_FIELDS: readonly (keyof TrialTrace)[] = [
    'turns',
    'wall_s',
    'models',
    'subtype',
    'tool_calls',
    'map_reads',
    'code_graph_runs',
    'graph_tool_runs',
    'files_read_before_first_edit',
    'tools',
    'mcp_servers',
    'ac_version',
    'payload_hash',
];

export const payloadHash = (payload: string | null): string => (payload ? createHash('sha256').update(payload).digest('hex').slice(0, 16) : '');

type Dict = Record<string, unknown>;
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'NotebookRead']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function pathOf(input: Dict): string | null {
    for (const k of ['file_path', 'path', 'notebook_path']) if (typeof input[k] === 'string') return input[k] as string;
    return null;
}

/** Parse a stream-json transcript (one JSON event per line) into a trace; unparseable lines are skipped. */
export function parseTrace(stream: string, meta: { wall_s: number; ac_version: string; payload: string | null; clone?: string }): TrialTrace {
    const t: TrialTrace = {
        turns: 0,
        wall_s: meta.wall_s,
        models: [],
        subtype: '',
        tool_calls: {},
        map_reads: 0,
        code_graph_runs: 0,
        graph_tool_runs: 0,
        files_read_before_first_edit: [],
        tools: [],
        mcp_servers: [],
        ac_version: meta.ac_version,
        payload_hash: payloadHash(meta.payload),
    };
    const models = new Set<string>();
    const before = new Set<string>();
    let edited = false;
    const rel = (p: string): string => (meta.clone && p.startsWith(`${meta.clone}/`) ? p.slice(meta.clone.length + 1) : p);
    for (const line of stream.split('\n')) {
        let ev: Dict;
        try {
            ev = JSON.parse(line) as Dict;
        } catch {
            continue;
        }
        if (ev === null || typeof ev !== 'object') continue;
        if (ev['type'] === 'system' && ev['subtype'] === 'init') {
            if (Array.isArray(ev['tools'])) t.tools = (ev['tools'] as unknown[]).map(String).sort();
            if (Array.isArray(ev['mcp_servers'])) t.mcp_servers = (ev['mcp_servers'] as Dict[]).map((s) => String(s?.['name'] ?? s)).sort();
            if (typeof ev['model'] === 'string') models.add(ev['model'] as string);
        }
        if (ev['type'] === 'assistant') {
            const msg = (ev['message'] ?? {}) as Dict;
            if (typeof msg['model'] === 'string') models.add(msg['model'] as string);
            for (const c of Array.isArray(msg['content']) ? (msg['content'] as Dict[]) : []) {
                if (c?.['type'] !== 'tool_use') continue;
                const name = String(c['name'] ?? '?');
                const input = (c['input'] ?? {}) as Dict;
                t.tool_calls[name] = (t.tool_calls[name] ?? 0) + 1;
                if (name.startsWith('mcp__') && /__graph_/.test(name)) t.graph_tool_runs += 1;
                if (name === 'Bash' && /\bcode-graph\b|code_graph\/cli/.test(String(input['command'] ?? ''))) t.code_graph_runs += 1;
                const p = pathOf(input);
                if (p && READ_TOOLS.has(name)) {
                    if (/(^|\/)agents\/map\//.test(rel(p))) t.map_reads += 1;
                    if (!edited) before.add(rel(p));
                }
                if (EDIT_TOOLS.has(name)) edited = true;
            }
        }
        if (ev['type'] === 'result') {
            t.turns = Number(ev['num_turns'] ?? 0) || 0;
            t.subtype = String(ev['subtype'] ?? '');
            for (const m of Object.keys((ev['modelUsage'] ?? {}) as Dict)) models.add(m);
        }
    }
    t.models = [...models].sort();
    t.files_read_before_first_edit = [...before].sort();
    return t;
}

/** The fields of `TRACE_FIELDS` a trace lacks. */
export function missingTraceFields(t: Partial<TrialTrace> | null | undefined): string[] {
    return TRACE_FIELDS.filter((f) => t?.[f] === undefined || t?.[f] === null);
}
