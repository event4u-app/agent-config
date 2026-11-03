import { describe, expect, it } from 'vitest';

import {
    EQUIVALENCE_TIERS,
    OBLIGATION_STATUSES,
    canVerify,
    evaluateLedger,
    validateObligation,
    type Obligation,
} from '../../src/scripts/_lib/reconstruction_ledger.js';

function row(over: Partial<Obligation> = {}): Obligation {
    return {
        id: 'o1',
        behavior: 'saving an empty title shows a validation error',
        tier: 'behavior',
        required_cases: ['happy', 'empty', 'too-long'],
        evidence: { happy: ['E1'], empty: ['E2'], 'too-long': ['E3'] },
        verifier: 'tests/feature/title.test.ts',
        verifier_authority: 'controlled-replay',
        status: 'verified',
        ...over,
    };
}

/** The evidence ids the run actually recorded. */
const CTX = { evidenceIds: new Set(['E1', 'E2', 'E3']) };

describe('reconstruction obligation ledger', () => {
    it('names the equivalence tiers and statuses of the contract', () => {
        expect(EQUIVALENCE_TIERS).toEqual(['inspired-by', 'ux', 'behavior', 'protocol', 'byte']);
        expect(OBLIGATION_STATUSES).toEqual(['open', 'visible-only', 'verified', 'waived']);
    });

    it('verifies a row only when every required case has evidence and the verifier is not analyst inference', () => {
        expect(canVerify(row())).toBe(true);
        expect(canVerify(row({ evidence: { happy: ['E1'], empty: ['E2'] } }))).toBe(false);
        expect(canVerify(row({ evidence: { happy: ['E1'], empty: ['E2'], 'too-long': [] } }))).toBe(false);
        expect(canVerify(row({ verifier_authority: 'analyst-inference' }))).toBe(false);
        expect(canVerify(row({ required_cases: [] }))).toBe(false);
    });

    it('refuses a row that claims verified without the evidence or with inference as its verifier', () => {
        expect(validateObligation(row())).toEqual([]);
        expect(validateObligation(row({ verifier_authority: 'analyst-inference' })).join('\n')).toMatch(/analyst-inference/);
        expect(validateObligation(row({ evidence: { happy: ['E1'] } })).join('\n')).toMatch(/empty, too-long/);
        expect(validateObligation(row({ status: 'waived' })).join('\n')).toMatch(/waiver_reason/);
        expect(validateObligation(row({ status: 'waived', waiver_reason: 'out of scope' }))).toEqual([]);
    });

    it('reads an empty ledger as unknown, never as closed', () => {
        expect(evaluateLedger([], CTX)).toEqual({ state: 'unknown', verified: 0, counted: 0, parity: null, errors: [] });
    });

    it('stays open while any row is open or visible-only, and closes when all rows are verified or waived', () => {
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'open' })], CTX).state).toBe('open');
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'visible-only' })], CTX).state).toBe('open');
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'waived', waiver_reason: 'licensed asset' })], CTX).state).toBe('closed');
    });

    it('counts only verified rows toward parity — visible-only never counts, waived leaves the denominator', () => {
        const verdict = evaluateLedger([
            row(),
            row({ id: 'o2', status: 'visible-only' }),
            row({ id: 'o3', status: 'open' }),
            row({ id: 'o4', status: 'waived', waiver_reason: 'licensed asset' }),
        ], CTX);
        expect(verdict.verified).toBe(1);
        expect(verdict.counted).toBe(3);
        expect(verdict.parity).toBeCloseTo(1 / 3);
    });

    it('does not count a row that claims verified on analyst inference, and refuses to close on it', () => {
        const verdict = evaluateLedger([row({ verifier_authority: 'analyst-inference' })], CTX);
        expect(verdict.verified).toBe(0);
        expect(verdict.parity).toBe(0);
        expect(verdict.state).toBe('invalid');
        expect(verdict.errors.join('\n')).toMatch(/o1/);
    });

    it('closes a well-formed ledger whose evidence ids all resolve', () => {
        expect(evaluateLedger([row()], CTX)).toMatchObject({ state: 'closed', errors: [] });
    });

    // One row carrying all three fabrications. Each check contributes exactly one
    // of the three errors, so removing any one check turns this case — and only
    // this case — red.
    it('refuses a fabricated row: unknown evidence id, authority outside the enum, empty verifier', () => {
        const fabricated = row({
            evidence: { happy: ['E1'], empty: ['E2'], 'too-long': ['E999'] },
            verifier: '   ',
            verifier_authority: 'trust-me' as Obligation['verifier_authority'],
        });
        const verdict = evaluateLedger([fabricated], CTX);
        expect(verdict.state).toBe('invalid');
        expect(verdict.verified).toBe(0);
        expect(verdict.errors).toHaveLength(3);
        expect(verdict.errors.join('\n')).toMatch(/unknown evidence id E999/);
        expect(verdict.errors.join('\n')).toMatch(/unknown verifier_authority trust-me/);
        expect(verdict.errors.join('\n')).toMatch(/verified with an empty verifier/);
    });
});
