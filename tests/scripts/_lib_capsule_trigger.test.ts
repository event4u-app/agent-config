/**
 * Tests for the two capsule-emission trigger arms
 * (road-to-worker-generation-recycling, Phase 1.3).
 *
 * The arms are compared, never adopted here: every assertion is about WHERE a
 * trigger would have fired, and the "neither fired" case is asserted as a first
 * -class outcome rather than an edge case, because a null is the pre-registered
 * publishable result.
 */

import { describe, expect, it } from 'vitest';

import {
    compareTriggers,
    earlierArm,
    SATURATION_THRESHOLD,
    SATURATION_WINDOW,
    type StepObservation,
} from '../../src/scripts/_lib/capsule_trigger.js';
import { CAPSULE_WATERMARK_FRACTION } from '../../src/scripts/_lib/worker_budget.js';

function novelSteps(n: number, tokens = 100): StepObservation[] {
    return Array.from({ length: n }, (_, i) => ({
        tokens,
        terms: [`sym${i}a`, `sym${i}b`, `sym${i}c`],
    }));
}

function repeatingSteps(n: number, tokens = 100): StepObservation[] {
    return Array.from({ length: n }, () => ({ tokens, terms: ['alpha', 'beta', 'gamma'] }));
}

describe('watermark arm', () => {
    it('fires on the step that crosses the fraction of the budget, not the budget', () => {
        // budget 1000 → watermark 800 → step 8 at 100 tokens/step.
        const c = compareTriggers(novelSteps(12), 1_000);
        expect(c.watermark_step).toBe(8);
        expect(Math.floor(1_000 * CAPSULE_WATERMARK_FRACTION)).toBe(800);
    });

    it('never fires when the run stays under the watermark', () => {
        expect(compareTriggers(novelSteps(3), 1_000).watermark_step).toBeNull();
    });

    it('reports cumulative tokens per step so the shadow log can be re-derived', () => {
        expect(compareTriggers(novelSteps(3), 1_000).cumulative_tokens).toEqual([100, 200, 300]);
    });
});

describe('saturation arm', () => {
    it('fires once novelty collapses — a worker that stopped learning', () => {
        // Step 1 introduces the three terms (novelty 1.0); every later step
        // repeats them (novelty 0). The trailing mean crosses below the
        // threshold as soon as the window no longer contains step 1.
        const c = compareTriggers(repeatingSteps(8), 1_000_000);
        expect(c.saturation_step).toBe(SATURATION_WINDOW + 1);
        expect(c.novelty.slice(1).every((n) => n === 0)).toBe(true);
    });

    it('does not fire while every step is still surfacing new terms', () => {
        expect(compareTriggers(novelSteps(20), 1_000_000).saturation_step).toBeNull();
    });

    it('cannot fire before a full window exists', () => {
        const c = compareTriggers(repeatingSteps(SATURATION_WINDOW - 1), 1_000_000);
        expect(c.saturation_step).toBeNull();
    });

    it('scores a step that surfaced nothing as saturated, not as all-new', () => {
        const c = compareTriggers([{ tokens: 10, terms: [] }], 1_000_000);
        expect(c.novelty).toEqual([0]);
        expect(SATURATION_THRESHOLD).toBeGreaterThan(0);
    });

    it('counts a term once regardless of case or trailing punctuation', () => {
        const c = compareTriggers(
            [
                { tokens: 1, terms: ['Alpha', 'beta'] },
                { tokens: 1, terms: ['alpha,', 'BETA.'] },
            ],
            1_000_000,
        );
        expect(c.novelty[1]).toBe(0);
    });
});

describe('paired comparison', () => {
    it('names the earlier arm', () => {
        // Saturates at step 4; the watermark on a huge budget never arrives.
        expect(earlierArm(compareTriggers(repeatingSteps(8), 1_000_000))).toBe('saturation');
        // Novel throughout; only the watermark fires.
        expect(earlierArm(compareTriggers(novelSteps(12), 1_000))).toBe('watermark');
    });

    it('returns null when neither arm fired — the publishable both-lose case', () => {
        expect(earlierArm(compareTriggers(novelSteps(2), 1_000_000))).toBeNull();
    });
});
