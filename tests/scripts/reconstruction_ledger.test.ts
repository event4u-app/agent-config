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
        behaviour: 'saving an empty title shows a validation error',
        tier: 'behaviour',
        required_cases: ['happy', 'empty', 'too-long'],
        evidence: { happy: ['E1'], empty: ['E2'], 'too-long': ['E3'] },
        verifier: 'tests/feature/title.test.ts',
        verifier_authority: 'controlled-replay',
        status: 'verified',
        ...over,
    };
}

describe('reconstruction obligation ledger', () => {
    it('names the equivalence tiers and statuses of the contract', () => {
        expect(EQUIVALENCE_TIERS).toEqual(['inspired-by', 'ux', 'behaviour', 'protocol', 'byte']);
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
        expect(evaluateLedger([])).toEqual({ state: 'unknown', verified: 0, counted: 0, parity: null, errors: [] });
    });

    it('stays open while any row is open or visible-only, and closes when all rows are verified or waived', () => {
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'open' })]).state).toBe('open');
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'visible-only' })]).state).toBe('open');
        expect(evaluateLedger([row(), row({ id: 'o2', status: 'waived', waiver_reason: 'licensed asset' })]).state).toBe('closed');
    });

    it('counts only verified rows toward parity — visible-only never counts, waived leaves the denominator', () => {
        const verdict = evaluateLedger([
            row(),
            row({ id: 'o2', status: 'visible-only' }),
            row({ id: 'o3', status: 'open' }),
            row({ id: 'o4', status: 'waived', waiver_reason: 'licensed asset' }),
        ]);
        expect(verdict.verified).toBe(1);
        expect(verdict.counted).toBe(3);
        expect(verdict.parity).toBeCloseTo(1 / 3);
    });

    it('does not count a row that claims verified on analyst inference, and refuses to close on it', () => {
        const verdict = evaluateLedger([row({ verifier_authority: 'analyst-inference' })]);
        expect(verdict.verified).toBe(0);
        expect(verdict.parity).toBe(0);
        expect(verdict.state).toBe('invalid');
        expect(verdict.errors.join('\n')).toMatch(/o1/);
    });
});
