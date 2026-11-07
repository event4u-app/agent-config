/**
 * The agent-switch link probe (docs/contracts/agent-switch-link.md).
 *
 * `probeLink` asks `agent-switch link status --json` whether AC may connect and
 * which contract it speaks. Install reads it to write or remove the `.mcp.json`
 * entry, `mcp:available` to report it. Calling a link tool is
 * `agent_switch_client.ts`.
 */
import { spawnSync } from 'node:child_process';

import { hardenedSpawnEnv } from './spawn_env.js';

/** The link contract this build speaks. Any other value is treated as absent. */
export const LINK_CONTRACT = 1;
/** The `.mcp.json` key the installer owns for the link. */
export const AGENT_SWITCH_MCP_KEY = 'agent-switch';

const PROBE_TIMEOUT_MS = 5000;

export interface LinkStatus {
    enabled: true;
    version: string;
    contract: typeof LINK_CONTRACT;
    mcp: { command: string; args: string[] };
}

/**
 * Why the link is or is not usable. The installer needs the distinction that
 * `linkStatus` folds away: `disabled` and `incompatible` are answers from
 * agent-switch and remove the entry; `absent` and `failed` are no answer and
 * leave it as it is.
 */
export type LinkProbe =
    | { state: 'present'; status: LinkStatus }
    | { state: 'disabled' | 'incompatible' | 'absent' | 'failed'; detail: string };

export interface LinkOptions {
    /** Extra environment for the spawned process (tests inject PATH here). */
    env?: Record<string, string>;
    cwd?: string;
}

export function spawnEnv(opts: LinkOptions): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(hardenedSpawnEnv(opts.env ?? {}))) {
        if (typeof v === 'string') out[k] = v;
    }
    return out;
}

export interface RunOutcome {
    missing: boolean;
    status: number | null;
    stdout: string;
}

export function runAgentSwitch(args: readonly string[], opts: LinkOptions, timeout: number): RunOutcome {
    const r = spawnSync('agent-switch', [...args], {
        cwd: opts.cwd ?? process.cwd(),
        encoding: 'utf-8',
        timeout,
        env: spawnEnv(opts),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.error) {
        return { missing: (r.error as NodeJS.ErrnoException).code === 'ENOENT', status: null, stdout: '' };
    }
    return { missing: false, status: r.status, stdout: String(r.stdout ?? '') };
}

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function probeLink(opts: LinkOptions = {}): LinkProbe {
    const r = runAgentSwitch(['link', 'status', '--json'], opts, PROBE_TIMEOUT_MS);
    if (r.missing) return { state: 'absent', detail: '`agent-switch` is not on PATH' };
    if (r.status !== 0) {
        return { state: 'failed', detail: `\`agent-switch link status\` exited ${String(r.status ?? 'without a status')}` };
    }
    let doc: unknown;
    try {
        doc = JSON.parse(r.stdout);
    } catch {
        return { state: 'failed', detail: '`agent-switch link status --json` did not print JSON' };
    }
    if (doc === null || typeof doc !== 'object') {
        return { state: 'failed', detail: '`agent-switch link status --json` printed no object' };
    }
    const d = doc as Record<string, unknown>;
    if (d['enabled'] === false) return { state: 'disabled', detail: 'the link is off in agent-switch' };
    if (d['contract'] !== LINK_CONTRACT) {
        return { state: 'incompatible', detail: `agent-switch speaks link contract ${JSON.stringify(d['contract'])}, this build speaks ${LINK_CONTRACT}` };
    }
    const mcp = d['mcp'] as Record<string, unknown> | undefined;
    if (d['enabled'] !== true || typeof d['version'] !== 'string' || !mcp || typeof mcp['command'] !== 'string' || mcp['command'] === '' || !isStringArray(mcp['args'])) {
        return { state: 'failed', detail: '`agent-switch link status --json` is missing a contract field' };
    }
    return {
        state: 'present',
        status: { enabled: true, version: d['version'], contract: LINK_CONTRACT, mcp: { command: mcp['command'], args: mcp['args'] } },
    };
}
