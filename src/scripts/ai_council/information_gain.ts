/**
 * Expected information gain per cost — step 8.4.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 8.4: *"Score
 * optional next calls by expected information gain per cost, deterministic and
 * inspectable to start"*, verified by *"the score is reproducible from the
 * recorded inputs"*.
 *
 * ## Every feature is one the tree already computes
 *
 * The gain terms are read from {@link DisagreementSignal}
 * (`disagreement_signal.ts:134`), which 6.1 already established as **zero-cost
 * and structural** — every input arrives from a verdict the run has already
 * paid for. No new similarity measure, no new threshold, no model call to
 * decide whether to make a model call. Forking a second feature set here would
 * be the same defect 1A.1 forbids for the question hash: two answers to one
 * question, and the second is the one nobody updates.
 *
 * ## "Deterministic and inspectable" is enforced, not promised
 *
 * - {@link scoreNextCall} is pure: same record in, same bytes out.
 * - Terms are summed in a FIXED declared order, so floating-point association
 *   cannot vary with input ordering.
 * - The result carries every term's raw value, weight and contribution, so the
 *   number can be re-derived by hand from what is printed.
 * - The published figures are rounded to {@link SCORE_PRECISION} decimals, so a
 *   record round-tripped through JSON reproduces bit-identically.
 * - {@link reproduceScore} is the verify clause made executable: recompute from
 *   a record's own inputs and compare.
 *
 * ## What an UNAVAILABLE component does, and why it is not zero
 *
 * A component the run could not observe is dropped from BOTH the numerator and
 * the weight denominator. Treating it as 0 would read "not measured" as
 * "measured, and it showed agreement" — the same NOT-RUN-is-not-a-null failure
 * this roadmap records elsewhere. `basisComponents` reports how many terms the
 * gain actually rests on, so a gain over one component is distinguishable from
 * a gain over five, and {@link scoreNextCall} refuses to produce a gain at all
 * when nothing is available.
 *
 * ## Honest scope
 *
 * This scores; it does not decide. 8.5 — stopping when the next call has low
 * expected value — is explicitly gated on Phase 2 evidence
 * (`blocker: phase-2-benchmark-cost`), and the weights below are **declared
 * priors, not fitted values**: nothing has been benchmarked against them.
 * `revisit-if`: the Phase 2 benchmark shows a term that does not predict a
 * changed finding, or shows one that does and is absent here.
 */
import type { DisagreementSignal, SignalComponent } from './disagreement_signal.js';

/** Decimals every published figure is rounded to. Makes JSON round-trip exact. */
export const SCORE_PRECISION = 6;

/**
 * The gain terms, in the FIXED order they are summed.
 *
 * `direction` says how the raw component relates to expected gain:
 *   `'rising'`  — the component rises with DISAGREEMENT, so it is used as-is;
 *   `'falling'` — it rises with AGREEMENT, so `1 - value` is the gain.
 *
 * `weight` is a declared prior. The two divergence terms carry the most because
 * an unresolved split is the one state where another call can still change the
 * verdict; `selfSimilarity` is inverted and weighted low because high
 * self-similarity is exhaustion, which 6.2 already treats as a stop condition
 * rather than as a gain signal.
 */
export const GAIN_TERMS: readonly {
    readonly key: keyof DisagreementSignal & string;
    readonly weight: number;
    readonly direction: 'rising' | 'falling';
    readonly why: string;
}[] = [
    {
        key: 'stanceDivergence',
        weight: 0.30,
        direction: 'rising',
        why: 'an unresolved split is the one state where another call can still change the verdict',
    },
    {
        key: 'contradictionCount',
        weight: 0.25,
        direction: 'rising',
        why: 'an explicit disagree vote names a specific thing a rebuttal can settle',
    },
    {
        key: 'rankUncertainty',
        weight: 0.20,
        direction: 'rising',
        why: 'tied findings mean the ranking has not resolved and one more input may break it',
    },
    {
        key: 'confidenceSpread',
        weight: 0.15,
        direction: 'rising',
        why: 'a wide confidence range means the members disagree about how sure to be, not only about what',
    },
    {
        key: 'findingOverlap',
        weight: 0.07,
        direction: 'falling',
        why: 'high overlap means the members are already covering the same ground',
    },
    {
        key: 'selfSimilarity',
        weight: 0.03,
        direction: 'falling',
        why: 'high self-similarity is exhaustion, which 6.2 handles as a stop rather than as a gain',
    },
];

/** `contradictionCount` is a count, not 0..1; this is its saturation point. */
export const CONTRADICTION_SATURATION = 5;

/** The cost half. Both figures come from the caller's own estimate. */
export interface CallCost {
    /** Provider calls the option would issue. Must be > 0 to be scorable. */
    readonly calls: number;
    /** Estimated spend in USD. */
    readonly costUsd: number;
}

/** One scorable option, exactly as recorded. */
export interface NextCallInputs {
    /** Stable identifier for the option — `cross-exam:c-001`, `round-3`, … */
    readonly optionId: string;
    readonly signal: DisagreementSignal;
    /** Open adversarial triggers. Rising with gain: an open objection is unfinished argument. */
    readonly unresolvedAdversarialTriggers: number;
    readonly cost: CallCost;
}

/** One term's full arithmetic, so the total can be re-derived by hand. */
export interface TermBreakdown {
    readonly key: string;
    readonly available: boolean;
    /** The component's raw value, or `null` when unavailable. */
    readonly raw: number | null;
    /** Why it is unavailable, verbatim from the signal. `null` when available. */
    readonly reason: string | null;
    /** Raw mapped into 0..1 gain space (direction applied, count saturated). */
    readonly normalised: number | null;
    readonly weight: number;
    /** `normalised * weight`, or 0 when unavailable. */
    readonly contribution: number;
}

export interface NextCallScore {
    readonly optionId: string;
    /** 0..1 expected gain, or `null` when NO component was observable. */
    readonly gain: number | null;
    /** How many terms the gain rests on. 0..6. */
    readonly basisComponents: number;
    /** Sum of the weights of the available terms — the gain's denominator. */
    readonly weightUsed: number;
    /** `gain / costUsd`, or `null` when gain is null or cost is not positive. */
    readonly gainPerCost: number | null;
    /** `gain / calls`, or `null` on the same conditions. */
    readonly gainPerCall: number | null;
    readonly cost: CallCost;
    readonly terms: readonly TermBreakdown[];
    /** The trigger bonus applied to the gain, already included in it. */
    readonly triggerBonus: number;
}

/** Round to {@link SCORE_PRECISION}. `-0` normalised to `0` so JSON round-trips. */
export function roundScore(v: number): number {
    const f = 10 ** SCORE_PRECISION;
    const r = Math.round(v * f) / f;
    return Object.is(r, -0) ? 0 : r;
}

function _normalise(key: string, c: SignalComponent, direction: 'rising' | 'falling'): number {
    const raw = (c as { value: number }).value;
    // `contradictionCount` is the one count-valued component; everything else
    // is already 0..1 by its own contract.
    const scaled = key === 'contradictionCount' ? Math.min(1, raw / CONTRADICTION_SATURATION) : Math.min(1, Math.max(0, raw));
    return direction === 'rising' ? scaled : 1 - scaled;
}

/**
 * Score one option. Pure — no clock, no randomness, no file, no network.
 *
 * The trigger bonus is additive and capped: an unresolved adversarial trigger
 * raises expected gain because an open objection is unfinished argument (6.2's
 * own reasoning), but it may not by itself drive the gain to 1 — that would let
 * one open trigger outvote every measured component.
 */
export function scoreNextCall(inputs: NextCallInputs): NextCallScore {
    const terms: TermBreakdown[] = [];
    let weighted = 0;
    let weightUsed = 0;
    let basisComponents = 0;

    for (const t of GAIN_TERMS) {
        const c = inputs.signal[t.key] as SignalComponent;
        if (c !== undefined && c.available) {
            const normalised = _normalise(t.key, c, t.direction);
            const contribution = normalised * t.weight;
            weighted += contribution;
            weightUsed += t.weight;
            basisComponents += 1;
            terms.push({
                key: t.key,
                available: true,
                raw: roundScore(c.value),
                reason: null,
                normalised: roundScore(normalised),
                weight: t.weight,
                contribution: roundScore(contribution),
            });
        } else {
            terms.push({
                key: t.key,
                available: false,
                raw: null,
                reason: c === undefined ? 'component-absent' : c.reason,
                normalised: null,
                weight: t.weight,
                contribution: 0,
            });
        }
    }

    const triggerBonus = roundScore(Math.min(0.2, 0.1 * Math.max(0, inputs.unresolvedAdversarialTriggers)));
    const gain =
        basisComponents === 0 ? null : roundScore(Math.min(1, weighted / weightUsed + triggerBonus));

    const scorable = gain !== null;
    return {
        optionId: inputs.optionId,
        gain,
        basisComponents,
        weightUsed: roundScore(weightUsed),
        gainPerCost:
            scorable && inputs.cost.costUsd > 0 ? roundScore((gain as number) / inputs.cost.costUsd) : null,
        gainPerCall: scorable && inputs.cost.calls > 0 ? roundScore((gain as number) / inputs.cost.calls) : null,
        cost: inputs.cost,
        terms,
        triggerBonus,
    };
}

/** Inputs plus the score they produced — the thing 8.4 calls "the recorded inputs". */
export interface NextCallRecord {
    readonly inputs: NextCallInputs;
    readonly score: NextCallScore;
}

export function recordNextCall(inputs: NextCallInputs): NextCallRecord {
    return { inputs, score: scoreNextCall(inputs) };
}

/**
 * The verify clause, executable: recompute the score from the record's OWN
 * inputs and report whether it matches byte-for-byte under JSON.
 */
export function reproduceScore(record: NextCallRecord): { reproduced: boolean; recomputed: NextCallScore } {
    const recomputed = scoreNextCall(record.inputs);
    return { reproduced: JSON.stringify(recomputed) === JSON.stringify(record.score), recomputed };
}

/** Rank options by gain per USD, then by gain per call, then by id. Deterministic. */
export function rankByGainPerCost(scores: readonly NextCallScore[]): NextCallScore[] {
    return [...scores].sort(
        (a, b) =>
            (b.gainPerCost ?? -1) - (a.gainPerCost ?? -1) ||
            (b.gainPerCall ?? -1) - (a.gainPerCall ?? -1) ||
            (a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0),
    );
}

/** Inspectable rendering — every term's arithmetic, so the total is re-derivable by hand. */
export function renderNextCallScore(s: NextCallScore): string {
    const lines = [`option ${s.optionId}`];
    for (const t of s.terms) {
        lines.push(
            t.available
                ? `  ${t.key.padEnd(20)} raw ${String(t.raw).padEnd(10)} × w ${t.weight.toFixed(2)} = ${String(t.contribution)}`
                : `  ${t.key.padEnd(20)} unavailable (${t.reason ?? '—'}) — excluded from numerator AND denominator`,
        );
    }
    lines.push(
        `  trigger bonus        ${String(s.triggerBonus)}`,
        `  weight used          ${String(s.weightUsed)} over ${String(s.basisComponents)} component(s)`,
        `  gain                 ${s.gain === null ? 'null (nothing observable)' : String(s.gain)}`,
        `  cost                 ${String(s.cost.calls)} call(s), $${s.cost.costUsd.toFixed(4)}`,
        `  gain per USD         ${s.gainPerCost === null ? 'null' : String(s.gainPerCost)}`,
        `  gain per call        ${s.gainPerCall === null ? 'null' : String(s.gainPerCall)}`,
        '',
    );
    return lines.join('\n');
}
