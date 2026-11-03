/**
 * Bracket size by importance (road-to-a-loss-that-can-be-appealed Phase 4).
 *
 * N is a ceiling, never a quota: the saturation stop (`saturationStop`) ends the
 * spawn early when further lines stop being different. The tier that sets the
 * ceiling may be raised above S2 only by a deterministic signal or by the user —
 * an agent that grades its own question grants itself budget and authority
 * (`decision-revisit-gate`, "a grade is a measurement, not a permission").
 */

export const TIER_IDS = ['S0', 'S1', 'S2', 'S3', 'S4'] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface Tier {
    readonly id: TierId;
    /** Ceiling on distinct lines; 0 = no bracket, an ordinary retry. */
    readonly n: number;
    readonly when: string;
    /** S3/S4 ask once with the plan even when invoked explicitly. */
    readonly askAlways: boolean;
}

export const TIERS: readonly Tier[] = [
    { id: 'S0', n: 0, when: 'trivial, cheap to redo — no bracket', askAlways: false },
    { id: 'S1', n: 10, when: 'default: explicit /judge bracket, or offered after dissatisfaction', askAlways: false },
    { id: 'S2', n: 20, when: 'AC takes a council-decidable decision with lasting effect, or a security surface is hit', askAlways: false },
    { id: 'S3', n: 64, when: 'AC takes a user decision touching security/data or a public commitment, or the user says "important"', askAlways: true },
    { id: 'S4', n: 100, when: 'an owner-reserved transition, or the user says "extremely important" / --agents 100', askAlways: true },
];

export const DEFAULT_TIER: TierId = 'S1';

export function tier(id: TierId): Tier {
    const t = TIERS.find((x) => x.id === id);
    if (t === undefined) throw new Error(`unknown tier ${id}`);
    return t;
}

/** Generation + per match two attacks, two defences and one judge: 6N − 5. */
export function callsFor(n: number): number {
    return n <= 1 ? Math.max(n, 0) : 6 * n - 5;
}

function rank(id: TierId): number {
    return TIER_IDS.indexOf(id);
}

export interface TierSignals {
    /** The tier the agent proposes from its own reading. */
    readonly agentProposed?: TierId | undefined;
    /** The tier the user named, or `--agents N` mapped to the smallest tier holding N. */
    readonly userRequested?: TierId | undefined;
    /** Changed paths hit a row of the security-surface table. */
    readonly securitySurfaceHit?: string | null;
    /** The decision matches a row of the owner-reserved transition table. */
    readonly ownerReservedRow?: string | null;
}

export interface TierDecision {
    readonly tier: TierId;
    readonly n: number;
    readonly reason: string;
    /** A proposal the resolver refused to honour, named rather than dropped. */
    readonly refused: string | null;
}

/**
 * The agent may always lower and may raise up to S2 on its own reading. Above
 * S2 only a deterministic signal or the user counts. The user's word wins in
 * both directions.
 */
export function resolveTier(s: TierSignals): TierDecision {
    if (s.userRequested !== undefined) {
        return { tier: s.userRequested, n: tier(s.userRequested).n, reason: 'user requested', refused: null };
    }
    let floor: TierId = DEFAULT_TIER;
    let reason = 'default';
    if (s.securitySurfaceHit) {
        floor = 'S2';
        reason = `security surface: ${s.securitySurfaceHit}`;
    }
    if (s.ownerReservedRow) {
        floor = 'S4';
        reason = `owner-reserved: ${s.ownerReservedRow} — the bracket prepares, the owner signs`;
    }
    const proposed = s.agentProposed;
    if (proposed === undefined) return { tier: floor, n: tier(floor).n, reason, refused: null };
    if (rank(proposed) < rank(floor)) {
        return { tier: proposed, n: tier(proposed).n, reason: `lowered by agent below ${floor}`, refused: null };
    }
    if (rank(proposed) <= rank('S2') || rank(proposed) <= rank(floor)) {
        return { tier: proposed, n: tier(proposed).n, reason: rank(proposed) > rank(floor) ? 'agent reading (≤ S2)' : reason, refused: null };
    }
    return {
        tier: floor,
        n: tier(floor).n,
        reason,
        refused: `agent proposed ${proposed} without a deterministic signal or the user`,
    };
}

/** Smallest tier whose ceiling holds `n` lines. */
export function tierForAgents(n: number): TierId {
    for (const t of TIERS) if (t.n >= n && t.n > 0) return t.id;
    return 'S4';
}

export const SATURATION_RATIO = 0.2;

/**
 * Two consecutive waves each adding fewer than 20 % new lines (after dedupe)
 * stop the spawn: more of the same model only costs.
 */
export function saturationStop(waves: readonly { readonly spawned: number; readonly novel: number }[]): boolean {
    if (waves.length < 2) return false;
    const last = waves.slice(-2);
    return last.every((w) => w.spawned > 0 && w.novel / w.spawned < SATURATION_RATIO);
}
