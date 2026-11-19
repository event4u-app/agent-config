/**
 * The appeal jury of the arena (road-to-an-arena-and-a-panel Phase 2).
 *
 * Owner directive 2026-11-19 (D2): an eliminated idea is voted back in by paid
 * seats only. Staged — `shadow` records the vote beside the single paid card
 * seat's decision, `binding` lets the vote decide. `binding` stays refused until
 * the pre-registered claim `paid-appeal-jury` in `docs/CLAIMS.md` is backed;
 * the flip of `BINDING_UNLOCKED` and that claim's status land in one change.
 *
 * Deliberately not built on the AC-9-pinned council jury aggregator: that module is pinned
 * to tests by AC-9 until the same claim lifts it. The swap is reused from
 * `judge_position_bias` semantics — one vote per presentation order. A paid
 * juror whose two answers differ makes the whole jury `inconclusive` (D2):
 * an order-dependent vote is no evidence the elimination was wrong.
 */
import type { Seat } from './engine.js';

export const MAX_JURORS = 5;
export const BINDING_UNLOCKED = false;

export const JURY_MODES = ['off', 'shadow', 'binding'] as const;
export type JuryMode = (typeof JURY_MODES)[number];

export type JurorAnswer = 'readmit' | 'deny';

/** One juror, asked twice: the eliminated line shown first (`ab`) and second (`ba`). */
export interface JurorVote {
    readonly seat: Seat;
    readonly ab: JurorAnswer;
    readonly ba: JurorAnswer;
}

/** One juror as persisted: enough to recompute every claim statistic from state. */
export interface JurorRecord {
    readonly seat: string;
    readonly family: string;
    readonly billing: Seat['billing'];
    readonly ab: JurorAnswer;
    readonly ba: JurorAnswer;
    readonly counted: boolean;
}

export interface JuryRecord {
    readonly outcome: JurorAnswer | 'inconclusive';
    readonly reason: string;
    /** Paid seats in the tally. */
    readonly counted: number;
    readonly families: readonly string[];
    readonly inconsistent: readonly string[];
    /** Seats present but outside the tally (free or self-hosted). */
    readonly ignored: readonly string[];
    readonly votes: readonly JurorRecord[];
}

/** Subscriptions and metered seats are paid; free quota and local weights are not (ADR-257, D2). */
export function countsAsPaid(seat: Seat): boolean {
    return seat.billing === 'subscription' || seat.billing === 'per-token';
}

export function tallyAppealJury(votes: readonly JurorVote[]): JuryRecord {
    const seen = new Set<string>();
    for (const v of votes) {
        if (seen.has(v.seat.id)) throw new Error(`duplicate seat ${v.seat.id} on the appeal jury`);
        seen.add(v.seat.id);
    }
    const paid = votes.filter((v) => countsAsPaid(v.seat));
    const ignored = votes.filter((v) => !countsAsPaid(v.seat)).map((v) => v.seat.id);
    const families = [...new Set(paid.map((v) => v.seat.family))].sort();
    const inconsistent = paid.filter((v) => v.ab !== v.ba).map((v) => v.seat.id);
    const records: JurorRecord[] = votes.map((v) => ({
        seat: v.seat.id,
        family: v.seat.family,
        billing: v.seat.billing,
        ab: v.ab,
        ba: v.ba,
        counted: countsAsPaid(v.seat),
    }));
    const base = { counted: paid.length, families, inconsistent, ignored, votes: records };
    // Observers (unpaid) never count toward the cap: they may not turn a valid
    // paid verdict into an inconclusive one by their number alone.
    if (paid.length > MAX_JURORS) {
        return { outcome: 'inconclusive', reason: `${paid.length} paid seats; a jury has at most ${MAX_JURORS}`, ...base };
    }
    if (families.length < 2) {
        return { outcome: 'inconclusive', reason: `needs two paid families, has ${families.length}`, ...base };
    }
    // D2: an inconsistent juror leaves the elimination standing, whatever the rest say.
    if (inconsistent.length > 0) {
        return { outcome: 'inconclusive', reason: `inconsistent paid juror(s) across the order swap: ${inconsistent.join(', ')}`, ...base };
    }
    const count = (a: JurorAnswer): number => paid.filter((v) => v.ab === a).length;
    for (const a of ['readmit', 'deny'] as const) {
        if (count(a) * 2 > paid.length) {
            return { outcome: a, reason: `${count(a)} of ${paid.length} paid jurors: ${a}`, ...base };
        }
    }
    return {
        outcome: 'inconclusive',
        reason: `no strict majority (readmit ${count('readmit')}, deny ${count('deny')} of ${paid.length})`,
        ...base,
    };
}

export function resolveJuryMode(raw: string | undefined): JuryMode {
    const v = raw ?? 'shadow';
    if (!(JURY_MODES as readonly string[]).includes(v)) {
        throw new Error(`appeal jury mode ${v}: expected off | shadow | binding`);
    }
    if (v === 'binding' && !BINDING_UNLOCKED) {
        throw new Error('appeal jury `binding` is refused until the pre-registered claim paid-appeal-jury (docs/CLAIMS.md) is backed; run `shadow`');
    }
    return v as JuryMode;
}
