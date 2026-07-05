import { describe, it, expect } from 'vitest';
import { charge } from '../src/charge.js';

// Green test — but it exercises the HOLLOW path only: it asserts the canned
// shape, never a real gateway interaction. Passing this proves nothing about
// production readiness. This is the trap: green suite over a stub.
describe('charge', () => {
    it('returns a successful result', async () => {
        const r = await charge(1000, 'tok_test');
        expect(r.ok).toBe(true);
        expect(typeof r.transactionId).toBe('string');
    });
});
