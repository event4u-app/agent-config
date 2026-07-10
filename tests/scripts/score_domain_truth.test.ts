/**
 * Deterministic domain-truth scorer (road-to-domain-soundness Phase 3).
 */
import { describe, expect, it } from 'vitest';

import {
    extractAnswer,
    scoreDeterministic,
    scoreFixture,
    type DeterministicCheck,
} from '../../src/scripts/score_domain_truth.js';

describe('extractAnswer', () => {
    it('prefers an explicit ANSWER: line over echoed scenario numbers', () => {
        const out =
            'A startup holds $4,200,000 cash and burns $560,000/mo.\n' +
            'Working: 4,200,000 / 560,000 = 7.5.\nANSWER: 7.5 months';
        expect(extractAnswer(out)).toBe(7.5);
    });

    it('normalizes $, thousands separators and a trailing unit', () => {
        expect(extractAnswer('ANSWER: $2,000')).toBe(2000);
        expect(extractAnswer('ANSWER: 32%')).toBe(32);
        expect(extractAnswer('ANSWER: $1,350M')).toBe(1350);
        expect(extractAnswer('ANSWER: 142.36')).toBe(142.36);
    });

    it('falls back to the last numeric token when no ANSWER line is present', () => {
        expect(extractAnswer('the result is 5 months')).toBe(5);
    });

    it('returns null on empty / number-free output', () => {
        expect(extractAnswer('')).toBeNull();
        expect(extractAnswer('no digits here')).toBeNull();
    });

    it('takes the last ANSWER line when several are present', () => {
        expect(extractAnswer('ANSWER: 1\nANSWER: 9')).toBe(9);
    });
});

describe('scoreDeterministic', () => {
    const check: DeterministicCheck = { kind: 'deterministic', expected: 7.5, tolerance: 0.05, rationale: 'x' };

    it('passes inside tolerance', () => {
        const r = scoreDeterministic('ANSWER: 7.5', check);
        expect(r.pass).toBe(true);
        expect(r.extracted).toBe(7.5);
    });

    it('passes exactly at the tolerance boundary', () => {
        expect(scoreDeterministic('ANSWER: 7.55', check).pass).toBe(true);
    });

    it('fails outside tolerance (a wrong domain answer)', () => {
        const r = scoreDeterministic('ANSWER: 8.4', check);
        expect(r.pass).toBe(false);
        expect(r.extracted).toBe(8.4);
    });

    it('fails when no numeric answer is present', () => {
        const r = scoreDeterministic('I cannot compute this', check);
        expect(r.pass).toBe(false);
        expect(r.extracted).toBeNull();
        expect(r.reason).toMatch(/no numeric answer/);
    });

    it('honors exact-match tolerance 0', () => {
        const exact: DeterministicCheck = { kind: 'deterministic', expected: 2000, tolerance: 0, rationale: 'x' };
        expect(scoreDeterministic('ANSWER: 2000', exact).pass).toBe(true);
        expect(scoreDeterministic('ANSWER: 2001', exact).pass).toBe(false);
    });
});

describe('scoreFixture', () => {
    const fixture = {
        skill: 'unit-economics-modeling',
        cases: [
            { id: 'cac', check: { kind: 'deterministic', expected: 2000, tolerance: 0, rationale: 'x' } },
            { id: 'ltv', check: { kind: 'deterministic', expected: 20000, tolerance: 0, rationale: 'x' } },
            { id: 'qualitative', check: { kind: 'rubric', criterion: 'matches a named practice' } },
        ],
    };

    it('scores deterministic cases and skips rubric ones (never silently passing them)', () => {
        const { results, skipped } = scoreFixture(fixture, {
            cac: 'ANSWER: 2000',
            ltv: 'ANSWER: 20000',
        });
        expect(skipped).toEqual(['qualitative']);
        expect(results.map((r) => [r.id, r.pass])).toEqual([
            ['cac', true],
            ['ltv', true],
        ]);
    });

    it('fails a deterministic case with no captured output', () => {
        const { results } = scoreFixture(fixture, { cac: 'ANSWER: 2000' });
        const ltv = results.find((r) => r.id === 'ltv');
        expect(ltv?.pass).toBe(false);
        expect(ltv?.reason).toMatch(/no captured output/);
    });
});
