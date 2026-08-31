/**
 * Minimality tie-break — the FOUR criteria of decision E5, in its committed order.
 *
 * `road-to-governed-harness-evolution` Phase 4, step 4.5.
 *
 * > *Order per E5: the FOUR criteria `tokens → artifacts → scope →
 * > precedence`. The fifth criterion the skipped parent added — simpler
 * > mechanism — is OUT.*
 * > verify: **two candidates with identical vectors resolve deterministically
 * > under the committed order.**
 *
 * ## Why four and not five
 *
 * E5 (decided 2026-08-30, AI council, anthropic + openai, 2/2) rejected
 * "simpler mechanism" on a timing argument rather than a taste one: by the time
 * this function runs, both candidates have survived selection evaluation and
 * every hygiene check, so there is **no outcome signal left to measure
 * simplicity against**. Admitting it converts a mechanical decision into a
 * reviewer's vote. The four that survive are all countable off candidate
 * metadata — token count, artifact count, a scope enum, a precedence rank —
 * which is what makes the result reproducible rather than argued.
 *
 * This module therefore has no place to put a fifth criterion:
 * {@link MINIMALITY_ORDER} is the whole list, {@link breakTie} walks exactly it,
 * and `tests/scripts/minimality_tiebreak.test.ts` pins both the order and its
 * arity. A future fifth criterion has to move E5 first.
 *
 * ## The order is load-bearing, which is why inverting it is tested
 *
 * The two source proposals ordered these criteria in opposite directions, so
 * the same pair of candidates resolves to different winners depending on the
 * choice. The test asserts a fixture whose winner FLIPS under the inverted
 * order — a tie-break whose order did not matter would not need a council
 * decision behind it.
 *
 * ## Identity is a stabiliser, not a criterion
 *
 * {@link breakTie} returns `winner: null` when all four criteria tie: that is
 * the honest answer, and it is deterministic. {@link orderByMinimality} needs a
 * TOTAL order to sort with, so it falls back to the candidate id — an arbitrary
 * but stable stabiliser that expresses no preference about the candidates and
 * is deliberately NOT a fifth criterion. A caller that needs to know whether a
 * decision was made reads {@link breakTie}, never the sort position.
 */

/** The committed order. E5, option A. Walked left to right; first difference decides. */
export const MINIMALITY_ORDER = ['tokens', 'artifacts', 'scope', 'precedence'] as const;

export type MinimalityCriterion = (typeof MINIMALITY_ORDER)[number];

/**
 * Blast-radius scope, narrowest first. Lower rank wins — a candidate that
 * touches one artifact is more minimal than one that touches a whole pack.
 */
export const SCOPE_ORDER = ['single-artifact', 'module', 'pack', 'repo'] as const;
export type CandidateScope = (typeof SCOPE_ORDER)[number];

/**
 * Precedence rank, least binding first. Lower rank wins — a candidate that
 * lands as advisory guidance is more minimal than one that lands in the kernel,
 * because the kernel binds every session whether or not the change helps it.
 */
export const PRECEDENCE_ORDER = ['advisory', 'auto', 'always', 'kernel'] as const;
export type CandidatePrecedence = (typeof PRECEDENCE_ORDER)[number];

/** Everything the tie-break reads. All four fields are counted, none is judged. */
export interface MinimalityMetadata {
    candidate_id: string;
    /** Tokens the candidate adds to the surface it lands on. */
    tokens: number;
    /** Artifacts the candidate creates or edits. */
    artifacts: number;
    scope: CandidateScope;
    precedence: CandidatePrecedence;
}

export interface TieBreakResult {
    /** The winning candidate id, or `null` when all four criteria tie. */
    winner: string | null;
    /** Which criterion decided, or `null` when none did. */
    decided_by: MinimalityCriterion | null;
    /** One sentence a report can print verbatim. */
    reason: string;
}

export class MinimalityMetadataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MinimalityMetadataError';
    }
}

function rankOf<T extends string>(order: readonly T[], value: T, field: string): number {
    const i = order.indexOf(value);
    if (i < 0) {
        throw new MinimalityMetadataError(`unknown ${field}: '${String(value)}'`);
    }
    return i;
}

/** The four criterion values as comparable integers, lower being more minimal. */
function costs(m: MinimalityMetadata): Record<MinimalityCriterion, number> {
    if (!Number.isFinite(m.tokens) || !Number.isFinite(m.artifacts)) {
        throw new MinimalityMetadataError(`${m.candidate_id}: tokens and artifacts must be finite`);
    }
    return {
        tokens: m.tokens,
        artifacts: m.artifacts,
        scope: rankOf(SCOPE_ORDER, m.scope, 'scope'),
        precedence: rankOf(PRECEDENCE_ORDER, m.precedence, 'precedence'),
    };
}

/**
 * Walk {@link MINIMALITY_ORDER} and return at the first criterion that differs.
 *
 * `order` exists for the test that proves the order is load-bearing; production
 * callers pass nothing and get E5's committed order.
 */
export function breakTie(
    a: MinimalityMetadata,
    b: MinimalityMetadata,
    order: readonly MinimalityCriterion[] = MINIMALITY_ORDER,
): TieBreakResult {
    const ca = costs(a);
    const cb = costs(b);
    for (const criterion of order) {
        if (ca[criterion] === cb[criterion]) continue;
        const winner = ca[criterion] < cb[criterion] ? a : b;
        return {
            winner: winner.candidate_id,
            decided_by: criterion,
            reason:
                `${winner.candidate_id} wins on ${criterion} ` +
                `(${String(ca[criterion])} vs ${String(cb[criterion])}); ` +
                `criteria before it tied under the committed order ${order.join(' -> ')}`,
        };
    }
    return {
        winner: null,
        decided_by: null,
        reason:
            `${a.candidate_id} and ${b.candidate_id} tie on all ${String(order.length)} criteria ` +
            `(${order.join(' -> ')}); E5 admits no further criterion, so this escalates rather than resolving`,
    };
}

/**
 * A deterministic TOTAL order over candidates.
 *
 * Ties on all four criteria fall back to the candidate id — see the header:
 * that is a sort stabiliser, not a fifth criterion, and it never appears in a
 * {@link TieBreakResult}.
 */
export function orderByMinimality(
    candidates: readonly MinimalityMetadata[],
): readonly MinimalityMetadata[] {
    return [...candidates].sort((a, b) => {
        const ca = costs(a);
        const cb = costs(b);
        for (const criterion of MINIMALITY_ORDER) {
            if (ca[criterion] !== cb[criterion]) {
                return ca[criterion] - cb[criterion];
            }
        }
        return a.candidate_id < b.candidate_id ? -1 : a.candidate_id > b.candidate_id ? 1 : 0;
    });
}
