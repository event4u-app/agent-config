import { describe, expect, it } from 'vitest';

import { loadDepthTable, receiptFor, wouldSkip } from '../../src/scripts/step_receipt.js';

const table = loadDepthTable();

describe('step_receipt', () => {
    it('the depth table is in shadow mode and names a row for every class', () => {
        expect(table.mode).toBe('shadow');
        for (const k of ['R0', 'R1', 'R2', 'R3'] as const) {
            expect(Object.keys(table.classes[k]).sort()).toEqual(Object.keys(table.full).sort());
        }
    });

    it('lists what a lowered class would skip, and nothing for R3', () => {
        expect(wouldSkip('R0', table)).toEqual(['council', 'evidence', 'retro', 'revalidation', 'review']);
        expect(wouldSkip('R2', table)).toEqual(['revalidation']);
        expect(wouldSkip('R3', table)).toEqual([]);
    });

    it('classifies from paths, and a raise only ever raises', () => {
        const docs = ['docs/x.md'];
        expect(receiptFor(docs, null, table).cls).toBe('R0');
        expect(receiptFor(docs, 'R2', table).cls).toBe('R2');
        expect(receiptFor(['src/scripts/hooks/x.ts'], 'R0', table).cls).toBe('R3');
    });

    it('renders one marker line naming class, binding reason and would-skip', () => {
        const line = receiptFor(['docs/x.md'], null, table).line;
        expect(line).toMatch(/^<!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->$/);
    });
});
