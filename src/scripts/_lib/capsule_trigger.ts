/**
 * Capsule-emission triggers — the two arms Phase 1 compares in shadow
 * (road-to-worker-generation-recycling).
 *
 * Pure, no-I/O. Two candidate answers to "when should a worker hand off?":
 *
 *   - **watermark** — cumulative tokens reach `CAPSULE_WATERMARK_FRACTION` of
 *     the stop-loss budget (`worker_budget.ts`). Cheap, already instrumented,
 *     and indifferent to whether the worker is still learning anything.
 *   - **saturation** — novelty per step, by term frequency, falls below a
 *     threshold. The hypothesis it encodes: a worker near its budget should
 *     have stopped EARLIER, not summarised harder — a worker that has stopped
 *     surfacing new terms is done discovering regardless of its token count.
 *
 * Deliberately term-frequency only. Embeddings would add a model dependency,
 * a similarity threshold nobody can defend, and a second thing to explain when
 * the arm loses — and the arm has to be able to lose cheaply for the shadow
 * comparison to mean anything.
 *
 * NOTHING ACTS ON THESE. Phase 1 logs the step at which each trigger WOULD have
 * fired and the worker runs to stop-loss exactly as before, so the measurement
 * is not confounded by the mechanism it is measuring.
 */

import { CAPSULE_WATERMARK_FRACTION } from './worker_budget.js';

/** Trailing steps averaged before saturation can fire. */
export const SATURATION_WINDOW = 3;
/** Mean novelty below this over the window = saturated. */
export const SATURATION_THRESHOLD = 0.2;

/** One observed worker step. `terms` is whatever the step surfaced — paths, symbols, words. */
export interface StepObservation {
    /** Tokens this step consumed (per-step, not cumulative). */
    tokens: number;
    /** Terms surfaced by this step. Normalised and deduped internally. */
    terms: string[];
}

export interface TriggerComparison {
    /** Steps observed. */
    steps: number;
    /** 1-based step at which the token watermark was crossed; null = never. */
    watermark_step: number | null;
    /** 1-based step at which novelty saturated; null = never. */
    saturation_step: number | null;
    /** Per-step novelty ratio (new terms / distinct terms in that step). */
    novelty: number[];
    /** Cumulative tokens after each step. */
    cumulative_tokens: number[];
}

/** Lowercase, strip surrounding punctuation. No stemming — a stemmer is a second thing to defend. */
function normalise(term: string): string {
    return term.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function distinctTerms(terms: string[]): Set<string> {
    const out = new Set<string>();
    for (const raw of terms) {
        if (typeof raw !== 'string') continue;
        const t = normalise(raw);
        if (t.length > 0) out.add(t);
    }
    return out;
}

/**
 * Run both arms over an observed step sequence and report where each WOULD
 * have fired. Both may be null (neither fired) — which is a publishable result,
 * not a failure of the instrument.
 */
export function compareTriggers(steps: StepObservation[], budget: number): TriggerComparison {
    const watermark = Math.floor(budget * CAPSULE_WATERMARK_FRACTION);
    const seen = new Set<string>();
    const novelty: number[] = [];
    const cumulative_tokens: number[] = [];
    let cumulative = 0;
    let watermark_step: number | null = null;
    let saturation_step: number | null = null;

    for (const [i, step] of steps.entries()) {
        cumulative += Number.isFinite(step.tokens) ? step.tokens : 0;
        cumulative_tokens.push(cumulative);
        if (watermark_step === null && budget > 0 && cumulative >= watermark) {
            watermark_step = i + 1;
        }

        const terms = distinctTerms(step.terms ?? []);
        let fresh = 0;
        for (const t of terms) {
            if (!seen.has(t)) {
                fresh += 1;
                seen.add(t);
            }
        }
        // A step that surfaced nothing is fully saturated by definition: it
        // learned nothing. Scoring it as 1.0 ("all new") would let an idle
        // worker look maximally productive.
        novelty.push(terms.size === 0 ? 0 : fresh / terms.size);

        if (saturation_step === null && novelty.length >= SATURATION_WINDOW) {
            const window = novelty.slice(-SATURATION_WINDOW);
            const mean = window.reduce((a, b) => a + b, 0) / window.length;
            if (mean < SATURATION_THRESHOLD) saturation_step = i + 1;
        }
    }

    return { steps: steps.length, watermark_step, saturation_step, novelty, cumulative_tokens };
}

/**
 * Which arm fired first, for the paired comparison in `docs/CLAIMS.md`
 * (`worker-capsule-trigger-arm`). `null` = neither fired; `'tie'` = same step.
 */
export function earlierArm(c: TriggerComparison): 'watermark' | 'saturation' | 'tie' | null {
    const w = c.watermark_step;
    const s = c.saturation_step;
    if (w === null && s === null) return null;
    if (w === null) return 'saturation';
    if (s === null) return 'watermark';
    if (w === s) return 'tie';
    return w < s ? 'watermark' : 'saturation';
}
