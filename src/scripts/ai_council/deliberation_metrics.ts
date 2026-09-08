/**
 * Two per-run deliberation measurements, both computed from outputs the run has
 * already paid for: a per-correction stage attribution, and the
 * `zero_marginal_value_call_rate`.
 *
 * Pure and offline. No model call, no new similarity measure — every judgement
 * below reuses `is_near_duplicate` from `debate_gates.ts`, which is the
 * repository's existing answer to "did this reply add anything", and the
 * objection vocabulary that module already publishes. Forking a second
 * similarity notion here would be two answers to one question, and the second
 * is the one nobody updates.
 *
 * WHAT A CORRECTION IS, AND WHAT IT IS NOT.
 *
 * A correction is an objection-bearing sentence: one that carries a marker from
 * {@link CORRECTION_MARKERS} and therefore names something it is pushing back
 * on. Its FIRST STAGE is the earliest stage whose text contains that sentence
 * or a near-duplicate of it — so a point raised in round 1 and repeated in
 * round 3 is attributed to round 1, which is the whole question 10.2 asks.
 *
 * It decides ATTRIBUTION, never USEFULNESS. Whether a correction improved the
 * verdict is a benchmark question and the benchmark has not run; a mechanism
 * here that claimed to score usefulness would be inventing the number the
 * forbidden-claims list exists to prevent. {@link attributeCorrections} answers
 * "where did this first appear", and the word "useful" in the step it serves is
 * a filter a human applies to the output, not one this code applies for them.
 *
 * WHAT ZERO MARGINAL VALUE IS.
 *
 * A call has zero marginal value when its text near-duplicates something the
 * run had ALREADY received when the call was made. Not "duplicates the member's
 * own prior round" — a member restating a peer's answer verbatim adds exactly
 * as little, and the per-member reading would score it as novel. So the
 * comparison set is every successful call that preceded it in run order.
 *
 * The first successful call is never zero-marginal: nothing preceded it. That
 * makes the denominator at least 1 whenever the run produced any usable call,
 * which is why the rate is a number rather than a `null` on every real run —
 * and a run that produced NO usable call gets `null` with a stated reason,
 * because zero calls is not a rate of zero.
 *
 * HONEST SCOPE. This measures textual novelty against an 0.8 Jaccard bar. It
 * does not measure whether a call changed the verdict, and no consumer may read
 * it as decision-quality evidence. The threshold is the shipped
 * `NOVELTY_DUP_THRESHOLD`, inherited rather than tuned here; nothing has been
 * benchmarked against it.
 */
import type { CouncilResponse } from './clients.js';
import { is_near_duplicate, NOVELTY_DUP_THRESHOLD } from './debate_gates.js';

/**
 * Objection markers. Deliberately the same vocabulary the shipped dissent
 * counter uses, kept as its own constant because that one counts members and
 * this one classifies sentences.
 */
export const CORRECTION_MARKERS =
    /\b(disagree|disagrees|object|objection|reject|rejects|however|but|flaw|flawed|wrong|incorrect|counter|counter-position|dissent|contradict|contradicts|refute|refutes|mistaken|overstates|understates)\b/i;

/** One call the run made, in the order the run made it. */
export interface DeliberationCall {
    /** Stage the call belongs to — a round label, a phase name, whatever the caller uses. */
    readonly stage: string;
    /** `provider/model`, or any stable member identity. */
    readonly member: string;
    /** The reply text. Empty or error replies are not scored. */
    readonly text: string;
    /** True when the transport reported a failure; such a call is not scored. */
    readonly failed?: boolean;
}

/** Where one correction first entered the deliberation. */
export interface CorrectionAttribution {
    /** The correction sentence, trimmed and whitespace-collapsed. */
    readonly correction: string;
    /** Stage label of the earliest call carrying it. */
    readonly firstStage: string;
    /** Zero-based index of that call in run order. */
    readonly firstCallIndex: number;
    /** Member whose call first carried it. */
    readonly firstMember: string;
    /** How many later calls restated it. 0 means it was said once. */
    readonly restatements: number;
}

/**
 * One deliberation stage and what it produced — the record shape
 * `CouncilRouteRecord` carries, filled from a real run rather than by a test.
 */
export interface StageProduction {
    readonly stage: string;
    readonly produced: number;
    readonly calls: number;
}

export interface ZeroMarginalValueReading {
    /**
     * Zero-marginal calls over scored calls, or `null` when the run produced no
     * scorable call at all. `null` is "not measurable here", never zero.
     */
    readonly rate: number | null;
    /** Why the rate is `null`. Empty string when it is not. */
    readonly unavailableReason: string;
    /** Every call the caller passed, failed and empty ones included. */
    readonly callsTotal: number;
    /** Calls that carried usable text — the denominator. */
    readonly callsScored: number;
    /** Calls that near-duplicated something already received — the numerator. */
    readonly callsZeroMarginal: number;
    /** The Jaccard bar used, published so the number can be re-derived. */
    readonly threshold: number;
}

/** Decimals the published rate is rounded to, so a JSON round-trip is exact. */
export const RATE_PRECISION = 6;

function _round(value: number): number {
    const f = 10 ** RATE_PRECISION;
    return Math.round(value * f) / f;
}

function _usable(c: DeliberationCall): boolean {
    return c.failed !== true && c.text.trim().length > 0;
}

/** Split a reply into sentences. Crude on purpose: no NLP, no dependency. */
function _sentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 0);
}

/**
 * Correction sentences in one reply.
 *
 * A minimum length is applied because a bare "But." carries a marker and no
 * position; the bar is characters rather than a judgement so it stays
 * predictable.
 */
export const MIN_CORRECTION_CHARS = 25;

export function correctionSentences(text: string): string[] {
    return _sentences(text).filter(
        (s) => s.length >= MIN_CORRECTION_CHARS && CORRECTION_MARKERS.test(s),
    );
}

/**
 * Attribute every correction to the earliest call that carried it.
 *
 * Calls are read in the order given, which must be run order — the attribution
 * is only meaningful if "earlier in the list" means "earlier in the run".
 */
export function attributeCorrections(
    calls: readonly DeliberationCall[],
    threshold: number = NOVELTY_DUP_THRESHOLD,
): CorrectionAttribution[] {
    const out: CorrectionAttribution[] = [];
    const restatements: number[] = [];

    calls.forEach((call, idx) => {
        if (!_usable(call)) return;
        for (const sentence of correctionSentences(call.text)) {
            const seen = out.findIndex(
                (a) =>
                    a.correction === sentence || is_near_duplicate(a.correction, sentence, threshold),
            );
            if (seen !== -1) {
                restatements[seen] = (restatements[seen] ?? 0) + 1;
                continue;
            }
            restatements.push(0);
            out.push({
                correction: sentence,
                firstStage: call.stage,
                firstCallIndex: idx,
                firstMember: call.member,
                restatements: 0,
            });
        }
    });

    return out.map((a, i) => ({ ...a, restatements: restatements[i] ?? 0 }));
}

/**
 * Per-stage production, derived from the attribution so the two can never
 * disagree: `produced` counts the corrections FIRST attributed to that stage.
 */
export function stageProduction(
    calls: readonly DeliberationCall[],
    attributions: readonly CorrectionAttribution[],
): StageProduction[] {
    const order: string[] = [];
    const callCount = new Map<string, number>();
    for (const c of calls) {
        if (!callCount.has(c.stage)) {
            order.push(c.stage);
            callCount.set(c.stage, 0);
        }
        callCount.set(c.stage, (callCount.get(c.stage) ?? 0) + 1);
    }
    const produced = new Map<string, number>();
    for (const a of attributions) {
        produced.set(a.firstStage, (produced.get(a.firstStage) ?? 0) + 1);
    }
    return order.map((stage) => ({
        stage,
        produced: produced.get(stage) ?? 0,
        calls: callCount.get(stage) ?? 0,
    }));
}

/**
 * The `zero_marginal_value_call_rate` for one run.
 *
 * Every scored call is compared against every scored call that preceded it. The
 * comparison is O(n squared) in the number of calls, which is fine: a council
 * run is single digits of calls per round.
 */
export function zeroMarginalValueRate(
    calls: readonly DeliberationCall[],
    threshold: number = NOVELTY_DUP_THRESHOLD,
): ZeroMarginalValueReading {
    const received: string[] = [];
    let zero = 0;

    for (const call of calls) {
        if (!_usable(call)) continue;
        const dup = received.some((prior) => is_near_duplicate(prior, call.text, threshold));
        if (dup) zero += 1;
        received.push(call.text);
    }

    if (received.length === 0) {
        return {
            rate: null,
            unavailableReason:
                'no scorable call — every call failed or returned empty text, and zero calls is not a rate of zero',
            callsTotal: calls.length,
            callsScored: 0,
            callsZeroMarginal: 0,
            threshold,
        };
    }

    return {
        rate: _round(zero / received.length),
        unavailableReason: '',
        callsTotal: calls.length,
        callsZeroMarginal: zero,
        callsScored: received.length,
        threshold,
    };
}

/** Everything this module emits for one run, ready to serialise. */
export interface DeliberationMetrics {
    readonly zero_marginal_value_call_rate: number | null;
    readonly zero_marginal_value_unavailable_reason: string;
    readonly calls_total: number;
    readonly calls_scored: number;
    readonly calls_zero_marginal: number;
    readonly novelty_threshold: number;
    readonly stage_outputs: readonly StageProduction[];
    readonly correction_attributions: readonly CorrectionAttribution[];
}

/** Compute both measurements in one pass over the run's calls. */
export function measureDeliberation(
    calls: readonly DeliberationCall[],
    threshold: number = NOVELTY_DUP_THRESHOLD,
): DeliberationMetrics {
    const attributions = attributeCorrections(calls, threshold);
    const zmv = zeroMarginalValueRate(calls, threshold);
    return {
        zero_marginal_value_call_rate: zmv.rate,
        zero_marginal_value_unavailable_reason: zmv.unavailableReason,
        calls_total: zmv.callsTotal,
        calls_scored: zmv.callsScored,
        calls_zero_marginal: zmv.callsZeroMarginal,
        novelty_threshold: zmv.threshold,
        stage_outputs: stageProduction(calls, attributions),
        correction_attributions: attributions,
    };
}

/**
 * The parts of one council run that made provider calls, in the order the run
 * made them.
 *
 * Assembled here rather than at the call site because "which calls did this run
 * make, and at which stage" is this module's own subject, and the CLI had the
 * list only as a flat array with the stage boundaries implicit in the order.
 * Both readings come out of one walk, so the billing total and the attribution
 * can never be computed over different sets.
 */
export interface RunCallParts {
    /** The deliberation responses `consult()` returned. */
    readonly deliberation: readonly CouncilResponse[];
    readonly peerReview?: readonly CouncilResponse[] | null;
    readonly consensusExtraction?: readonly CouncilResponse[] | null;
    readonly consensusScoring?: readonly CouncilResponse[] | null;
    readonly chairman?: CouncilResponse | null;
    readonly stanceRepairs?: readonly CouncilResponse[] | null;
}

/** The six stage labels, in run order. */
export const RUN_STAGES = Object.freeze([
    'deliberation',
    'peer-review',
    'consensus-extraction',
    'consensus-scoring',
    'chairman',
    'stance-repair',
] as const);

export interface RunCalls {
    /** Stage-labelled calls, for {@link measureDeliberation}. */
    readonly calls: readonly DeliberationCall[];
    /** The same calls as raw responses, in the same order, for cost aggregation. */
    readonly responses: CouncilResponse[];
}

function _asCall(stage: string, r: CouncilResponse): DeliberationCall {
    return {
        stage,
        member: `${r.provider}/${r.model}`,
        text: r.text,
        failed: r.error !== null && r.error !== undefined,
    };
}

/** Walk one run's parts into stage-labelled calls plus the flat response list. */
export function runCallsFrom(parts: RunCallParts): RunCalls {
    const groups: ReadonlyArray<readonly [string, readonly CouncilResponse[]]> = [
        ['deliberation', parts.deliberation],
        ['peer-review', parts.peerReview ?? []],
        ['consensus-extraction', parts.consensusExtraction ?? []],
        ['consensus-scoring', parts.consensusScoring ?? []],
        ['chairman', parts.chairman === null || parts.chairman === undefined ? [] : [parts.chairman]],
        ['stance-repair', parts.stanceRepairs ?? []],
    ];
    const calls: DeliberationCall[] = [];
    const responses: CouncilResponse[] = [];
    for (const [stage, group] of groups) {
        for (const r of group) {
            calls.push(_asCall(stage, r));
            responses.push(r);
        }
    }
    return { calls, responses };
}
