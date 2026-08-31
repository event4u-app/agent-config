/**
 * Expected information gain per cost — step 8.4.
 *
 * The verify clause is *"the score is reproducible from the recorded inputs"*,
 * so the central assertions are a recompute-from-record round trip and a JSON
 * round trip. Pure arithmetic — no provider call, no clock, no randomness.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DisagreementSignal, SignalComponent } from '../../../src/scripts/ai_council/disagreement_signal.js';
import {
    CONTRADICTION_SATURATION,
    GAIN_TERMS,
    SCORE_PRECISION,
    rankByGainPerCost,
    recordNextCall,
    renderNextCallScore,
    reproduceScore,
    roundScore,
    scoreNextCall,
} from '../../../src/scripts/ai_council/information_gain.js';
import type { NextCallInputs } from '../../../src/scripts/ai_council/information_gain.js';

const ok = (value: number, basis = 4): SignalComponent => ({ available: true, value, basis });
const gap = (reason: string): SignalComponent => ({ available: false, reason } as SignalComponent);

function signal(over: Partial<DisagreementSignal> = {}): DisagreementSignal {
    return {
        stanceDivergence: ok(0.5),
        findingOverlap: ok(0.4),
        contradictionCount: ok(2),
        confidenceSpread: ok(0.6),
        rankUncertainty: ok(0.25),
        selfSimilarity: ok(0.3),
        availableCount: 6,
        ...over,
    } as DisagreementSignal;
}

function inputs(over: Partial<NextCallInputs> = {}): NextCallInputs {
    return {
        optionId: 'cross-exam:c-001',
        signal: signal(),
        unresolvedAdversarialTriggers: 0,
        cost: { calls: 2, costUsd: 0.05 },
        ...over,
    };
}

describe('8.4 — the score is reproducible from the recorded inputs', () => {
    it('recomputing from the record reproduces the score exactly', () => {
        const record = recordNextCall(inputs());
        const { reproduced, recomputed } = reproduceScore(record);
        expect(reproduced).toBe(true);
        expect(recomputed).toEqual(record.score);
    });

    it('survives a JSON round trip of the record', () => {
        const record = recordNextCall(inputs({ unresolvedAdversarialTriggers: 1 }));
        const revived = JSON.parse(JSON.stringify(record)) as typeof record;
        expect(reproduceScore(revived).reproduced).toBe(true);
        expect(JSON.stringify(revived.score)).toBe(JSON.stringify(record.score));
    });

    it('is a pure function — repeated calls give byte-identical output', () => {
        const i = inputs();
        const runs = Array.from({ length: 5 }, () => JSON.stringify(scoreNextCall(i)));
        expect(new Set(runs).size).toBe(1);
    });

    it('the module reads no clock, no randomness and no file — repetition alone cannot prove this', () => {
        // Measured during the sensitivity run: a `Date.now() % 7` term is
        // CONSTANT across five calls in one millisecond, so the repetition test
        // above passes under it. A source-level purity gate is what actually
        // catches a clock dependency, which is why both exist.
        const src = fs.readFileSync(
            path.resolve(__dirname, '../../../src/scripts/ai_council/information_gain.ts'),
            'utf8',
        );
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        for (const impure of ['Date.', 'Math.random', 'hrtime', 'performance.now', 'node:fs', 'fetch(']) {
            expect(code).not.toContain(impure);
        }
    });

    it('DENIAL — an altered input changes the score, so reproduction is not vacuous', () => {
        const record = recordNextCall(inputs());
        const tampered = {
            ...record,
            inputs: { ...record.inputs, signal: signal({ stanceDivergence: ok(0.9) }) },
        };
        expect(reproduceScore(tampered).reproduced).toBe(false);
    });

    it('every published figure is rounded, so no float tail can vary across environments', () => {
        const s = scoreNextCall(inputs());
        const decimals = (v: number): number => (String(v).split('.')[1] ?? '').length;
        expect(decimals(s.gain as number)).toBeLessThanOrEqual(SCORE_PRECISION);
        for (const t of s.terms) {
            if (t.contribution !== 0) expect(decimals(t.contribution)).toBeLessThanOrEqual(SCORE_PRECISION);
        }
        expect(roundScore(-0)).toBe(0); // -0 would JSON-round-trip as 0 and break equality
    });
});

describe('the arithmetic is inspectable — the total re-derives by hand', () => {
    it('the term breakdown sums to the gain, over the weight actually used', () => {
        const s = scoreNextCall(inputs());
        const summed = s.terms.reduce((acc, t) => acc + t.contribution, 0);
        expect(roundScore(summed / s.weightUsed + s.triggerBonus)).toBeCloseTo(s.gain as number, 5);
    });

    it('carries one breakdown row per declared term, weights included', () => {
        const s = scoreNextCall(inputs());
        expect(s.terms.map((t) => t.key)).toEqual(GAIN_TERMS.map((t) => t.key));
        for (const [i, t] of s.terms.entries()) expect(t.weight).toBe(GAIN_TERMS[i]?.weight);
        // Declared weights sum to 1, so a full signal uses the whole denominator.
        expect(roundScore(GAIN_TERMS.reduce((a, t) => a + t.weight, 0))).toBe(1);
        expect(s.weightUsed).toBe(1);
    });

    it('renders every term with its arithmetic and names the unavailable ones', () => {
        const out = renderNextCallScore(scoreNextCall(inputs({ signal: signal({ rankUncertainty: gap('too-few-ranked-findings') }) })));
        expect(out).toContain('stanceDivergence');
        expect(out).toContain('too-few-ranked-findings');
        expect(out).toContain('excluded from numerator AND denominator');
        expect(out).toContain('gain per USD');
    });

    it('applies direction: agreement-rising terms are inverted', () => {
        const rising = GAIN_TERMS.filter((t) => t.direction === 'rising').map((t) => t.key);
        const falling = GAIN_TERMS.filter((t) => t.direction === 'falling').map((t) => t.key);
        expect(rising).toContain('stanceDivergence');
        expect(falling).toEqual(['findingOverlap', 'selfSimilarity']);
        // findingOverlap 0.4 → gain 0.6
        const s = scoreNextCall(inputs());
        expect(s.terms.find((t) => t.key === 'findingOverlap')?.normalised).toBe(0.6);
    });

    it('saturates the one count-valued component instead of letting it dominate', () => {
        const s = scoreNextCall(inputs({ signal: signal({ contradictionCount: ok(50) }) }));
        expect(s.terms.find((t) => t.key === 'contradictionCount')?.normalised).toBe(1);
        expect(CONTRADICTION_SATURATION).toBe(5);
    });
});

describe('an unavailable component is excluded, never read as zero', () => {
    it('drops from BOTH numerator and denominator', () => {
        const s = scoreNextCall(inputs({ signal: signal({ stanceDivergence: gap('no-stance-tally') }) }));
        expect(s.basisComponents).toBe(5);
        expect(s.weightUsed).toBe(roundScore(1 - 0.3));
        expect(s.terms.find((t) => t.key === 'stanceDivergence')).toMatchObject({
            available: false,
            raw: null,
            contribution: 0,
            reason: 'no-stance-tally',
        });
    });

    it('a fully-agreeing signal and a fully-unobservable one score differently', () => {
        const agreeing = scoreNextCall(
            inputs({
                signal: signal({
                    stanceDivergence: ok(0),
                    contradictionCount: ok(0),
                    rankUncertainty: ok(0),
                    confidenceSpread: ok(0),
                    findingOverlap: ok(1),
                    selfSimilarity: ok(1),
                }),
            }),
        );
        expect(agreeing.gain).toBe(0);
        expect(agreeing.basisComponents).toBe(6);

        const unobservable = scoreNextCall(
            inputs({
                signal: {
                    stanceDivergence: gap('no-stance-tally'),
                    findingOverlap: gap('too-few-sourced-findings'),
                    contradictionCount: gap('no-scored-findings'),
                    confidenceSpread: gap('too-few-confidence-observations'),
                    rankUncertainty: gap('too-few-ranked-findings'),
                    selfSimilarity: gap('no-prior-round'),
                    availableCount: 0,
                } as DisagreementSignal,
            }),
        );
        // null, NOT 0 — "nothing was measured" is a different claim from
        // "everything was measured and agreed".
        expect(unobservable.gain).toBeNull();
        expect(unobservable.gain).not.toBe(0);
        expect(unobservable.gainPerCost).toBeNull();
        expect(unobservable.basisComponents).toBe(0);
    });
});

describe('cost division and ranking', () => {
    it('divides by USD and by call count separately', () => {
        const s = scoreNextCall(inputs({ cost: { calls: 4, costUsd: 0.2 } }));
        expect(s.gainPerCost).toBe(roundScore((s.gain as number) / 0.2));
        expect(s.gainPerCall).toBe(roundScore((s.gain as number) / 4));
    });

    it('returns null rather than Infinity on a zero-cost option', () => {
        const s = scoreNextCall(inputs({ cost: { calls: 0, costUsd: 0 } }));
        expect(s.gainPerCost).toBeNull();
        expect(s.gainPerCall).toBeNull();
        expect(s.gain).not.toBeNull(); // the gain is still observable
    });

    it('ranks a cheaper equal-gain option above a dearer one, deterministically', () => {
        const cheap = scoreNextCall(inputs({ optionId: 'b-cheap', cost: { calls: 1, costUsd: 0.01 } }));
        const dear = scoreNextCall(inputs({ optionId: 'a-dear', cost: { calls: 8, costUsd: 0.40 } }));
        expect(rankByGainPerCost([dear, cheap]).map((s) => s.optionId)).toEqual(['b-cheap', 'a-dear']);
        expect(rankByGainPerCost([cheap, dear]).map((s) => s.optionId)).toEqual(['b-cheap', 'a-dear']);
    });

    it('an unresolved adversarial trigger raises gain but is capped so it cannot outvote the signal', () => {
        const none = scoreNextCall(inputs({ unresolvedAdversarialTriggers: 0 }));
        const one = scoreNextCall(inputs({ unresolvedAdversarialTriggers: 1 }));
        const many = scoreNextCall(inputs({ unresolvedAdversarialTriggers: 99 }));
        expect(one.gain as number).toBeGreaterThan(none.gain as number);
        expect(many.triggerBonus).toBe(0.2);
        expect(one.triggerBonus).toBe(0.1);
    });
});
