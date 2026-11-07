/**
 * The agent-switch limits read (docs/contracts/agent-switch-link.md § Limits report).
 *
 * agent-switch observes every account's plan windows; AC reads that cache
 * instead of guessing. Every reading is an observation, never a reservation, and
 * anything the contract calls unknown is left out rather than defaulted: a stale
 * account is neither usable nor full, and a window without a fill says nothing.
 */
import { agentSwitchCall } from './agent_switch_client.js';
import type { LinkOptions } from './agent_switch_link.js';
import { isAccount } from './quota_ledger.js';

export interface LimitsWindow {
    readonly key: string;
    /** 0–100. */
    readonly fill: number;
    readonly resetsAt: string | null;
}

export interface LimitsAccount {
    /** `provider/name`, the same label the quota ledger uses. */
    readonly id: string;
    readonly provider: string;
    readonly name: string;
    readonly disabled: boolean;
    /** Enabled, fresh, and under `thresholdPct` in every live window. */
    readonly usable: boolean;
    readonly why: string | null;
    readonly thresholdPct: number | null;
    readonly observedAt: string | null;
    readonly windows: readonly LimitsWindow[];
}

export interface LimitsReport {
    readonly at: string;
    /** Fresh accounts only; a stale one is absent, which is how the contract's "unknown" reads here. */
    readonly accounts: readonly LimitsAccount[];
}

export type LimitsProvider = 'claude' | 'codex' | 'antigravity';

function obj(x: unknown): Record<string, unknown> | null {
    return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function stringOrNull(x: unknown): string | null | undefined {
    return x === null || typeof x === 'string' ? x : undefined;
}

function readWindow(raw: unknown): LimitsWindow | null {
    const w = obj(raw);
    if (w === null || typeof w['key'] !== 'string') return null;
    const fill = w['fill'];
    if (typeof fill !== 'number' || !Number.isFinite(fill) || fill < 0 || fill > 100) return null;
    const resetsAt = stringOrNull(w['resetsAt']);
    if (resetsAt === undefined) return null;
    return { key: w['key'], fill, resetsAt };
}

function readAccount(raw: unknown): LimitsAccount | null {
    const a = obj(raw);
    if (a === null || a['stale'] !== false) return null;
    const id = a['id'];
    if (!isAccount(id)) return null;
    const [provider = '', name = ''] = id.split('/');
    if (a['provider'] !== provider || a['name'] !== name) return null;
    if (typeof a['disabled'] !== 'boolean' || typeof a['usable'] !== 'boolean') return null;
    const why = stringOrNull(a['why']);
    const observedAt = stringOrNull(a['observedAt']);
    const threshold = a['thresholdPct'];
    if (why === undefined || observedAt === undefined || !Array.isArray(a['windows'])) return null;
    return {
        id,
        provider,
        name,
        disabled: a['disabled'],
        usable: a['usable'],
        why,
        thresholdPct: typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : null,
        observedAt,
        windows: a['windows'].map(readWindow).filter((w): w is LimitsWindow => w !== null),
    };
}

/** A version-1 limits report, or `null` for anything else. */
export function parseLimits(raw: unknown): LimitsReport | null {
    const r = obj(raw);
    if (r === null || r['v'] !== 1 || typeof r['at'] !== 'string' || !Array.isArray(r['accounts'])) return null;
    return {
        at: r['at'],
        accounts: r['accounts'].map(readAccount).filter((a): a is LimitsAccount => a !== null),
    };
}

/** What agent-switch currently knows about every account (or one provider's); `null` when it cannot say. */
export async function agentSwitchLimits(provider?: LimitsProvider, opts: LinkOptions = {}): Promise<LimitsReport | null> {
    return parseLimits(await agentSwitchCall('limits_get', provider !== undefined ? { provider } : {}, opts));
}
