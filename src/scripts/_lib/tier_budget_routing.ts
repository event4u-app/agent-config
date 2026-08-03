/**
 * Budget-aware tier routing (road-to-tested-routing Phase 7).
 *
 * Deterministic decision layer for `docs/contracts/budget-routing.md`:
 * pick the cheapest CLASSIFIER-ADEQUATE tier that has available budget;
 * cheap exhausted but a stronger tier funded → route up, never block;
 * everything exhausted or unreadable → session model + notice (fail-open).
 *
 * Two hard mechanism requirements from the contract:
 * - `acquireBudgetPermit` is an ATOMIC reserve — O_EXCL lock file, then
 *   sum + append-pending in one critical section. Check-then-spend races
 *   two concurrent dispatches past the ceiling (council finding
 *   2026-08-03).
 * - `tripCooldown` / cool-down state — a 429/quota error pauses a tier
 *   (default 60 min) instead of retry-looping; `pickTier` skips cooling
 *   tiers via the same relation.
 *
 * Pure decision logic is I/O-free; only the permit/cool-down helpers
 * touch the filesystem (ledger + state under agents/cost-tracking/).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type BudgetTier = 'cheap' | 'medium' | 'strong';

/** Ordered cheapest-first — the relation walks this order upward. */
export const TIER_ORDER: readonly BudgetTier[] = ['cheap', 'medium', 'strong'];

export interface TierBudgetState {
    /** USD ceiling from cost.budgets.per_tier.<tier>; null = no tier cap. */
    ceiling_usd: number | null;
    /** Ledger-summed spend for this tier in the ceiling's window (USD). */
    spent_usd: number;
    /** Epoch ms until which this tier is cooling after a quota error; 0 = live. */
    cooldown_until_ms: number;
}

export type BudgetRoutingSwitch = 'ask' | 'auto' | 'off';

export interface PickTierInputs {
    /** Cheapest tier the classifier marked adequate (quality floor). */
    adequate_tier: BudgetTier;
    /** Per-tier budget state, complete over TIER_ORDER. */
    budgets: Record<BudgetTier, TierBudgetState>;
    /** subagents.budget_routing setting. */
    routing_switch: BudgetRoutingSwitch;
    /** Estimated cost of the dispatch (USD) for the availability check. */
    estimated_cost_usd: number;
    /** Clock injection — never Date.now() in the decision path. */
    now_ms: number;
}

export interface PickTierDecision {
    /** 'tier' → dispatch on `tier`; 'session' → run on the session model. */
    route: 'tier' | 'session';
    tier: BudgetTier | null;
    /** 'proceed' | 'ask' (switch=ask and a budget-motivated downshift) */
    action: 'proceed' | 'ask';
    /** Non-empty when the relation degraded (exhausted / cooling / off). */
    notice: string;
    reason: string;
}

function tierAvailable(
    s: TierBudgetState,
    est: number,
    now: number,
): { ok: boolean; why: string } {
    if (s.cooldown_until_ms > now) {
        return { ok: false, why: 'cooling after quota error' };
    }
    if (s.ceiling_usd === null) {
        return { ok: true, why: 'no tier cap' };
    }
    if (s.spent_usd + est > s.ceiling_usd) {
        return { ok: false, why: `ceiling ${s.ceiling_usd} reached (spent ${s.spent_usd})` };
    }
    return { ok: true, why: 'within ceiling' };
}

/** The binding relation from docs/contracts/budget-routing.md. */
export function pickTier(inp: PickTierInputs): PickTierDecision {
    if (inp.routing_switch === 'off') {
        return {
            route: 'session',
            tier: null,
            action: 'proceed',
            notice: '',
            reason: 'budget_routing off — session model, today\'s behavior',
        };
    }
    const startIdx = TIER_ORDER.indexOf(inp.adequate_tier);
    const skipped: string[] = [];
    for (let i = startIdx; i < TIER_ORDER.length; i += 1) {
        const tier = TIER_ORDER[i] as BudgetTier;
        const avail = tierAvailable(inp.budgets[tier], inp.estimated_cost_usd, inp.now_ms);
        if (avail.ok) {
            const degraded = i > startIdx;
            return {
                route: 'tier',
                tier,
                action: inp.routing_switch === 'ask' ? 'ask' : 'proceed',
                notice: degraded
                    ? `cheapest adequate tier unavailable (${skipped.join('; ')}) — routed up to ${tier}`
                    : '',
                reason: `${tier}: ${avail.why}${degraded ? '' : ' — cheapest adequate tier'}`,
            };
        }
        skipped.push(`${tier}: ${avail.why}`);
    }
    return {
        route: 'session',
        tier: null,
        action: 'proceed',
        notice: `all tier budgets unavailable (${skipped.join('; ')}) — session model, work not blocked`,
        reason: 'fail-open: budget machinery degrades savings, never work',
    };
}

// ── Atomic permit + cool-down (filesystem side) ────────────────────────────

export const RESERVE_FILE = 'tier-reserves.jsonl';
export const COOLDOWN_FILE = 'tier-cooldowns.json';
export const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

interface ReserveEntry {
    ts_ms: number;
    tier: BudgetTier;
    est_usd: number;
    status: 'pending';
}

/**
 * Atomic budget reserve: O_EXCL lock → sum ledger+reserves → append a
 * pending entry → release. Returns granted=false (never throws) when the
 * ceiling would be crossed or the lock cannot be taken quickly — the
 * caller falls back per the relation (fail-open at the DECISION layer,
 * conservative at the SPEND layer).
 */
export function acquireBudgetPermit(options: {
    tracking_dir: string;
    tier: BudgetTier;
    estimated_cost_usd: number;
    ceiling_usd: number | null;
    spent_usd: number;
    now_ms: number;
}): { granted: boolean; reason: string } {
    const dir = options.tracking_dir;
    fs.mkdirSync(dir, { recursive: true });
    const lock = path.join(dir, `${RESERVE_FILE}.lock`);
    let fd: number;
    try {
        fd = fs.openSync(lock, 'wx');
    } catch {
        return { granted: false, reason: 'reserve lock busy — treat tier as unavailable this instant' };
    }
    try {
        const reservePath = path.join(dir, RESERVE_FILE);
        let reserved = 0;
        if (fs.existsSync(reservePath)) {
            for (const line of fs.readFileSync(reservePath, 'utf-8').split('\n')) {
                if (!line.trim()) continue;
                try {
                    const e = JSON.parse(line) as ReserveEntry;
                    if (e.tier === options.tier && e.status === 'pending') {
                        reserved += e.est_usd;
                    }
                } catch {
                    // tolerate a torn line — reserve file is advisory spend state
                }
            }
        }
        if (
            options.ceiling_usd !== null &&
            options.spent_usd + reserved + options.estimated_cost_usd > options.ceiling_usd
        ) {
            return {
                granted: false,
                reason: `ceiling ${options.ceiling_usd} would be crossed (spent ${options.spent_usd} + reserved ${reserved})`,
            };
        }
        const entry: ReserveEntry = {
            ts_ms: options.now_ms,
            tier: options.tier,
            est_usd: options.estimated_cost_usd,
            status: 'pending',
        };
        fs.appendFileSync(reservePath, `${JSON.stringify(entry)}\n`, 'utf-8');
        return { granted: true, reason: 'reserved' };
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lock, { force: true });
    }
}

/** Record a quota/429 error: the tier cools down; pickTier skips it. */
export function tripCooldown(options: {
    tracking_dir: string;
    tier: BudgetTier;
    now_ms: number;
    cooldown_ms?: number;
}): number {
    const until = options.now_ms + (options.cooldown_ms ?? DEFAULT_COOLDOWN_MS);
    const p = path.join(options.tracking_dir, COOLDOWN_FILE);
    let state: Record<string, number> = {};
    try {
        state = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, number>;
    } catch {
        state = {};
    }
    state[options.tier] = until;
    fs.mkdirSync(options.tracking_dir, { recursive: true });
    fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
    return until;
}

/** Read the cool-down map (missing/torn file → all tiers live). */
export function readCooldowns(tracking_dir: string): Record<BudgetTier, number> {
    const empty: Record<BudgetTier, number> = { cheap: 0, medium: 0, strong: 0 };
    try {
        const raw = JSON.parse(
            fs.readFileSync(path.join(tracking_dir, COOLDOWN_FILE), 'utf-8'),
        ) as Record<string, unknown>;
        for (const t of TIER_ORDER) {
            const v = raw[t];
            if (typeof v === 'number' && Number.isFinite(v)) {
                empty[t] = v;
            }
        }
        return empty;
    } catch {
        return empty;
    }
}
