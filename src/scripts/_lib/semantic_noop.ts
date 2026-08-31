/**
 * The semantic no-op gate — `road-to-harness-promotion-bridge` step 7.4.
 *
 * > *Reject semantic no-ops. A no-op detector plus a minimum
 * > material-improvement threshold. The master kept the cooldown and lineage
 * > from the same attack and dropped both gates.*
 * > verify: **a paraphrase-only candidate is refused before the cascade.**
 *
 * ## "Before the cascade" — what that resolves to in this tree
 *
 * There is no artefact named "cascade" here; the evaluation cascade is the
 * lifecycle spine, `proposed -> diagnostic-evaluated -> selection-evaluated ->
 * …`. So "before the cascade" means: while the candidate is still `proposed`,
 * before the first transition and before anything expensive runs.
 * {@link screenSemanticNoOps} is that stage, and it is SYNCHRONOUS for the same
 * reason `screenNearDuplicates` is — a synchronous function cannot await a
 * network call, so the zero-model-call property follows from the signature
 * rather than from a promise the body has to keep.
 *
 * ## Two gates, because the step asks for two
 *
 * 1. **The no-op detector.** {@link isSemanticNoOp} — a candidate whose text is
 *    a paraphrase of what it replaces. Measured with `shingleOverlap`, the same
 *    primitive `curator_ops`'s near-duplicate screen and `lint_originality` use.
 * 2. **The minimum material-improvement threshold.** A candidate that is not a
 *    paraphrase can still be a rounding error;
 *    {@link MIN_MATERIAL_IMPROVEMENT_PERCENT} is the floor its measured delta
 *    must clear.
 *
 * Both are needed and neither implies the other: a total rewrite that changes
 * nothing measurable passes (1) and fails (2); a one-word change with a large
 * measured delta passes (2) and fails (1). Shipping one of the two is what the
 * master did.
 */
import { NEAR_DUPLICATE_THRESHOLD } from './curator_ops.js';
import { shingleOverlap } from './shingle_similarity.js';

/**
 * Containment-overlap percent at which a candidate is a paraphrase of what it
 * replaces.
 *
 * **Measured bound, stated rather than left for a reader to discover.**
 * `shingleOverlap` uses 8-word shingles, so ONE substitution breaks eight
 * shingles. On a one-sentence candidate (~10 shingles) that is already a
 * 45-point drop and no paraphrase can reach 70 %; on rule-body-sized text
 * (~60 words, 56 shingles) the same edit measures 85.7 %. The detector is
 * therefore meaningful for the corpus it will see — rule and skill bodies — and
 * weak for one-liners. `revisit-if` candidates turn out to be short.
 *
 * Pinned EQUAL to {@link NEAR_DUPLICATE_THRESHOLD} rather than given its own
 * number, and the equality is the argument: both questions are "is this text
 * substantially the text we already have", measured on the same primitive, and
 * two independently-tuned constants for one question is how they drift. If one
 * moves, the reason has to cover both.
 */
export const PARAPHRASE_OVERLAP_THRESHOLD = NEAR_DUPLICATE_THRESHOLD;

/**
 * The smallest measured improvement that counts as material, in percentage
 * points.
 *
 * A STATED default, not a measured optimum — the honest label this repository
 * uses for a number nobody has derived. `revisit-if` a real promotion is refused
 * for a delta a human calls material, or admitted for one a human calls noise.
 * It is deliberately small: the gate exists to reject ZERO, not to set a bar for
 * ambition.
 */
export const MIN_MATERIAL_IMPROVEMENT_PERCENT = 1;

export interface NoOpVerdict {
    readonly isNoOp: boolean;
    /** Why, in one clause. Empty when it is not a no-op. */
    readonly reason: string;
    readonly overlapPercent: number;
    /** Literal 0. This stage is deterministic; a model call here would be a defect. */
    readonly modelCalls: 0;
}

/**
 * Is this candidate a semantic no-op against the text it replaces?
 *
 * Two ways to be one, and the second is the one a paraphrase detector alone
 * misses: the text barely moved, or the text moved and the measured effect did
 * not.
 */
export function isSemanticNoOp(
    baselineText: string,
    candidateText: string,
    deltaPercent: number,
    overlapThreshold: number = PARAPHRASE_OVERLAP_THRESHOLD,
    minDelta: number = MIN_MATERIAL_IMPROVEMENT_PERCENT,
): NoOpVerdict {
    const overlapPercent = shingleOverlap(baselineText, candidateText);
    if (overlapPercent >= overlapThreshold) {
        return {
            isNoOp: true,
            reason:
                `paraphrase-only: ${String(overlapPercent)}% shingle overlap with the text it replaces ` +
                `(threshold ${String(overlapThreshold)}%)`,
            overlapPercent,
            modelCalls: 0,
        };
    }
    if (deltaPercent < minDelta) {
        return {
            isNoOp: true,
            reason:
                `no material improvement: measured delta ${String(deltaPercent)} pp is below the ` +
                `${String(minDelta)} pp floor`,
            overlapPercent,
            modelCalls: 0,
        };
    }
    return { isNoOp: false, reason: '', overlapPercent, modelCalls: 0 };
}

export class SemanticNoOpError extends Error {
    readonly candidateId: string;
    constructor(candidateId: string, reason: string) {
        super(
            `candidate '${candidateId}' is a semantic no-op and is refused before the cascade: ${reason}. ` +
                'Evaluating it would spend trials to measure nothing, and promoting it would grow the ' +
                'estate by an artefact that says what the estate already says.',
        );
        this.name = 'SemanticNoOpError';
        this.candidateId = candidateId;
    }
}

/** @throws {SemanticNoOpError} when the candidate is a no-op. */
export function assertNotSemanticNoOp(candidateId: string, verdict: NoOpVerdict): void {
    if (verdict.isNoOp) {
        throw new SemanticNoOpError(candidateId, verdict.reason);
    }
}

export interface NoOpScreenInput {
    readonly id: string;
    readonly baselineText: string;
    readonly candidateText: string;
    readonly deltaPercent: number;
}

export interface NoOpScreenResult {
    readonly admitted: readonly string[];
    readonly refused: readonly { readonly id: string; readonly reason: string }[];
    /** Literal 0 — the whole point of a pre-stage is that it is cheaper than what follows. */
    readonly modelCalls: 0;
}

/**
 * The pre-stage: refuse no-ops while every candidate is still `proposed`.
 *
 * Synchronous, and it takes TEXT rather than records on purpose — it must be
 * callable before a candidate has any evaluation results attached, which is the
 * whole meaning of "before the cascade".
 */
export function screenSemanticNoOps(candidates: readonly NoOpScreenInput[]): NoOpScreenResult {
    const admitted: string[] = [];
    const refused: { id: string; reason: string }[] = [];
    for (const c of candidates) {
        const verdict = isSemanticNoOp(c.baselineText, c.candidateText, c.deltaPercent);
        if (verdict.isNoOp) refused.push({ id: c.id, reason: verdict.reason });
        else admitted.push(c.id);
    }
    return { admitted, refused, modelCalls: 0 };
}
