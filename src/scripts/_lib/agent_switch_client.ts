/**
 * The agent-switch link client (docs/contracts/agent-switch-link.md).
 *
 * `agentSwitchCall` calls one link tool: over the stdio MCP server first, then
 * over the matching CLI verb. Every failure is `null` — the caller then behaves
 * exactly as it did before the link existed, because AC never depends on
 * agent-switch.
 *
 * Nothing here moves a session or decides for the user. `switch_decide` is
 * callable because the user's answer has to reach agent-switch; when to call it
 * is the caller's obligation, and the host confirms the call.
 */
import { type LinkOptions, type LinkStatus, probeLink, runAgentSwitch, spawnEnv } from './agent_switch_link.js';

const CALL_TIMEOUT_MS = 10000;

/** The link's status when it is usable; `null` for every other state. */
export function linkStatus(opts: LinkOptions = {}): LinkStatus | null {
    const p = probeLink(opts);
    return p.state === 'present' ? p.status : null;
}

export type LinkTool =
    | 'link_status'
    | 'limits_get'
    | 'session_whoami'
    | 'switch_list'
    | 'switch_status'
    | 'switch_request'
    | 'switch_decide';

type Args = Record<string, unknown>;

/** A string argument usable as one argv word: non-empty and never read as a flag. */
function word(args: Args, key: string): string | undefined | null {
    const v = args[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'string' || v === '' || v.startsWith('-')) return null;
    return v;
}

const DECISIONS = new Set(['approve', 'decline', 'snooze']);
const HOWS = new Set(['after-turn', 'now', 'handoff']);

/**
 * The CLI argv for a tool, or `null` when the CLI cannot express the call.
 *
 * A value starting with `-` is refused: `switch decide … --executed` records an
 * approval as already carried out, so a value that parses as a flag would let an
 * argument skip the move agent-switch is supposed to make.
 */
export function cliArgsFor(tool: LinkTool, args: Args): string[] | null {
    switch (tool) {
        case 'link_status':
            return ['link', 'status', '--json'];
        case 'limits_get': {
            const provider = word(args, 'provider');
            if (provider === null) return null;
            return provider === undefined ? ['limits', '--json'] : ['limits', provider, '--json'];
        }
        case 'switch_list':
            return ['switch', 'list', ...(args['all'] === true ? ['--all'] : []), '--json'];
        case 'switch_status': {
            const id = word(args, 'id');
            return typeof id === 'string' ? ['switch', 'show', id, '--json'] : null;
        }
        case 'switch_request': {
            const session = word(args, 'session');
            const account = word(args, 'account');
            if (session === null || account === null) return null;
            if (session !== undefined) return ['switch', 'request', '--session', session, '--by', 'ac', '--json'];
            if (account !== undefined) return ['switch', 'request', '--account', account, '--by', 'ac', '--json'];
            return null;
        }
        case 'switch_decide': {
            const id = word(args, 'id');
            const decision = word(args, 'decision');
            const target = word(args, 'target');
            const how = word(args, 'how');
            if (typeof id !== 'string' || typeof decision !== 'string' || !DECISIONS.has(decision)) return null;
            if (target === null || how === null || (how !== undefined && !HOWS.has(how))) return null;
            const extra =
                decision === 'approve'
                    ? [...(target !== undefined ? ['--to', target] : []), ...(how !== undefined ? ['--how', how] : [])]
                    : [];
            return ['switch', 'decide', id, decision, ...extra, '--by', 'ac', '--json'];
        }
        case 'session_whoami':
            return null;
    }
}

interface ToolResult {
    content?: { type: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
}

/** The JSON a tool returned: its text, which carries arrays unwrapped. */
function toolJson(res: ToolResult): unknown {
    if (res.isError === true) return null;
    const text = res.content?.find((c) => c.type === 'text')?.text;
    if (typeof text !== 'string') return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function viaMcp(status: LinkStatus, tool: LinkTool, args: Args, opts: LinkOptions): Promise<unknown> {
    // Lazy: the SDK is loaded only when something actually calls the link.
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
        import('@modelcontextprotocol/sdk/client/index.js'),
        import('@modelcontextprotocol/sdk/client/stdio.js'),
    ]);
    const transport = new StdioClientTransport({
        command: status.mcp.command,
        args: status.mcp.args,
        env: spawnEnv(opts),
        stderr: 'ignore',
        ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    });
    const client = new Client({ name: 'agent-config', version: '1' });
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('agent-switch MCP call timed out')), CALL_TIMEOUT_MS);
    });
    try {
        return await Promise.race([
            (async () => {
                await client.connect(transport);
                return toolJson((await client.callTool({ name: tool, arguments: args })) as ToolResult);
            })(),
            timeout,
        ]);
    } finally {
        clearTimeout(timer);
        await client.close().catch(() => undefined);
    }
}

function viaCli(tool: LinkTool, args: Args, opts: LinkOptions): unknown {
    const argv = cliArgsFor(tool, args);
    if (argv === null) return null;
    const r = runAgentSwitch(argv, opts, CALL_TIMEOUT_MS);
    if (r.status !== 0) return null;
    try {
        return JSON.parse(r.stdout);
    } catch {
        return null;
    }
}

/**
 * Call one link tool. MCP first, the CLI verb second, `null` when both fail or
 * the link is not present.
 */
export async function agentSwitchCall(tool: LinkTool, args: Args = {}, opts: LinkOptions = {}): Promise<unknown> {
    const status = linkStatus(opts);
    if (status === null) return null;
    let result: unknown = null;
    try {
        result = await viaMcp(status, tool, args, opts);
    } catch {
        result = null;
    }
    return result ?? viaCli(tool, args, opts);
}
