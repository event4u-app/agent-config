/**
 * analysis_gate.ts — the council as judge of what stays contested after an
 * exchange, then the gain gate that decides whether one more round is offered.
 *
 * Order is the substance: the round cap first — a capped gate never evaluates
 * the predicate, so its `stop` is null — then `evaluateStop`, which refuses to
 * stop on agreement before anti-conformity repair ran, and only then the offer.
 * Until calibration exists, an offer needs named open items whose executable
 * verification plans fit the remaining budget together, admitted in input
 * order; `scoreNextCall` is computed only for an offer, as an estimate that
 * never decides. The owner is
 * asked once, with a gain band and its reasons, only when the council splits
 * or the round exceeds the ceiling.
 */
import { evaluateStop, type StopInputs, type StopVerdict } from './ai_council/argument_exhaustion.js';
import { scoreNextCall, type NextCallInputs, type NextCallScore } from './ai_council/information_gain.js';
import { EVIDENCE_TIERS, type EvidenceTier } from './analysis_ledger.js';

export const MAX_ROUNDS = 3;
export const OWNER_OPTIONS = ['one more', 'focused on the named items', 'stop'] as const;

export interface Seat {
    member: string;
    provider: string;
    status: 'ok' | 'failed';
}

/** Quorum is two answering seats from two providers; anything less is said, never hidden. */
export function councilVoice(seats: readonly Seat[]): 'quorum' | 'single-voice' {
    const ok = seats.filter((s) => s.status === 'ok');
    return ok.length >= 2 && new Set(ok.map((s) => s.provider)).size >= 2 ? 'quorum' : 'single-voice';
}

export interface ConflictSide {
    position: string;
    tier: EvidenceTier;
    critical?: boolean;
}

export interface Conflict {
    id: string;
    /** A safety or data-integrity question, where a critical dissent outweighs a majority. */
    safety: boolean;
    /** Non-empty: a conflict with no side is not a conflict, and is refused. */
    sides: readonly [ConflictSide, ...ConflictSide[]];
}

export type ConflictResolution =
    | { resolution: 'by-tier' | 'critical-dissent'; winner: number }
    | { resolution: 'named'; winner: null };

export function resolveConflict(c: Conflict): ConflictResolution {
    // The tuple type is the compile-time half; this is the half for parsed JSON.
    if ((c.sides as readonly ConflictSide[]).length === 0) throw new RangeError(`conflict ${c.id} has no sides`);
    if (c.safety) {
        const critical = c.sides.findIndex((s) => s.critical === true);
        if (critical >= 0) return { resolution: 'critical-dissent', winner: critical };
    }
    const rank = (t: EvidenceTier): number => EVIDENCE_TIERS.indexOf(t);
    const best = Math.min(...c.sides.map((s) => rank(s.tier)));
    const atBest = c.sides.map((s, i) => [s, i] as const).filter(([s]) => rank(s.tier) === best);
    const positions = new Set(atBest.map(([s]) => s.position));
    if (positions.size > 1) return { resolution: 'named', winner: null };
    const first = atBest[0];
    if (first === undefined) throw new RangeError(`conflict ${c.id} has no side at its best tier`);
    return { resolution: 'by-tier', winner: first[1] };
}

export interface OpenItem {
    id: string;
    kind: 'conflict' | 'claimed-high-impact';
    plan?: { executable: boolean; estimated_tokens: number; step: string };
}

export interface GainBand {
    level: 'low' | 'medium' | 'high';
    reasons: string[];
}

export interface GateInput {
    roundsCompleted: number;
    items: OpenItem[];
    remainingTokens: number;
    stop: StopInputs;
    nextCall?: NextCallInputs;
}

export interface GateResult {
    offer: boolean;
    reason: 'round-cap' | 'exhausted' | 'no-plannable-item' | 'offer';
    settleable: string[];
    /** Null when the round cap decided before the predicate ran. */
    stop: StopVerdict | null;
    estimate: NextCallScore | null;
    band: GainBand | null;
}

function bandFor(items: readonly OpenItem[]): GainBand {
    const level = items.length >= 3 ? 'high' : items.length === 2 ? 'medium' : 'low';
    return { level, reasons: items.map((i) => `${i.id}: ${i.plan?.step ?? ''}`) };
}

/** Items admitted in input order while their plans fit the budget together, not each alone. */
function admitWithinBudget(items: readonly OpenItem[], remainingTokens: number): OpenItem[] {
    const admitted: OpenItem[] = [];
    let spent = 0;
    for (const i of items) {
        if (i.plan === undefined || !i.plan.executable) continue;
        if (spent + i.plan.estimated_tokens > remainingTokens) continue;
        spent += i.plan.estimated_tokens;
        admitted.push(i);
    }
    return admitted;
}

export function evaluateGate(input: GateInput): GateResult {
    const none = (reason: GateResult['reason'], stop: StopVerdict | null): GateResult => ({
        offer: false,
        reason,
        settleable: [],
        stop,
        estimate: null,
        band: null,
    });
    if (input.roundsCompleted >= MAX_ROUNDS) return none('round-cap', null);
    const stop = evaluateStop(input.stop);
    if (stop.stop) return none('exhausted', stop);
    const settleable = admitWithinBudget(input.items, input.remainingTokens);
    if (settleable.length === 0) return none('no-plannable-item', stop);
    const estimate = input.nextCall === undefined ? null : scoreNextCall(input.nextCall);
    return { offer: true, reason: 'offer', settleable: settleable.map((i) => i.id), stop, estimate, band: bandFor(settleable) };
}

export type CouncilCall = 'one-more' | 'focused' | 'stop' | 'split';

export type RoundDecision =
    | { decided_by: 'none' }
    | { decided_by: 'council'; decision: Exclude<CouncilCall, 'split'> }
    | {
          decided_by: 'owner';
          question: { items: string[]; cost_tokens: number; band: GainBand; options: typeof OWNER_OPTIONS };
      };

export function decideNextRound(input: {
    gate: GateResult;
    council: CouncilCall;
    roundTokens: number;
    ceilingTokens: number;
}): RoundDecision {
    if (!input.gate.offer || input.gate.band === null) return { decided_by: 'none' };
    if (input.council === 'split' || input.roundTokens > input.ceilingTokens) {
        return {
            decided_by: 'owner',
            question: { items: input.gate.settleable, cost_tokens: input.roundTokens, band: input.gate.band, options: OWNER_OPTIONS },
        };
    }
    return { decided_by: 'council', decision: input.council };
}
