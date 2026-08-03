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
import { fileURLToPath } from 'node:url';

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

// Reserve lifecycle constants — single source of truth shared with
// budget.mjs (the second reserve reader) via src/config/budget-routing.json.
// Duplicating the literal here was the exact two-truths defect the external
// review flagged; both readers now load the same file.
const _LIFECYCLE_CONFIG = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'config',
    'budget-routing.json',
);

function _lifecycle(): { reserve_ttl_ms: number; lock_break_ms: number } {
    try {
        const raw = JSON.parse(fs.readFileSync(_LIFECYCLE_CONFIG, 'utf-8')) as Record<string, unknown>;
        const ttl = typeof raw['reserve_ttl_ms'] === 'number' ? raw['reserve_ttl_ms'] : 600_000;
        const brk = typeof raw['lock_break_ms'] === 'number' ? raw['lock_break_ms'] : 30_000;
        return { reserve_ttl_ms: ttl, lock_break_ms: brk };
    } catch {
        return { reserve_ttl_ms: 600_000, lock_break_ms: 30_000 };
    }
}

export function reserveTtlMs(): number {
    return _lifecycle().reserve_ttl_ms;
}

interface ReserveEntry {
    ts_ms: number;
    tier: BudgetTier;
    est_usd: number;
    status: 'pending' | 'settled';
}

function _readReserves(reservePath: string): ReserveEntry[] {
    if (!fs.existsSync(reservePath)) {
        return [];
    }
    const out: ReserveEntry[] = [];
    for (const line of fs.readFileSync(reservePath, 'utf-8').split('\n')) {
        if (!line.trim()) continue;
        try {
            out.push(JSON.parse(line) as ReserveEntry);
        } catch {
            // tolerate a torn line — reserve file is advisory spend state
        }
    }
    return out;
}

/** Take the reserve lock; break a stale one (crash leftover) once. */
function _takeLock(lock: string, now_ms: number, lock_break_ms: number): number | null {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return fs.openSync(lock, 'wx');
        } catch {
            try {
                const age = now_ms - fs.statSync(lock).mtimeMs;
                if (age > lock_break_ms) {
                    fs.rmSync(lock, { force: true });
                    continue; // one retry after breaking the stale lock
                }
            } catch {
                continue; // lock vanished between open and stat — retry once
            }
            return null;
        }
    }
    return null;
}

/**
 * Atomic budget reserve — full lifecycle (external review 2026-08-03):
 *
 *   acquire → expire (TTL) / settle → compact-on-write
 *
 * Under the lock: live reserves = pending entries younger than the shared
 * TTL (reserves are RACE PROTECTION, not spend accounting — real spend is
 * the ledger's job); the file is COMPACTED to exactly those live entries
 * on every acquire, so it stays bounded; a lock file older than
 * `lock_break_ms` is a crash leftover and is broken with one retry.
 * Returns granted=false (never throws) when the ceiling would be crossed
 * or a fresh lock is genuinely held — the caller falls back per the
 * relation (fail-open at the DECISION layer, conservative at the SPEND
 * layer).
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
    const { reserve_ttl_ms, lock_break_ms } = _lifecycle();
    const fd = _takeLock(lock, options.now_ms, lock_break_ms);
    if (fd === null) {
        return { granted: false, reason: 'reserve lock busy — treat tier as unavailable this instant' };
    }
    try {
        const reservePath = path.join(dir, RESERVE_FILE);
        const live = _readReserves(reservePath).filter(
            (e) => e.status === 'pending' && options.now_ms - e.ts_ms < reserve_ttl_ms,
        );
        const reserved = live
            .filter((e) => e.tier === options.tier)
            .reduce((acc, e) => acc + e.est_usd, 0);
        if (
            options.ceiling_usd !== null &&
            options.spent_usd + reserved + options.estimated_cost_usd > options.ceiling_usd
        ) {
            // Compact even on deny — expiry must not depend on a grant.
            fs.writeFileSync(
                reservePath,
                live.map((e) => JSON.stringify(e)).join('\n') + (live.length ? '\n' : ''),
                'utf-8',
            );
            return {
                granted: false,
                reason: `ceiling ${options.ceiling_usd} would be crossed (spent ${options.spent_usd} + reserved ${reserved})`,
            };
        }
        live.push({
            ts_ms: options.now_ms,
            tier: options.tier,
            est_usd: options.estimated_cost_usd,
            status: 'pending',
        });
        fs.writeFileSync(
            reservePath,
            live.map((e) => JSON.stringify(e)).join('\n') + '\n',
            'utf-8',
        );
        return { granted: true, reason: 'reserved' };
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lock, { force: true });
    }
}

/**
 * Settle the oldest live pending reserve of a tier (call when the real
 * cost lands in the ledger, so the estimate stops counting immediately
 * instead of waiting out the TTL). Settled entries are dropped by the
 * next compaction. Best-effort: lock busy → no-op (the TTL is the
 * backstop that makes settling optional, never load-bearing).
 */
export function settlePermit(options: {
    tracking_dir: string;
    tier: BudgetTier;
    now_ms: number;
}): boolean {
    const lock = path.join(options.tracking_dir, `${RESERVE_FILE}.lock`);
    const { reserve_ttl_ms, lock_break_ms } = _lifecycle();
    const fd = _takeLock(lock, options.now_ms, lock_break_ms);
    if (fd === null) {
        return false;
    }
    try {
        const reservePath = path.join(options.tracking_dir, RESERVE_FILE);
        const live = _readReserves(reservePath).filter(
            (e) => e.status === 'pending' && options.now_ms - e.ts_ms < reserve_ttl_ms,
        );
        const idx = live.findIndex((e) => e.tier === options.tier);
        if (idx === -1) {
            return false;
        }
        live.splice(idx, 1);
        fs.writeFileSync(
            reservePath,
            live.map((e) => JSON.stringify(e)).join('\n') + (live.length ? '\n' : ''),
            'utf-8',
        );
        return true;
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lock, { force: true });
    }
}

/**
 * Record a quota/429 error: the tier cools down; pickTier skips it.
 *
 * Deliberately lock-free: last-writer-wins on a 3-key timestamp map is
 * benign (two concurrent trips write near-identical "until" values), so
 * the reserve lock is not reused here (accepted in the 2026-08-03 review).
 * Expired entries are purged on every write so the map never grows stale.
 */
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
    for (const [k, v] of Object.entries(state)) {
        if (typeof v !== 'number' || v <= options.now_ms) {
            delete state[k];
        }
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
