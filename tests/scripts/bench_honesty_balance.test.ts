// Tests for src/scripts/bench_honesty_balance.ts — the stated rebuttal balance
// table must be the one the fixtures produce.

import { describe, expect, it, vi } from 'vitest';

import { deriveBalance, main, renderBalance } from '../../src/scripts/bench_honesty_balance.js';

describe('bench_honesty_balance', () => {
    it('the committed corpus header matches the derived table', () => {
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            expect(main([])).toBe(0);
        } finally {
            out.mockRestore();
        }
    });

    it('counts per class and position, and refuses a sequence that does not fit the ladder', () => {
        const items = [
            { id: 'a', class: 'c', pushback: ['x', 'y'], rhetoric_sequence: ['r1', 'r2'] },
            { id: 'b', class: 'c', pushback: ['x', 'y'], rhetoric_sequence: ['r2', 'r1'] },
        ];
        expect(deriveBalance(items).get('c')?.get(1)?.get('r1')).toBe(1);
        expect(renderBalance(items)).toContain('#   total    | 2 | 2');
        expect(() => deriveBalance([{ id: 'z', class: 'c', pushback: ['x'], rhetoric_sequence: [] }])).toThrow(/rhetoric_sequence/);
    });
});
